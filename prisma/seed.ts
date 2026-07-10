import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

type SeedArticle = {
  category: string;
  title: string;
  slug: string;
  excerpt: string;
  image: string;
  focus: string;
  hoursAgo: number;
};

const publishedArticles: SeedArticle[] = [
  {
    category: "Technology",
    title: "Inside the Source-First Newsroom Built for a Faster News Cycle",
    slug: "inside-the-source-first-newsroom",
    excerpt:
      "Daily Signal Wire is building a publishing workflow where speed starts with better sourcing, not fewer checks.",
    image: "/editorial/source-first-newsroom.svg",
    focus: "source-first digital publishing",
    hoursAgo: 1
  },
  {
    category: "US News",
    title: "Why Search Trends Are a Starting Point — Never the Whole Story",
    slug: "search-trends-are-a-starting-point",
    excerpt:
      "A rising query can reveal public attention, but editors still need reporting, context and independent verification.",
    image: "/editorial/trend-signals.svg",
    focus: "responsible use of search trends in US news coverage",
    hoursAgo: 2
  },
  {
    category: "Media",
    title: "The Five Checks Every Breaking News Draft Should Pass",
    slug: "five-checks-for-breaking-news-drafts",
    excerpt:
      "Before a developing story reaches readers, a compact verification routine can catch weak attribution and missing context.",
    image: "/editorial/fact-check-desk.svg",
    focus: "breaking-news verification",
    hoursAgo: 4
  },
  {
    category: "Technology",
    title: "Responsible AI in the Newsroom Starts With a Human Editor",
    slug: "responsible-ai-needs-a-human-editor",
    excerpt:
      "Automation can organize research and prepare drafts, but editorial responsibility cannot be delegated to a model.",
    image: "/editorial/responsible-ai.svg",
    focus: "human oversight for newsroom AI",
    hoursAgo: 7
  },
  {
    category: "Business",
    title: "How Modern News Desks Turn a Tip Into a Publishable Story",
    slug: "from-news-tip-to-publishable-story",
    excerpt:
      "The most reliable publishing systems make ownership, source review and final approval visible at every stage.",
    image: "/editorial/news-workflow.svg",
    focus: "transparent editorial workflows",
    hoursAgo: 10
  },
  {
    category: "Money",
    title: "Reading a Money Headline Without Losing the Important Context",
    slug: "how-to-read-a-money-headline",
    excerpt:
      "Rates, prices and market moves need a time frame, a comparison point and a clear explanation of who may be affected.",
    image: "/editorial/money-context.svg",
    focus: "clear and contextual personal-finance reporting",
    hoursAgo: 14
  },
  {
    category: "Sports",
    title: "What Makes a Live Sports Update Useful Instead of Noisy",
    slug: "what-makes-live-sports-updates-useful",
    excerpt:
      "A strong live update separates confirmed results from developing information and gives readers the next meaningful marker.",
    image: "/editorial/sports-desk.svg",
    focus: "accurate live sports coverage",
    hoursAgo: 18
  },
  {
    category: "Entertainment",
    title: "Entertainment Reporting Works Better When the Source Is Clear",
    slug: "entertainment-reporting-needs-clear-sources",
    excerpt:
      "Attribution matters just as much in culture coverage, especially when rumors can travel faster than confirmed announcements.",
    image: "/editorial/culture-wire.svg",
    focus: "well-sourced entertainment reporting",
    hoursAgo: 22
  },
  {
    category: "Science",
    title: "A Practical Reader’s Guide to Early Scientific Findings",
    slug: "guide-to-early-scientific-findings",
    excerpt:
      "Sample size, peer review and the difference between correlation and causation all shape what a new study can really tell us.",
    image: "/editorial/science-context.svg",
    focus: "careful interpretation of early research",
    hoursAgo: 28
  },
  {
    category: "World",
    title: "The Value of Saying What Is Still Unknown in a Developing Story",
    slug: "what-is-still-unknown",
    excerpt:
      "Transparent uncertainty gives readers a more accurate picture and creates a clear path for responsible updates.",
    image: "/editorial/developing-story.svg",
    focus: "transparent reporting during developing events",
    hoursAgo: 34
  }
];

function articleContent(article: SeedArticle) {
  return `Daily Signal Wire approaches ${article.focus} with a simple principle: readers should be able to tell what is known, where it came from and what still needs confirmation. That standard matters most when a story is moving quickly and incomplete details can easily be repeated as fact.

## What happened

Newsrooms increasingly work across search data, source feeds, public records and direct reporting at the same time. A useful workflow turns those inputs into a reporting plan instead of treating any single signal as a finished story. Editors identify the central question, collect independent sources and separate confirmed information from working notes before a headline is written.

## Why it matters

Clarity is a form of reader service. A precise headline, a visible publication time and direct attribution help people understand both the report and its limits. The same discipline also makes corrections easier: when a claim is connected to a source, an editor can quickly update the story if better information becomes available.

## Background

Digital publishing rewards speed, but speed and accuracy are not opposites. Templates, structured review notes and clear ownership can remove avoidable delays while preserving human judgment. Automation is most useful when it handles repetitive organization and leaves factual decisions, tone and publication approval with an editor.

## What comes next

Daily Signal Wire will continue refining this workflow around a source-first standard. New tools may help surface leads or prepare drafts, but no automated system publishes on its own. Each story remains subject to source review, fact-checking and an explicit human decision before it reaches the public site.`;
}

