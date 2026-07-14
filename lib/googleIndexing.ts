import "server-only";

import { createSign } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { absoluteUrl, siteUrl } from "@/lib/site";
import { logError, logInfo } from "@/lib/logger";

export type IndexingJobType = "publish" | "update" | "delete";
export type IndexingJobStatus = "pending" | "processing" | "success" | "failed";

type TokenCache = {
  accessToken: string;
  expiresAt: number;
};

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_INDEXING_PUBLISH_URL =
  "https://indexing.googleapis.com/v3/urlNotifications:publish";
const GOOGLE_INDEXING_METADATA_URL =
  "https://indexing.googleapis.com/v3/urlNotifications/metadata";
const GOOGLE_INDEXING_SCOPE = "https://www.googleapis.com/auth/indexing";
const GOOGLE_SEARCH_CONSOLE_SCOPE =
  "https://www.googleapis.com/auth/webmasters.readonly";
const GOOGLE_SEARCH_CONSOLE_SITES_URL =
  "https://www.googleapis.com/webmasters/v3/sites";
const MAX_ATTEMPTS = 5;
const RETRY_DELAYS_MS = [5 * 60_000, 15 * 60_000, 60 * 60_000, 6 * 60 * 60_000, 24 * 60 * 60_000];
const GOOGLE_RESPONSE_LIMIT = 12_000;

const cachedTokens = new Map<string, TokenCache>();

function base64Url(value: Buffer | string) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function cleanPrivateKey(value: string | undefined) {
  return (value || "").trim().replace(/^"|"$/g, "").replace(/\\n/g, "\n");
}

function enabledFlag() {
  return process.env.GOOGLE_INDEXING_ENABLED === "true";
}

export function googleIndexingReadiness() {
  const enabled = enabledFlag();
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() || "";
  const privateKey = cleanPrivateKey(process.env.GOOGLE_PRIVATE_KEY);
  const configured = enabled && Boolean(serviceAccountEmail) && Boolean(privateKey);
  let message = "Ready";
  if (!enabled) {
    message = "Google Indexing API is disabled. Set GOOGLE_INDEXING_ENABLED=true.";
  } else if (!serviceAccountEmail || !privateKey) {
    message = "Waiting for Google credentials.";
  }

  return {
    enabled,
    configured,
    serviceAccountEmailConfigured: Boolean(serviceAccountEmail),
    privateKeyConfigured: Boolean(privateKey),
    message
  };
}

function configuredProductionOrigin() {
  const configured = new URL(siteUrl());
  if (
    configured.protocol !== "https:" ||
    ["localhost", "127.0.0.1", "0.0.0.0"].includes(configured.hostname)
  ) {
    throw new Error(
      "NEXT_PUBLIC_SITE_URL must be a production HTTPS origin before indexing can run."
    );
  }
  return configured.origin;
}

export function normalizeIndexableArticleUrl(value: string) {
  const url = new URL(absoluteUrl(value.trim()));
  const productionOrigin = configuredProductionOrigin();
  if (url.protocol !== "https:" || url.origin !== productionOrigin) {
    throw new Error(`Only production URLs from ${productionOrigin} can be submitted.`);
  }
  if (["localhost", "127.0.0.1", "0.0.0.0"].includes(url.hostname)) {
    throw new Error("Localhost URLs can never be submitted to Google.");
  }
  url.hash = "";
  url.search = "";
  url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  if (!/^\/news\/[^/]+$/.test(url.pathname)) {
    throw new Error("Only canonical Daily Signal Wire article URLs can be submitted.");
  }
  return url.toString();
}

function googleType(type: IndexingJobType) {
  return type === "delete" ? "URL_DELETED" : "URL_UPDATED";
}

function articleSlug(url: string) {
  return decodeURIComponent(new URL(url).pathname.split("/").filter(Boolean).pop() || "");
}

function serializeResponse(value: unknown) {
  try {
    return JSON.stringify(value).slice(0, GOOGLE_RESPONSE_LIMIT);
  } catch {
    return String(value).slice(0, GOOGLE_RESPONSE_LIMIT);
  }
}

function nextRetryAt(attempts: number) {
  if (attempts >= MAX_ATTEMPTS) return null;
  const delay = RETRY_DELAYS_MS[Math.min(Math.max(attempts - 1, 0), RETRY_DELAYS_MS.length - 1)];
  return new Date(Date.now() + delay);
}

async function verifyArticleForSubmission(url: string, type: IndexingJobType) {
  if (type === "delete") return new Date();
  const post = await prisma.post.findUnique({
    where: { slug: articleSlug(url) },
    select: { slug: true, status: true }
  });
  if (!post || post.status !== "published") {
    throw new Error("The URL must resolve to a published Daily Signal Wire article.");
  }
  const canonical = normalizeIndexableArticleUrl(absoluteUrl(`/news/${post.slug}`));
  if (canonical !== url) {
    throw new Error("The submitted URL does not match the article canonical URL.");
  }
  return new Date();
}

