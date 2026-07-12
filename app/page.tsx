import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import NewsReaderLayout, {
  type ReaderFolder,
  type ReaderStory
} from "@/components/NewsReaderLayout";
import type { ReaderPost } from "@/components/ArticleCard";
import { normalizeEditorialImageUrl, placeholderImageForCategory } from "@/lib/editorialImages";
import { prisma, safeDbQuery } from "@/lib/prisma";
import { absoluteUrl, siteDescription, siteName } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${siteName} | AI-assisted US news, trends and source-first reporting`,
  description: siteDescription(),
  keywords: [
    "Daily Signal Wire",
    "AI newsroom",
    "US news",
    "Google Trends news",
    "RSS reader",
    "breaking news",
    "technology news",
    "business news"
  ],
  alternates: {
    canonical: absoluteUrl("/")
  },
  openGraph: {
    title: `${siteName} | Source-first AI newsroom`,
    description: siteDescription(),
    url: absoluteUrl("/"),
    siteName,
    type: "website",
    images: [
      {
        url: absoluteUrl("/editorial/ai/newsroom.jpg"),
        width: 1600,
        height: 900,
        alt: "Daily Signal Wire newsroom"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteName} | Source-first AI newsroom`,
    description: siteDescription(),
    images: [absoluteUrl("/editorial/ai/newsroom.jpg")]
  }
};

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

function parseStringArray(value: string | null | undefined) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function toReaderStory(story: StoryRecord): ReaderStory {
  return {
    id: story.id,
    title: story.title,
    excerpt: story.excerpt || "",
    content: story.content,
    sourceUrl: story.sourceUrl,
    imageUrl: normalizeEditorialImageUrl(story.imageUrl, story.feed.title),
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

  const {
    folders,
    unreadByFeed,
    stories,
    selected,
    allCount,
    unreadCount,
    savedCount,
    trendingCount,
    draftCount,
    publishedPosts
  } = await safeDbQuery(
    "home_reader_query_failed",
    {
      folders: [],
      unreadByFeed: [],
      stories: [],
      selected: null,
      allCount: 0,
      unreadCount: 0,
      savedCount: 0,
      trendingCount: 0,
      draftCount: 0,
      publishedPosts: []
    } as {
      folders: Array<{
        id: string;
        name: string;
        color: string | null;
        feeds: Array<{
          id: string;
          title: string;
          fetchStatus: string;
          _count: { stories: number };
        }>;
      }>;
      unreadByFeed: Array<{ feedId: string; _count: { _all: number } }>;
      stories: StoryRecord[];
      selected: StoryRecord | null;
      allCount: number;
      unreadCount: number;
      savedCount: number;
      trendingCount: number;
      draftCount: number;
      publishedPosts: ReaderPost[];
    },
    async () => {
      const [
        folders,
        unreadByFeed,
        stories,
        selected,
        allCount,
        unreadCount,
        savedCount,
        trendingCount,
        draftCount,
        publishedPosts
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
        prisma.post.count({ where: { status: "draft" } }),
        prisma.post.findMany({
          where: { status: "published" },
          include: {
            trend: { select: { category: true } },
            category: { select: { name: true } },
            sourceStory: { include: { feed: { select: { title: true } } } }
          },
          orderBy: { publishedAt: "desc" },
          take: 24
        })
      ]);

      return {
        folders,
        unreadByFeed,
        stories,
        selected,
        allCount,
        unreadCount,
        savedCount,
        trendingCount,
        draftCount,
        publishedPosts: publishedPosts.map((post) => {
          const category = post.category?.name || post.trend?.category || "Latest";
          return {
            id: post.id,
            slug: post.slug,
            title: post.title,
            subtitle: post.subtitle,
            excerpt: post.excerpt,
            summary: post.summary,
            imageUrl: normalizeEditorialImageUrl(
              post.featuredImageUrl ||
                post.featuredImage ||
                post.imageUrl ||
                post.thumbnailImage ||
                placeholderImageForCategory(category),
              category
            ),
            imageAlt: post.imageAlt || "",
            category,
            source: post.sourceStory?.feed?.title || "Daily Signal Wire",
            tags: parseStringArray(post.tags),
            relatedCount: Math.max(0, publishedPosts.length - 1),
            publishedAt: post.publishedAt,
            createdAt: post.createdAt
          };
        })
      };
    }
  );

  const homepageJsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: siteName,
      url: absoluteUrl("/"),
      description: siteDescription(),
      isPartOf: {
        "@type": "WebSite",
        name: siteName,
        url: absoluteUrl("/")
      }
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "Latest Daily Signal Wire reports",
      itemListElement: publishedPosts.slice(0, 10).map((post, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: absoluteUrl(`/news/${post.slug}`),
        name: post.title
      }))
    }
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homepageJsonLd) }}
      />
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
        publishedPosts={publishedPosts}
      />
    </>
  );
}
