import "server-only";

import { createSign } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { absoluteUrl } from "@/lib/site";
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
const MAX_ATTEMPTS = 5;

let cachedToken: TokenCache | null = null;

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

function normalizeUrl(value: string) {
  const url = new URL(absoluteUrl(value.trim()));
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only HTTP and HTTPS URLs can be submitted.");
  }
  url.hash = "";
  return url.toString();
}

function googleType(type: IndexingJobType) {
  return type === "delete" ? "URL_DELETED" : "URL_UPDATED";
}

function createServiceAccountAssertion() {
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
      scope: GOOGLE_INDEXING_SCOPE,
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

async function getAccessToken() {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt - 60_000 > now) {
    return cachedToken.accessToken;
  }

  const assertion = createServiceAccountAssertion();
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

  cachedToken = {
    accessToken: payload.access_token,
    expiresAt: now + (payload.expires_in || 3600) * 1000
  };
  return cachedToken.accessToken;
}

export async function queueIndexingJob(url: string, type: IndexingJobType = "publish") {
  const normalizedUrl = normalizeUrl(url);
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
      lastError: readiness.configured ? null : readiness.message
    }
  });
}

export async function processIndexingJob(jobId: string) {
  const job = await prisma.indexingJob.findUnique({ where: { id: jobId } });
  if (!job) throw new Error("Indexing job was not found.");

  const readiness = googleIndexingReadiness();
  if (!readiness.configured) {
    return prisma.indexingJob.update({
      where: { id: job.id },
      data: {
        status: "pending",
        lastError: readiness.message
      }
    });
  }

  const type = (job.type || "publish") as IndexingJobType;
  const nextAttempts = job.attempts + 1;
  await prisma.indexingJob.update({
    where: { id: job.id },
    data: {
      status: "processing",
      attempts: nextAttempts,
      submittedAt: new Date(),
      lastError: null
    }
  });

  try {
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

export async function retryIndexingJob(id: string) {
  const job = await prisma.indexingJob.update({
    where: { id },
    data: {
      status: "pending",
      lastError: null,
      finishedAt: null
    }
  });
  return processIndexingJob(job.id);
}

export async function retryFailedIndexingJobs(limit = 25) {
  const failed = await prisma.indexingJob.findMany({
    where: {
      status: "failed",
      attempts: { lt: MAX_ATTEMPTS }
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
  const jobs = await prisma.indexingJob.findMany({
    where: {
      OR: [
        { status: "pending" },
        { status: "failed", attempts: { lt: MAX_ATTEMPTS } }
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

export async function submitPublishedPostToIndexing(post: { slug: string }) {
  return publishUrl(absoluteUrl(`/news/${post.slug}`));
}

export async function getUrlNotificationMetadata(url: string) {
  const readiness = googleIndexingReadiness();
  if (!readiness.configured) {
    return { ok: false, error: readiness.message };
  }
  const accessToken = await getAccessToken();
  const response = await fetch(
    `${GOOGLE_INDEXING_METADATA_URL}?url=${encodeURIComponent(normalizeUrl(url))}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  );
  const payload = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, payload };
}

export async function indexingStats() {
  const grouped = await prisma.indexingJob.groupBy({
    by: ["status"],
    _count: { _all: true }
  });
  const totals = grouped.reduce<Record<string, number>>(
    (accumulator, row) => {
      accumulator[row.status] = row._count._all;
      return accumulator;
    },
    { pending: 0, processing: 0, success: 0, failed: 0 }
  );
  const latest = await prisma.indexingJob.findFirst({
    orderBy: { updatedAt: "desc" }
  });
  return { totals, latest };
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