function createServiceAccountAssertion(scope = GOOGLE_INDEXING_SCOPE) {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const privateKey = cleanPrivateKey(process.env.GOOGLE_PRIVATE_KEY);
  if (!email || !privateKey) {
    throw new Error("Waiting for Google credentials.");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64Url(
    JSON.stringify({
      iss: email,
      scope,
      aud: GOOGLE_TOKEN_URL,
      iat: now,
      exp: now + 3600
    })
  );
  const unsigned = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = base64Url(signer.sign(privateKey));
  return `${unsigned}.${signature}`;
}

async function getAccessToken(scope = GOOGLE_INDEXING_SCOPE) {
  const now = Date.now();
  const cachedToken = cachedTokens.get(scope);
  if (cachedToken && cachedToken.expiresAt - 60_000 > now) {
    return cachedToken.accessToken;
  }

  const assertion = createServiceAccountAssertion(scope);
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });

  const payload = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !payload.access_token) {
    throw new Error(
      payload.error_description ||
        payload.error ||
        `Google token request failed with ${response.status}`
    );
  }

  const nextToken = {
    accessToken: payload.access_token,
    expiresAt: now + (payload.expires_in || 3600) * 1000
  };
  cachedTokens.set(scope, nextToken);
  return nextToken.accessToken;
}

export async function queueIndexingJob(url: string, type: IndexingJobType = "publish") {
  const normalizedUrl = normalizeIndexableArticleUrl(url);
  const verifiedAt = await verifyArticleForSubmission(normalizedUrl, type);
  const existing = await prisma.indexingJob.findFirst({
    where: {
      url: normalizedUrl,
      type,
      status: { in: ["pending", "processing"] }
    },
    orderBy: { createdAt: "desc" }
  });
  if (existing) return existing;

  const readiness = googleIndexingReadiness();
  return prisma.indexingJob.create({
    data: {
      url: normalizedUrl,
      type,
      status: "pending",
      attempts: 0,
      verifiedAt,
      nextAttemptAt: new Date(),
      lastError: readiness.configured ? null : readiness.message
    }
  });
}

export async function processIndexingJob(jobId: string) {
  const job = await prisma.indexingJob.findUnique({ where: { id: jobId } });
  if (!job) throw new Error("Indexing job was not found.");
  if (job.status === "success") return job;

  const readiness = googleIndexingReadiness();
  if (!readiness.configured) {
    return prisma.indexingJob.update({
      where: { id: job.id },
      data: {
        status: "pending",
        lastError: readiness.message,
        nextAttemptAt: new Date(Date.now() + 15 * 60_000)
      }
    });
  }

  const type = (job.type || "publish") as IndexingJobType;
  const nextAttempts = job.attempts + 1;
  const claimed = await prisma.indexingJob.updateMany({
    where: {
      id: job.id,
      status: { in: ["pending", "failed"] }
    },
    data: {
      status: "processing",
      attempts: nextAttempts,
      submittedAt: new Date(),
      finishedAt: null,
      lastError: null,
      responseCode: null,
      responseBody: null,
      responseTimeMs: null,
      nextAttemptAt: null
    }
  });
  if (!claimed.count) {
    return prisma.indexingJob.findUniqueOrThrow({ where: { id: job.id } });
  }

  const startedAt = Date.now();
  let responseCode: number | null = null;
  let responseBody: string | null = null;

  try {
    const verifiedAt = await verifyArticleForSubmission(job.url, type);
    const accessToken = await getAccessToken();
    const response = await fetch(GOOGLE_INDEXING_PUBLISH_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: job.url,
        type: googleType(type)
      })
    });
    const payload = await response.json().catch(() => ({}));
    responseCode = response.status;
    responseBody = serializeResponse(payload);

    if (!response.ok) {
      const errorMessage =
        typeof payload === "object" &&
        payload &&
        "error" in payload &&
        typeof payload.error === "object" &&
        payload.error &&
        "message" in payload.error
          ? String(payload.error.message)
          : `Google Indexing request failed with ${response.status}`;
      throw new Error(errorMessage);
    }

    const updated = await prisma.indexingJob.update({
      where: { id: job.id },
      data: {
        status: "success",
        lastError: null,
        responseCode,
        responseBody,
        responseTimeMs: Date.now() - startedAt,
        verifiedAt,
        nextAttemptAt: null,
        finishedAt: new Date()
      }
    });
    logInfo("google_indexing_job_success", {
      jobId: job.id,
      type,
      url: job.url,
      attempts: nextAttempts
    });
    return updated;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const updated = await prisma.indexingJob.update({
      where: { id: job.id },
      data: {
        status: "failed",
        lastError: message,
        responseCode,
        responseBody: responseBody || serializeResponse({ error: message }),
        responseTimeMs: Date.now() - startedAt,
        nextAttemptAt: nextRetryAt(nextAttempts),
        finishedAt: new Date()
      }
    });
    logError("google_indexing_job_failed", error, {
      jobId: job.id,
      type,
      url: job.url,
      attempts: nextAttempts
    });
    return updated;
  }
}

