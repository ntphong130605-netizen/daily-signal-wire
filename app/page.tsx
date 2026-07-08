import type { Prisma } from "@prisma/client";
import NewsReaderLayout, {
  type ReaderFolder,
  type ReaderStory
} from "@/components/NewsReaderLayout";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type StoryRecord = Prisma.FeedStoryGetPayload<{
  include: {
    feed: true;
    savedBy: true;
    tags: true;
  };
}>;

function normalizeView(value: string | undefined) {
  return ["list", "grid", "split", "magazine"].includes(value || "")
    ? (value as "list" | "grid" | "split" | "magazine")
    : "list";
}

function toReaderStory(story: StoryRecord): ReaderStory {
  return {
    id: story.id,
    title: story.title,
    excerpt: story.excerpt || "",
    content: story.content,
    sourceUrl: story.sourceUrl,
    imageUrl: story.imageUrl,
    publishedAt: story.publishedAt,
    fetchedAt: story.fetchedAt,
    isRead: story.isRead,
    isSaved: story.savedBy.length > 0,
    feedTitle: story.feed.title,
    feedId: story.feedId,
    folderId: story.feed.folderId,
    tags: story.tags.map((tag) => tag.name)
  };
}

export default async function HomePage({
  searchParams
}: {
  searchParams: Promise<{
    filter?: string;
    feed?: string;
    folder?: string;
    story?: string;
    q?: string;
    view?: string;
  }>;
}) {
  const params = await searchParams;
  const filter = params.filter || "all";
  const view = normalizeView(params.view);
  const baseWhere: Prisma.FeedStoryWhereInput = {
    ...(params.feed ? { feedId: params.feed } : {}),
    ...(params.folder ? { feed: { folderId: params.folder } } : {}),
    ...(params.q
      ? {
          OR: [
            { title: { contains: params.q } },
            { excerpt: { contains: params.q } },
            { feed: { title: { contains: params.q } } }
          ]
        }
      : {})
  };
  const filteredWhere: Prisma.FeedStoryWhereInput = {
    ...baseWhere,
    ...(filter === "unread" ? { isRead: false } : {}),
    ...(filter === "saved" ? { savedBy: { some: {} } } : {}),
    ...(filter === "trending"
      ? { publishedAt: { gte: new Date(Date.now() - 72 * 60 * 60 * 1000) } }
      : {})
  };

  const [
    folders,
    unreadByFeed,
    stories,
    selected,
    allCount,
    unreadCount,
    savedCount,
    trendingCount,
    draftCount
  ] = await Promise.all([
    prisma.feedFolder.findMany({
      include: {
        feeds: {
          include: { _count: { select: { stories: true } } },
          orderBy: { title: "asc" }
        }
      },
      orderBy: { name: "asc" }
    }),
    prisma.feedStory.groupBy({
      by: ["feedId"],
      where: { isRead: false },
      _count: { _all: true }
    }),
    prisma.feedStory.findMany({
      where: filteredWhere,
      include: { feed: true, savedBy: true, tags: true },
      orderBy: [{ publishedAt: "desc" }, { fetchedAt: "desc" }],
      take: 80
    }),
    params.story
      ? prisma.feedStory.findUnique({
          where: { id: params.story },
          include: { feed: true, savedBy: true, tags: true }
        })
      : Promise.resolve(null),
    prisma.feedStory.count(),
    prisma.feedStory.count({ where: { isRead: false } }),
    prisma.feedStory.count({ where: { savedBy: { some: {} } } }),
    prisma.feedStory.count({
      where: { publishedAt: { gte: new Date(Date.now() - 72 * 60 * 60 * 1000) } }
    }),
    prisma.post.count({ where: { status: "draft" } })
  ]);

  return (
    <NewsReaderLayout
      folders={folders.map((folder): ReaderFolder => ({
        id: folder.id,
        name: folder.name,
        color: folder.color,
        feeds: folder.feeds.map((feed) => ({
          id: feed.id,
          title: feed.title,
          fetchStatus: feed.fetchStatus,
          storyCount: feed._count.stories,
          unreadCount:
            unreadByFeed.find((item) => item.feedId === feed.id)?._count._all || 0
        }))
      }))}
      stories={stories.map(toReaderStory)}
      selectedStory={(selected && toReaderStory(selected)) || null}
      filters={{
        filter,
        feed: params.feed,
        folder: params.folder,
        story: params.story,
        q: params.q,
        view
      }}
      counts={{
        all: allCount,
        unread: unreadCount,
        saved: savedCount,
        trending: trendingCount
      }}
      draftCount={draftCount}
      aiConfigured={Boolean(process.env.OPENAI_API_KEY)}
    />
  );
}
