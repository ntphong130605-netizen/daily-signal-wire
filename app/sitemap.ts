import type { MetadataRoute } from "next";
import { prisma, safeDbQuery } from "@/lib/prisma";
import { absoluteUrl } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await safeDbQuery(
    "sitemap_posts_query_failed",
    [],
    () =>
      prisma.post.findMany({
        where: { status: "published" },
        select: { slug: true, updatedAt: true, publishedAt: true },
        orderBy: { publishedAt: "desc" },
        take: 500
      })
  );

  return [
    {
      url: absoluteUrl("/"),
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 1
    },
    ...posts.map((post) => ({
      url: absoluteUrl(`/news/${post.slug}`),
      lastModified: post.updatedAt || post.publishedAt || new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8
    }))
  ];
}
