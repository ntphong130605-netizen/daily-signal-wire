import { prisma } from "@/lib/prisma";
import { logInfo } from "@/lib/logger";

export async function publishDueScheduledPosts(limit = 20) {
  const now = new Date();
  const due = await prisma.post.findMany({
    where: {
      status: "scheduled",
      scheduledAt: { lte: now }
    },
    select: { id: true },
    take: limit
  });

  if (due.length) {
    await prisma.post.updateMany({
      where: { id: { in: due.map((post) => post.id) } },
      data: {
        status: "published",
        publishedAt: now,
        scheduledAt: null
      }
    });
  }

  logInfo("scheduled_posts_published", { count: due.length });
  return due.length;
}