async function submitUrl(url: string, type: IndexingJobType) {
  const job = await queueIndexingJob(url, type);
  return processIndexingJob(job.id);
}

export async function publishUrl(url: string) {
  return submitUrl(url, "publish");
}

export async function updateUrl(url: string) {
  return submitUrl(url, "update");
}

export async function deleteUrl(url: string) {
  return submitUrl(url, "delete");
}

export async function batchPublish(urls: string[]) {
  return Promise.all(urls.map((url) => publishUrl(url)));
}

export async function batchUpdate(urls: string[]) {
  return Promise.all(urls.map((url) => updateUrl(url)));
}

export async function batchDelete(urls: string[]) {
  return Promise.all(urls.map((url) => deleteUrl(url)));
}

export async function retryIndexingJob(id: string) {
  const job = await prisma.indexingJob.update({
    where: { id },
    data: {
      status: "pending",
      lastError: null,
      responseCode: null,
      responseBody: null,
      responseTimeMs: null,
      nextAttemptAt: new Date(),
      finishedAt: null
    }
  });
  return processIndexingJob(job.id);
}

export async function retryFailedIndexingJobs(limit = 25) {
  const now = new Date();
  const failed = await prisma.indexingJob.findMany({
    where: {
      status: "failed",
      attempts: { lt: MAX_ATTEMPTS },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }]
    },
    orderBy: { updatedAt: "asc" },
    take: limit
  });
  const results = [];
  for (const job of failed) {
    results.push(await retryIndexingJob(job.id));
  }
  return results;
}

export async function processPendingIndexingJobs(limit = 25) {
  const now = new Date();
  await prisma.indexingJob.updateMany({
    where: {
      status: "processing",
      updatedAt: { lt: new Date(now.getTime() - 10 * 60_000) }
    },
    data: {
      status: "failed",
      lastError: "Recovered a stale processing job.",
      nextAttemptAt: now,
      finishedAt: now
    }
  });

  const jobs = await prisma.indexingJob.findMany({
    where: {
      OR: [
        {
          status: "pending",
          OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }]
        },
        {
          status: "failed",
          attempts: { lt: MAX_ATTEMPTS },
          OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }]
        }
      ]
    },
    orderBy: { updatedAt: "asc" },
    take: limit
  });

  const results = [];
  for (const job of jobs) {
    results.push(await processIndexingJob(job.id));
  }
  return {
    processed: results.length,
    success: results.filter((job) => job.status === "success").length,
    failed: results.filter((job) => job.status === "failed").length,
    pending: results.filter((job) => job.status === "pending").length
  };
}

export async function submitToGoogle(post: { slug: string }) {
  return publishUrl(absoluteUrl(`/news/${post.slug}`));
}

export const submitPublishedPostToIndexing = submitToGoogle;

