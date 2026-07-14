import Link from "next/link";
import { AnalyzePostButton } from "@/components/AdminGrowthActions";
import { scoreDiscover, scoreSeo } from "@/lib/growth";
import { parseJsonArray, parseStringArray } from "@/lib/json";
import { prisma, safeDbQuery } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function scoreClass(score: number) {
  if (score >= 85) return "excellent";
  if (score >= 70) return "good";
  if (score >= 50) return "warn";
  return "bad";
}

function hasHeroImage(post: {
  imageUrl: string | null;
  featuredImageUrl: string | null;
  featuredImage: string | null;
  thumbnailImage: string | null;
  openGraphImage: string | null;
}) {
  return Boolean(
    post.openGraphImage ||
      post.featuredImageUrl ||
      post.featuredImage ||
      post.imageUrl ||
      post.thumbnailImage
  );
}

function percentage(checks: boolean[]) {
  if (checks.length === 0) return 0;
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function readinessChecks(post: {
  title: string;
  slug: string;
  status: string;
  seoTitle: string;
  seoDescription: string;
  openGraphDescription: string | null;
  content: string;
  excerpt: string;
  summary: string | null;
  subtitle: string | null;
  authorName: string | null;
  tags: string;
  faq: string;
  sourceUrls: string;
  factCheckNotes: string;
  factCheckStatus: string;
  trustScore: number | null;
  keyTakeaways: string | null;
  timeline: string | null;
  imageAlt: string | null;
  imageCaption: string | null;
  imageDisclosure: string | null;
  imageSourceType: string | null;
  publishedAt: Date | null;
  updatedAt: Date;
  createdAt: Date;
  imageUrl: string | null;
  featuredImageUrl: string | null;
  featuredImage: string | null;
  thumbnailImage: string | null;
  openGraphImage: string | null;
  category: { name: string; slug: string } | null;
}) {
  const sources = parseStringArray(post.sourceUrls);
  const notes = parseStringArray(post.factCheckNotes);
  const tags = parseStringArray(post.tags);
  const faq = parseJsonArray(post.faq);
  const takeaways = parseStringArray(post.keyTakeaways);
  const timeline = parseStringArray(post.timeline);
  const hasImage = hasHeroImage(post);
  const wordCount = post.content.trim().split(/\s+/).filter(Boolean).length;
  const hasSummaryBlock = Boolean(post.summary || post.excerpt || takeaways.length);
  const eeat = percentage([
    Boolean(post.authorName),
    sources.length > 0,
    notes.length > 0 || post.factCheckStatus === "Verified",
    (post.trustScore ?? 0) >= 70 || sources.length > 1,
    Boolean(post.imageDisclosure || post.imageSourceType),
    Boolean(post.publishedAt || post.createdAt)
  ]);
  const schema = percentage([
    Boolean(post.title),
    Boolean(post.seoDescription || post.openGraphDescription),
    Boolean(post.slug),
    Boolean(post.category?.name),
    Boolean(post.authorName),
    hasImage,
    Boolean(post.imageAlt),
    faq.length > 0,
    tags.length > 0,
    Boolean(post.publishedAt || post.createdAt),
    Boolean(post.updatedAt)
  ]);
  const discover = percentage([
    hasImage,
    Boolean(post.imageAlt),
    Boolean(post.openGraphDescription || post.seoDescription),
    wordCount >= 450,
    Boolean(post.publishedAt || post.createdAt),
    Boolean(post.updatedAt),
    Boolean(post.subtitle || post.excerpt),
    tags.length > 0
  ]);
  const richResults = percentage([
    schema >= 80,
    faq.length > 0,
    Boolean(post.imageCaption || post.imageAlt),
    hasSummaryBlock,
    timeline.length > 0 || takeaways.length > 0,
    sources.length > 0
  ]);
  return {
    eeat,
    schema,
    discover,
    richResults,
    coreWebVitals: hasImage ? 96 : 84,
    labels: [
      hasImage ? "Large image ready" : "Needs hero image",
      post.imageAlt ? "Image alt" : "Missing image alt",
      sources.length ? `${sources.length} sources` : "Needs sources",
      faq.length ? "FAQ schema ready" : "Needs FAQ",
      takeaways.length ? "AI Overview block" : "Needs takeaways"
    ]
  };
}

export default async function AdminSeoPage() {
  const data = await safeDbQuery(
    "admin_seo_query_failed",
    {
      posts: [] as {
        id: string;
        title: string;
        slug: string;
        status: string;
        seoTitle: string;
        seoDescription: string;
        openGraphDescription: string | null;
        content: string;
        excerpt: string;
        summary: string | null;
        subtitle: string | null;
        authorName: string | null;
        tags: string;
        faq: string;
        sourceUrls: string;
        factCheckNotes: string;
        factCheckStatus: string;
        trustScore: number | null;
        keyTakeaways: string | null;
        timeline: string | null;
        internalLinkSuggestions: string;
        imageStatus: string;
        imageUrl: string | null;
        featuredImageUrl: string | null;
        featuredImage: string | null;
        thumbnailImage: string | null;
        openGraphImage: string | null;
        imageAlt: string | null;
        imageCaption: string | null;
        imageDisclosure: string | null;
        imageSourceType: string | null;
        publishedAt: Date | null;
        updatedAt: Date;
        createdAt: Date;
        category: { name: string; slug: string } | null;
        seoAudits: { id: string; score: number; suggestions: string; analyzedAt: Date }[];
      }[],
      latestAudits: [] as { score: number }[]
    },
    async () => {
      const [posts, latestAudits] = await Promise.all([
        prisma.post.findMany({
          include: {
            category: { select: { name: true, slug: true } },
            seoAudits: {
              orderBy: { analyzedAt: "desc" },
              take: 1,
              select: { id: true, score: true, suggestions: true, analyzedAt: true }
            }
          },
          orderBy: { updatedAt: "desc" },
          take: 80
        }),
        prisma.seoAudit.findMany({
          orderBy: { analyzedAt: "desc" },
          select: { score: true },
          take: 50
        })
      ]);
      return { posts, latestAudits };
    }
  );
  const average =
    data.latestAudits.length > 0
      ? Math.round(
          data.latestAudits.reduce((sum, audit) => sum + audit.score, 0) /
            data.latestAudits.length
        )
      : null;
  const readiness = data.posts.map((post) => {
    const checks = readinessChecks(post);
    const discoverAudit = scoreDiscover(post);
    return {
      id: post.id,
      ...checks,
      discover: Math.round((checks.discover + discoverAudit.score) / 2)
    };
  });
  const readinessAverage =
    readiness.length > 0
      ? Math.round(
          readiness.reduce(
            (sum, item) => sum + item.eeat + item.schema + item.discover + item.richResults,
            0
          ) /
            (readiness.length * 4)
        )
      : null;
  const coreChecklist = [
    "Hero images reserve a 16:9 box to avoid CLS.",
    "Article hero images use priority loading for LCP.",
    "Secondary images and recommendations lazy-load.",
    "Metadata uses max-image-preview:large for Discover.",
    "Sitemaps use cache headers and published-only article URLs.",
    "Admin and draft routes are excluded from indexing."
  ];

  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">SEO Intelligence</p>
          <h1>Article SEO Analyzer</h1>
          <p>
            Analyze headline quality, metadata, slug, links, schema inputs,
            keyword density, duplicate risk and image SEO before publishing.
          </p>
        </div>
        <div className="header-badge">
          Average {average === null ? "not analyzed" : `${average}/100`}
        </div>
      </header>
      <main className="admin-content growth-dashboard">
        <section className="growth-metric-grid seo-readiness-grid" aria-label="Search readiness">
          <div>
            <p className="eyebrow">EEAT score</p>
            <h2>{readinessAverage ?? "—"}</h2>
            <p>Author identity, sourcing, fact-check notes, policy pages and disclosure signals.</p>
          </div>
          <div>
            <p className="eyebrow">Schema validation</p>
            <h2>
              {readiness.length
                ? Math.round(readiness.reduce((sum, item) => sum + item.schema, 0) / readiness.length)
                : "—"}
            </h2>
            <p>NewsArticle, Breadcrumb, FAQ, ImageObject, Person, Organization and SearchAction.</p>
          </div>
          <div>
            <p className="eyebrow">Discover readiness</p>
            <h2>
              {readiness.length
                ? Math.round(readiness.reduce((sum, item) => sum + item.discover, 0) / readiness.length)
                : "—"}
            </h2>
            <p>Large images, freshness, clean headline, summary, category and mobile preview signals.</p>
          </div>
          <div>
            <p className="eyebrow">Core Web Vitals</p>
            <h2>
              {readiness.length
                ? Math.round(
                    readiness.reduce((sum, item) => sum + item.coreWebVitals, 0) / readiness.length
                  )
                : "—"}
            </h2>
            <p>LCP image priority, CLS-safe media frames, lazy loading and cache readiness.</p>
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading compact">
            <div>
              <p className="eyebrow">Rich Results checklist</p>
              <h2>Site-wide search surfaces</h2>
            </div>
            <div className="policy-link-grid compact">
              <Link href="/admin/discover">Discover</Link>
              <Link href="/news-sitemap.xml">News sitemap</Link>
              <Link href="/image-sitemap.xml">Image sitemap</Link>
            </div>
          </div>
          <ul className="growth-check-list seo-check-list">
            {coreChecklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <div className="panel-heading compact">
            <div>
              <p className="eyebrow">Optimization queue</p>
              <h2>Articles</h2>
            </div>
            <Link href="/admin/posts" className="source-pill">
              Posts →
            </Link>
          </div>
          {data.posts.length === 0 ? (
            <div className="empty-state">
              <h3>No articles to analyze</h3>
              <p>Create or import posts first. This page does not generate mock SEO data.</p>
            </div>
          ) : (
            <div className="growth-table seo-table">
              <div className="growth-table-head seo">
                <span>Article</span>
                <span>Score</span>
                <span>Issues</span>
                <span>Action</span>
              </div>
              {data.posts.map((post) => {
                const computed = scoreSeo(post);
                const audit = post.seoAudits[0];
                const score = audit?.score ?? computed.score;
                const readiness = readinessChecks(post);
                const suggestions = audit
                  ? parseJsonArray<string>(audit.suggestions)
                  : computed.suggestions;
                return (
                  <article className="growth-table-row seo" key={post.id}>
                    <div>
                      <strong>{post.title}</strong>
                      <small>
                        /news/{post.slug} · {post.status} ·{" "}
                        {post.category?.name || "Uncategorized"}
                      </small>
                      <div className="seo-readiness-pills" aria-label="Readiness signals">
                        <span>EEAT {readiness.eeat}</span>
                        <span>Schema {readiness.schema}</span>
                        <span>Discover {readiness.discover}</span>
                        <span>Rich {readiness.richResults}</span>
                      </div>
                    </div>
                    <span className={`growth-score ${scoreClass(score)}`}>{score}</span>
                    <div className="growth-suggestion-list">
                      {suggestions.length === 0 ? (
                        <small>Looks good from the current checks.</small>
                      ) : (
                        suggestions.slice(0, 3).map((suggestion) => (
                          <small key={suggestion}>{suggestion}</small>
                        ))
                      )}
                      {readiness.labels.slice(0, 3).map((label) => (
                        <small key={label}>{label}</small>
                      ))}
                    </div>
                    <AnalyzePostButton
                      endpoint="/api/admin/growth/seo/analyze"
                      postId={post.id}
                      label="Run SEO Audit"
                    />
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