async function seedPublishedArticles() {
  for (const article of publishedArticles) {
    const normalizedKeyword = `editorial-${article.slug}`;
    const trend = await prisma.trend.upsert({
      where: { normalizedKeyword },
      update: {
        keyword: article.title,
        category: article.category,
        generationStatus: "completed"
      },
      create: {
        keyword: article.title,
        normalizedKeyword,
        traffic: "Editorial",
        relatedQueries: JSON.stringify([
          article.focus,
          "newsroom standards",
          "reader trust"
        ]),
        sourceUrls: JSON.stringify([
          "https://www.ap.org/about/news-values-and-principles/"
        ]),
        sourceContext: JSON.stringify([
          {
            title: "AP News Values and Principles",
            source: "Associated Press",
            url: "https://www.ap.org/about/news-values-and-principles/",
            snippet:
              "Reference material for accuracy, fairness and responsible reporting."
          }
        ]),
        category: article.category,
        generationStatus: "completed",
        generatedAt: new Date()
      }
    });

    const publishedAt = new Date(Date.now() - article.hoursAgo * 60 * 60 * 1000);
    await prisma.post.upsert({
      where: { trendId: trend.id },
      update: {
        title: article.title,
        excerpt: article.excerpt,
        content: articleContent(article),
        seoTitle: `${article.title} | Daily Signal Wire`.slice(0, 70),
        seoDescription: article.excerpt.slice(0, 165),
        facebookCaption: article.excerpt,
        imageUrl: article.image,
        featuredImageUrl: article.image,
        featuredImage: article.image,
        thumbnailImage: article.image,
        openGraphImage: article.image,
        twitterImage: article.image,
        imageStatus: "accepted",
        imageAlt: `Editorial illustration for “${article.title}”`,
        imageCaption: "Daily Signal Wire editorial illustration.",
        imageDisclosure: null,
        imageSourceType: "placeholder",
        imageLicense: "Original editorial illustration",
        imageCredit: "Daily Signal Wire",
        aiGenerated: false,
        factCheckNotes: JSON.stringify([
          "Evergreen editorial seed article; no claim of a current event.",
          "Review standards and links before production use."
        ]),
        sourceUrls: JSON.stringify([
          "https://www.ap.org/about/news-values-and-principles/"
        ]),
        status: "published",
        publishedAt
      },
      create: {
        trendId: trend.id,
        title: article.title,
        slug: article.slug,
        excerpt: article.excerpt,
        content: articleContent(article),
        seoTitle: `${article.title} | Daily Signal Wire`.slice(0, 70),
        seoDescription: article.excerpt.slice(0, 165),
        facebookCaption: article.excerpt,
        imagePrompt: `Original conceptual editorial illustration about ${article.focus}; no logos, no text, not documentary photography.`,
        imageUrl: article.image,
        featuredImageUrl: article.image,
        featuredImage: article.image,
        thumbnailImage: article.image,
        openGraphImage: article.image,
        twitterImage: article.image,
        imageStatus: "accepted",
        imageAlt: `Editorial illustration for “${article.title}”`,
        imageCaption: "Daily Signal Wire editorial illustration.",
        imageDisclosure: null,
        imageSourceType: "placeholder",
        imageLicense: "Original editorial illustration",
        imageCredit: "Daily Signal Wire",
        aiGenerated: false,
        factCheckNotes: JSON.stringify([
          "Evergreen editorial seed article; no claim of a current event.",
          "Review standards and links before production use."
        ]),
        sourceUrls: JSON.stringify([
          "https://www.ap.org/about/news-values-and-principles/"
        ]),
        status: "published",
        publishedAt
      }
    });
  }
}