export async function getUrlNotificationMetadata(url: string) {
  const readiness = googleIndexingReadiness();
  if (!readiness.configured) {
    return { ok: false, error: readiness.message };
  }
  const accessToken = await getAccessToken();
  const response = await fetch(
    `${GOOGLE_INDEXING_METADATA_URL}?url=${encodeURIComponent(normalizeIndexableArticleUrl(url))}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  );
  const payload = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, payload };
}

function verificationToken() {
  return (
    process.env.NEXT_PUBLIC_GSC_VERIFICATION ||
    process.env.GOOGLE_SITE_VERIFICATION ||
    ""
  ).trim();
}

function htmlVerificationFile() {
  const configured = process.env.GOOGLE_SITE_VERIFICATION_FILE?.trim() || "";
  if (configured) return configured.replace(/^\/+/, "");
  const token = verificationToken();
  return /^google[a-zA-Z0-9_-]+\.html$/.test(token) ? token : "";
}

export function googleSearchConsoleReadiness() {
  const token = verificationToken();
  const htmlFile = htmlVerificationFile();
  const propertyUrl =
    process.env.GOOGLE_SEARCH_CONSOLE_PROPERTY_URL?.trim() || `${siteUrl()}/`;
  return {
    propertyUrl,
    metaVerificationConfigured: Boolean(token && !token.endsWith(".html")),
    htmlVerificationConfigured: Boolean(htmlFile),
    htmlVerificationUrl: htmlFile ? absoluteUrl(`/${htmlFile}`) : null,
    serviceAccountConfigured: googleIndexingReadiness().configured,
    message: token || htmlFile
      ? "Verification proof is configured."
      : "Waiting for a Google Search Console verification token."
  };
}

export function configuredHtmlVerificationFile() {
  return htmlVerificationFile();
}

export async function googleSearchConsolePropertyStatus() {
  const readiness = googleSearchConsoleReadiness();
  if (!googleIndexingReadiness().configured) {
    return {
      checked: false,
      verified: false,
      permissionLevel: null,
      message: "Waiting for service-account credentials to verify property access."
    };
  }

  try {
    const accessToken = await getAccessToken(GOOGLE_SEARCH_CONSOLE_SCOPE);
    const response = await fetch(
      `${GOOGLE_SEARCH_CONSOLE_SITES_URL}/${encodeURIComponent(readiness.propertyUrl)}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
        signal: AbortSignal.timeout(8_000)
      }
    );
    const payload = (await response.json().catch(() => ({}))) as {
      permissionLevel?: string;
      error?: { message?: string };
    };
    const permissionLevel = payload.permissionLevel || null;
    const verified =
      response.ok &&
      Boolean(permissionLevel) &&
      permissionLevel !== "siteUnverifiedUser";
    return {
      checked: true,
      verified,
      permissionLevel,
      message: verified
        ? `Search Console property access confirmed (${permissionLevel}).`
        : payload.error?.message || `Search Console returned HTTP ${response.status}.`
    };
  } catch (error) {
    return {
      checked: true,
      verified: false,
      permissionLevel: null,
      message: error instanceof Error ? error.message : "Search Console check failed."
    };
  }
}

export async function indexingDiscoveryStatus() {
  const resources = [
    { key: "sitemap", path: "/sitemap.xml", marker: "<urlset" },
    { key: "newsSitemap", path: "/news-sitemap.xml", marker: "xmlns:news=" },
    { key: "imageSitemap", path: "/image-sitemap.xml", marker: "xmlns:image=" },
    { key: "videoSitemap", path: "/video-sitemap.xml", marker: "xmlns:video=" },
    { key: "robots", path: "/robots.txt", marker: "Sitemap:" }
  ];
  return Promise.all(
    resources.map(async (resource) => {
      const url = absoluteUrl(resource.path);
      try {
        const startedAt = Date.now();
        const response = await fetch(url, {
          cache: "no-store",
          signal: AbortSignal.timeout(8_000)
        });
        const body = await response.text();
        return {
          ...resource,
          url,
          ok: response.ok && body.includes(resource.marker),
          status: response.status,
          responseTimeMs: Date.now() - startedAt
        };
      } catch {
        return {
          ...resource,
          url,
          ok: false,
          status: 0,
          responseTimeMs: null
        };
      }
    })
  );
}

export async function indexingStats() {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const [grouped, latest, submittedToday, averageResponse, retryQueue] =
    await Promise.all([
      prisma.indexingJob.groupBy({
        by: ["status"],
        _count: { _all: true }
      }),
      prisma.indexingJob.findFirst({ orderBy: { updatedAt: "desc" } }),
      prisma.indexingJob.count({ where: { submittedAt: { gte: today } } }),
      prisma.indexingJob.aggregate({
        where: { responseTimeMs: { not: null } },
        _avg: { responseTimeMs: true }
      }),
      prisma.indexingJob.count({
        where: {
          status: { in: ["pending", "failed"] },
          attempts: { lt: MAX_ATTEMPTS }
        }
      })
    ]);
  const totals = grouped.reduce<Record<string, number>>(
    (accumulator, row) => {
      accumulator[row.status] = row._count._all;
      return accumulator;
    },
    { pending: 0, processing: 0, success: 0, failed: 0 }
  );
  const finished = (totals.success || 0) + (totals.failed || 0);
  return {
    totals,
    latest,
    submittedToday,
    retryQueue,
    successPercent: finished
      ? Math.round(((totals.success || 0) / finished) * 10_000) / 100
      : 0,
    averageResponseTimeMs: Math.round(averageResponse._avg.responseTimeMs || 0)
  };
}

export async function listIndexingJobs({
  status,
  limit = 80
}: {
  status?: string | null;
  limit?: number;
} = {}) {
  return prisma.indexingJob.findMany({
    where: status ? { status } : undefined,
    orderBy: { updatedAt: "desc" },
    take: Math.min(Math.max(limit, 1), 200)
  });
}
