import type { MetadataRoute } from "next";
import { parseStringArray } from "@/lib/json";
import { prisma, safeDbQuery } from "@/lib/prisma";
import { absoluteUrl } from "@/lib/site";
import { slugify } from "@/lib/slug";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages = [
    "/about",
    "/contact",
    "/privacy-policy",
    "/cookie-policy",
    "/terms",
    "/editorial-policy",
    "/ai-content-policy",
    "/dmca"
  ];
  const posts = await safeDbQuery(
    "sitemap_posts_query_failed",
    [],
    () =>
      prisma.post.findMany({
        where: { status: "published" },
        select: { slug: true, updatedAt: true, publishedAt: true, tags: true },
        orderBy: { publishedAt: "desc" },
        take: 500
      })
  );
  const tags = [
    ...new Set(
      posts
        .flatMap((post) => parseStringArray(post.tags))
        .map((tag) => slugify(tag))
        .filter(Boolean)
    )
  ];

  return [
    {
      url: absoluteUrl("/"),
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 1
    },
    ...staticPages.map((path) => ({
      url: absoluteUrl(path),
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.5
    })),
    ...posts.map((post) => ({
      url: absoluteUrl(`/news/${post.slug}`),
      lastModified: post.updatedAt || post.publishedAt || new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8
    })),
    ...tags.map((tag) => ({
      url: absoluteUrl(`/tag/${tag}`),
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.45
    }))
  ];
}