async function seedDraftWorkflow() {
  const trend = await prisma.trend.upsert({
    where: { normalizedKeyword: "sample-us-technology-trend" },
    update: {},
    create: {
      keyword: "Sample US technology trend",
      normalizedKeyword: "sample-us-technology-trend",
      traffic: "Demo",
      relatedQueries: JSON.stringify(["technology policy", "consumer impact"]),
      sourceUrls: JSON.stringify([
        "https://www.reuters.com/technology/",
        "https://apnews.com/technology"
      ]),
      sourceContext: JSON.stringify([
        {
          title: "Demo trend for the editorial workflow",
          source: "Daily Signal Wire demo",
          url: "https://www.reuters.com/technology/",
          snippet: "Replace this demo with live Google Trends data from the cron endpoint."
        }
      ]),
      category: "Technology",
      generationStatus: "idle"
    }
  });

  await prisma.post.upsert({
    where: { trendId: trend.id },
    update: { status: "draft", publishedAt: null },
    create: {
      trendId: trend.id,
      title: "A New Technology Story Is Taking Shape — Here’s What to Watch",
      slug: "sample-us-technology-trend",
      excerpt: "This sample draft demonstrates the fact-check and publishing workflow.",
      content:
        "## What happened\n\nThis is a demonstration draft. Generate a new article after adding an OpenAI API key.\n\n## Why it matters\n\nEvery AI-assisted story remains a draft until an editor verifies its sources and claims.\n\n## Background\n\nDaily Signal Wire keeps source links and fact-check notes beside the article.\n\n## What comes next\n\nAn editor should replace this sample, review every claim and approve the final image.",
      seoTitle: "Sample Technology Trend | Daily Signal Wire",
      seoDescription:
        "A demonstration of Daily Signal Wire's AI-assisted editorial review workflow.",
      facebookCaption:
        "A technology story is developing. Here is what editors are watching.",
      imagePrompt:
        "Editorial illustration of an abstract technology news cycle, modern American newsroom style, clearly illustrative, not documentary photography, no logos, no text.",
      imageSourceType: "placeholder",
      imageStatus: "idle",
      aiGenerated: true,
      factCheckNotes: JSON.stringify([
        "DEMO ONLY: Replace with a generated article and verify every factual claim.",
        "Fact-check before publishing."
      ]),
      sourceUrls: JSON.stringify([
        "https://www.reuters.com/technology/",
        "https://apnews.com/technology"
      ])
    }
  });
}

const readerCategories = [
  ["US News", "National headlines and civic reporting."],
  ["Technology", "Technology, platforms and AI coverage."],
  ["Money", "Markets, business and consumer-finance signals."],
  ["Entertainment", "Culture, media and entertainment feeds."],
  ["Sports", "Sports headlines and live-update sources."]
] as const;

const readerFolders = [
  { name: "Top Sources", slug: "top-sources", color: "#22a6b3" },
  { name: "Tech Watch", slug: "tech-watch", color: "#6c5ce7" },
  { name: "Money Desk", slug: "money-desk", color: "#00b894" },
  { name: "Culture & Sports", slug: "culture-sports", color: "#e17055" }
];

const readerFeeds = [
  {
    folder: "top-sources",
    category: "US News",
    title: "AP Top News",
    slug: "ap-top-news",
    siteUrl: "https://apnews.com/",
    feedUrl: "https://apnews.com/hub/ap-top-news?output=rss",
    description: "Sample source entry for top US and world headlines."
  },
  {
    folder: "top-sources",
    category: "US News",
    title: "Reuters US News",
    slug: "reuters-us-news",
    siteUrl: "https://www.reuters.com/world/us/",
    feedUrl: "https://www.reutersagency.com/feed/?best-topics=political-general&post_type=best",
    description: "Sample source entry for US news monitoring."
  },
  {
    folder: "tech-watch",
    category: "Technology",
    title: "TechCrunch",
    slug: "techcrunch",
    siteUrl: "https://techcrunch.com/",
    feedUrl: "https://techcrunch.com/feed/",
    description: "Technology startup and platform signals."
  },
  {
    folder: "tech-watch",
    category: "Technology",
    title: "Wired",
    slug: "wired",
    siteUrl: "https://www.wired.com/",
    feedUrl: "https://www.wired.com/feed/rss",
    description: "Technology, science and digital culture reading queue."
  },
  {
    folder: "money-desk",
    category: "Money",
    title: "Marketplace",
    slug: "marketplace",
    siteUrl: "https://www.marketplace.org/",
    feedUrl: "https://www.marketplace.org/feed/",
    description: "Business and consumer-economy context."
  },
  {
    folder: "culture-sports",
    category: "Entertainment",
    title: "NPR Arts & Life",
    slug: "npr-arts-life",
    siteUrl: "https://www.npr.org/sections/arts/",
    feedUrl: "https://feeds.npr.org/1008/rss.xml",
    description: "Culture and entertainment reading queue."
  }
];

const storyTemplates = [
  {
    title: "Editors flag a fast-moving story for source review",
    excerpt:
      "This seeded RSS item shows how a headline enters the reader queue before any AI draft is created.",
    image: "/editorial/source-first-newsroom.svg",
    tag: "verification"
  },
  {
    title: "A reader-friendly context note helps separate signal from noise",
    excerpt:
      "The feed stores metadata, source URL and a short summary while sending readers to the original publisher.",
    image: "/editorial/trend-signals.svg",
    tag: "context"
  },
  {
    title: "Newsroom teams compare trend data with primary source links",
    excerpt:
      "Trend signals can inspire coverage, but editors still need independent sourcing before publishing.",
    image: "/editorial/fact-check-desk.svg",
    tag: "trends"
  },
  {
    title: "Saved stories become a queue for human-reviewed article drafts",
    excerpt:
      "A saved story can later be converted into an original draft with source URLs and fact-check notes attached.",
    image: "/editorial/news-workflow.svg",
    tag: "saved"
  }
];

async function seedReaderData() {
  const categoryByName = new Map<string, string>();
  for (const [name, description] of readerCategories) {
    const category = await prisma.category.upsert({
      where: { slug: slugify(name) },
      update: { name, description },
      create: { name, slug: slugify(name), description }
    });
    categoryByName.set(name, category.id);
  }

  const folderBySlug = new Map<string, string>();
  for (const folder of readerFolders) {
    const savedFolder = await prisma.feedFolder.upsert({
      where: { slug: folder.slug },
      update: { name: folder.name, color: folder.color },
      create: folder
    });
    folderBySlug.set(folder.slug, savedFolder.id);
  }

  const demoUser = await prisma.user.upsert({
    where: { email: "admin@dailysignalwire.local" },
    update: { name: "Daily Signal Wire Admin", role: "admin" },
    create: {
      email: "admin@dailysignalwire.local",
      name: "Daily Signal Wire Admin",
      role: "admin"
    }
  });

  const tags = new Map<string, string>();
  for (const template of storyTemplates) {
    const tag = await prisma.storyTag.upsert({
      where: { slug: slugify(template.tag) },
      update: { name: template.tag },
      create: { name: template.tag, slug: slugify(template.tag) }
    });
    tags.set(template.tag, tag.id);
  }

  for (const feedSeed of readerFeeds) {
    const feed = await prisma.feed.upsert({
      where: { feedUrl: feedSeed.feedUrl },
      update: {
        title: feedSeed.title,
        slug: feedSeed.slug,
        siteUrl: feedSeed.siteUrl,
        description: feedSeed.description,
        folderId: folderBySlug.get(feedSeed.folder),
        categoryId: categoryByName.get(feedSeed.category),
        active: true,
        fetchStatus: "completed",
        lastFetchedAt: new Date()
      },
      create: {
        title: feedSeed.title,
        slug: feedSeed.slug,
        siteUrl: feedSeed.siteUrl,
        feedUrl: feedSeed.feedUrl,
        description: feedSeed.description,
        folderId: folderBySlug.get(feedSeed.folder),
        categoryId: categoryByName.get(feedSeed.category),
        active: true,
        fetchStatus: "completed",
        lastFetchedAt: new Date()
      }
    });

    for (const [index, template] of storyTemplates.entries()) {
      const publishedAt = new Date(
        Date.now() - (index * 5 + readerFeeds.indexOf(feedSeed) + 1) * 60 * 60 * 1000
      );
      const story = await prisma.feedStory.upsert({
        where: { externalId: `seed-${feedSeed.slug}-${index}` },
        update: {
          title: `${template.title} · ${feedSeed.title}`,
          excerpt: template.excerpt,
          sourceUrl: feedSeed.siteUrl,
          imageUrl: template.image,
          publishedAt,
          tags: { set: [{ id: tags.get(template.tag)! }] }
        },
        create: {
          feedId: feed.id,
          externalId: `seed-${feedSeed.slug}-${index}`,
          title: `${template.title} · ${feedSeed.title}`,
          slug: slugify(`${template.title}-${feedSeed.title}`),
          excerpt: template.excerpt,
          sourceUrl: feedSeed.siteUrl,
          imageUrl: template.image,
          publishedAt,
          tags: { connect: [{ id: tags.get(template.tag)! }] }
        }
      });

      if (index === 0 && readerFeeds.indexOf(feedSeed) < 2) {
        await prisma.savedStory.upsert({
          where: {
            storyId_userId: {
              storyId: story.id,
              userId: demoUser.id
            }
          },
          update: {},
          create: { storyId: story.id, userId: demoUser.id }
        });
      }
    }
  }

  for (const slot of [
    ["reader-top", "Reader top banner", "reader"],
    ["reader-sidebar", "Reader sidebar", "sidebar"],
    ["article-middle", "Article middle", "article"]
  ] as const) {
    await prisma.adSlot.upsert({
      where: { key: slot[0] },
      update: { label: slot[1], placement: slot[2], enabled: true },
      create: { key: slot[0], label: slot[1], placement: slot[2], enabled: true }
    });
  }
}

async function main() {
  await seedReaderData();
  await seedPublishedArticles();
  await seedDraftWorkflow();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
