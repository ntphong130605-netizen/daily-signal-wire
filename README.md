# Daily Signal Wire

Daily Signal Wire is a full-stack news reader and AI-assisted newsroom built
with Next.js, TypeScript, Prisma and SQLite local fallback.

It combines:

- a three-column RSS reader inspired by professional news readers
- Google Trends US idea monitoring
- AI-assisted original article drafts
- admin review before publishing
- safe AdSense placeholders in development
- a Growth & Revenue Platform for content planning, distribution queues,
  SEO/Discover audits, analytics, monitoring and revenue readiness

The system does not copy publisher articles into the site. RSS stories store
metadata such as title, excerpt, URL, source, time and image when the feed
supplies it. AI output is saved as draft only.

## Quick start

Requirements: Node.js 20+ and npm.

```bash
npm install
cp .env.example .env
npx prisma generate
npx prisma migrate dev
npm run seed
npm run dev
```

Open:

- Reader: <http://localhost:3000>
- Admin: <http://localhost:3000/admin>
- Feeds: <http://localhost:3000/admin/feeds>
- Stories: <http://localhost:3000/admin/stories>
- Posts: <http://localhost:3000/admin/posts>
- Image Studio: <http://localhost:3000/admin/image-studio>
- Publishing Center: <http://localhost:3000/admin/publishing>
- Growth Center: <http://localhost:3000/admin/growth>
- Planner: <http://localhost:3000/admin/planner>
- Distribution: <http://localhost:3000/admin/distribution>
- SEO: <http://localhost:3000/admin/seo>
- Discover: <http://localhost:3000/admin/discover>
- Revenue: <http://localhost:3000/admin/revenue>
- Analytics: <http://localhost:3000/admin/analytics>
- Monitoring: <http://localhost:3000/admin/monitoring>
- System: <http://localhost:3000/admin/system>
- Checklist: <http://localhost:3000/admin/checklist>
- Trends: <http://localhost:3000/admin/trends>
- Settings: <http://localhost:3000/admin/settings>

If port 3000 is already in use:

```bash
npm run dev -- -p 3001
```

Then open <http://localhost:3001>.

## Environment variables

Copy `.env.example` to `.env`.

```env
NEXT_PUBLIC_SITE_URL=http://localhost:3000
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET=replace-with-a-nextauth-secret-before-production
NEXTAUTH_URL=http://localhost:3000

OPENAI_API_KEY=
AI_MODEL=gpt-5.5
IMAGE_MODEL=gpt-image-1
IMAGE_GENERATION_COST_USD=
CRON_SECRET=replace-with-a-long-random-string
IMAGE_STORAGE=local
BLOB_READ_WRITE_TOKEN=

NEXT_PUBLIC_ADSENSE_CLIENT_ID=
ADSENSE_PUBLISHER_ID=
NEXT_PUBLIC_ADSENSE_SLOT_TOP=
NEXT_PUBLIC_ADSENSE_SLOT_IN_ARTICLE=
NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR=
NEXT_PUBLIC_ADSENSE_SLOT_BOTTOM=

NEXT_PUBLIC_GA_MEASUREMENT_ID=
NEXT_PUBLIC_GTM_ID=
NEXT_PUBLIC_CLARITY_PROJECT_ID=
NEXT_PUBLIC_GSC_VERIFICATION=
GOOGLE_SITE_VERIFICATION=
ADSENSE_ESTIMATED_RPM=
GOOGLE_INDEXING_ENABLED=false
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_PRIVATE_KEY=

ADMIN_PASSWORD=choose-a-strong-password
ADMIN_SESSION_SECRET=replace-with-at-least-32-random-characters
MAX_TRENDS_PER_RUN=5
EDITORIAL_TIMEZONE=America/New_York

FACEBOOK_PAGE_ACCESS_TOKEN=
FACEBOOK_PAGE_ID=
X_API_KEY=
X_ACCESS_TOKEN=
LINKEDIN_ACCESS_TOKEN=
PINTEREST_ACCESS_TOKEN=
THREADS_ACCESS_TOKEN=
BLUESKY_IDENTIFIER=
BLUESKY_APP_PASSWORD=
RESEND_API_KEY=
NEWSLETTER_FROM_EMAIL=

RESEARCH_REGION=US
RESEARCH_LANGUAGE=en-US
RESEARCH_MAX_CANDIDATES_PER_RUN=25
RESEARCH_MAX_SOURCES_PER_CANDIDATE=8
RESEARCH_MIN_TREND_SCORE=55
RESEARCH_AI_ENRICHMENT_LIMIT=10
RESEARCH_SOURCE_TIMEOUT_MS=10000
REDDIT_CLIENT_ID=
REDDIT_CLIENT_SECRET=
YOUTUBE_API_KEY=
```

Never commit `.env` or expose server secrets in client components.

## Database and seed data

Local development uses SQLite:

```env
DATABASE_URL="file:./dev.db"
```

The seed command is idempotent:

```bash
npm run seed
```

It creates:

- feed folders
- sample RSS sources
- sample feed stories
- saved stories and tags
- ad slot records
- published editorial posts
- one AI draft sample
- admin demo user metadata

Production uses a separate PostgreSQL schema file:

```text
prisma/schema.postgres.prisma
```

Vercel runs `npm run build:vercel`, which syncs the PostgreSQL schema with
`prisma db push`, generates Prisma Client from `prisma/schema.postgres.prisma`,
and then builds Next.js. Local development keeps `prisma/schema.prisma` on
SQLite.

### Neon or Supabase production database

1. Create a PostgreSQL project in Neon or Supabase.
2. Copy the pooled connection string.
3. Add it in Vercel Project Settings → Environment Variables:

```env
DATABASE_URL="postgresql://..."
NEXT_PUBLIC_SITE_URL=https://daily-signal-wire.vercel.app
NEXTAUTH_URL=https://daily-signal-wire.vercel.app
NEXTAUTH_SECRET=generate-a-long-random-secret
ADMIN_PASSWORD=choose-a-strong-password
ADMIN_SESSION_SECRET=generate-another-long-random-secret
CRON_SECRET=generate-a-long-random-secret
IMAGE_STORAGE=blob
BLOB_READ_WRITE_TOKEN=vercel-blob-token
```

4. From a production-capable shell with the same `DATABASE_URL`, run:

```bash
npm run db:generate:prod
npm run db:push:prod
npm run db:seed:prod
```

`db:push:prod` applies the Prisma data model to the PostgreSQL database. Vercel
also runs this during `build:vercel` so newly added non-destructive columns are
available before the deployed app starts. Use a managed migration workflow
before large schema changes on a live production database.

If `DATABASE_URL` is missing, public pages, admin pages and `/api/health` do not
crash. They render empty/degraded states until a production database is attached.

## RSS reader

The homepage is a three-column reader:

1. left column: folders, RSS sources, Add Feed, filters
2. middle column: story list with List/Grid/Split/Magazine modes and search
3. right column: selected story, cover image, excerpt, source link and actions

Supported actions:

- Add RSS feed by feed URL or website URL
- Auto-detect RSS/Atom from website `<link rel="alternate">`
- Mark read/unread
- Save story
- Tag story
- Share story
- Copy Facebook post
- Convert selected story to AI article draft
- Import/export OPML

RSS cron endpoint:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/feeds
```

`vercel.json` uses a once-per-day RSS cron schedule so Hobby deployments pass
Vercel's cron limits. If the project is on Vercel Pro, you can change the
schedule back to `*/30 * * * *`.

Google Indexing queue cron:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/indexing
```

The endpoint is safe to run every 15 minutes, but the checked-in `vercel.json`
uses a once-per-day schedule so the current Vercel Hobby project can deploy.
If the project is upgraded to Vercel Pro, change the indexing schedule to
`*/15 * * * *`; otherwise call `/api/cron/indexing` every 15 minutes from an
external cron service with the `Authorization: Bearer $CRON_SECRET` header.

## AI research engine

The Step 3.1 research engine creates source-first Research Candidates and
Research Briefs before the article-writing workflow starts.

Admin route:

```text
/admin/research
```

Protected cron endpoint:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/research
```

The engine reads from adapter sources:

- Google Trends US
- Google News RSS
- saved RSS feed stories
- Reddit, only when `REDDIT_CLIENT_ID` and `REDDIT_CLIENT_SECRET` are present
- YouTube, only when `YOUTUBE_API_KEY` is present
- internal published Daily Signal Wire content signals

Disabled adapters never throw. Failed adapters are isolated per run and appear
in `/api/health`. The engine deduplicates by external ID, normalized topic,
canonical URL and title similarity, with optional semantic similarity when
`OPENAI_API_KEY` is configured.

Research output is not an article. It stores topic, angles, why the topic is
trending, verified/uncertain claims, timeline, entities, related queries, source
URLs, credibility tiers, score breakdown, fact-check notes, risk level and a
recommended action. Blocked candidates cannot be sent to draft generation.

Clicking `Generate Article Draft` from `/admin/research` only transfers the
brief into the existing `/admin/trends` draft workflow. It does not write the
article immediately and never auto-publishes.

## AI Journalist

Phase 3.2 adds the AI Journalist workflow:

```text
Research Brief → AI Journalist Draft → Editor Preview/Edit → Approve/Publish
```

Admin route:

```text
/admin/writer
```

Protected admin API endpoints:

```text
POST /api/ai/write
POST /api/ai/rewrite
POST /api/ai/headline
POST /api/ai/meta
POST /api/ai/faq
```

`/api/ai/write` accepts either a `researchCandidateId` or a `trendId` and
creates a draft post only. It also queues the existing AI editorial image
pipeline after the draft is saved. It never publishes.

`/api/ai/rewrite` can rewrite only one section at a time:

- headline
- lead
- body
- faq
- meta
- summary

Supported tones:

- Neutral
- Business
- Breaking
- Analysis

The writer stores draft version, revision history, token usage, generation
time, prompt version, quality metadata, key takeaways, timeline, related topics
and internal link suggestions. Before saving, generated drafts are checked for
word count, duplicate paragraphs, repeated sentences, SEO score, heading
hierarchy and broken markdown.

## Google Trends and AI drafts

Google Trends cron endpoint:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/trends
```

`vercel.json` uses a once-per-day Google Trends cron schedule so Hobby
deployments pass Vercel's cron limits. If the project is on Vercel Pro, you can
change the schedule back to `0 */3 * * *`.

Admins can also import the latest US trend signals manually from:

```text
/admin/trends
```

The `Refresh Google Trends` action fetches Google Trends US and saves new
trends as idle signals. If the upstream feed fails, the app logs the error and
does not create fake trend data. It does not publish or overwrite stories
automatically.

If Google Trends, Google News or any RSS source fails, the app logs the error
and keeps running. Missing API keys never crash the site.

If `OPENAI_API_KEY` is empty:

- Generate buttons are disabled or return a clear configuration message
- Trends are saved as idle signals
- RSS stories remain readable metadata

When configured, AI article drafts include:

- title
- slug
- excerpt
- content
- SEO title
- meta description
- Facebook caption
- image prompt
- category
- source URLs
- fact-check notes

AI drafts are never published directly from generation. Editors must review,
approve and either publish immediately or schedule through the admin area.

## Auto Publisher

Admin route:

```text
/admin/publishing
```

Workflow:

```text
Research → AI Writer → Fact Check → AI Image → Draft
→ Editor Review → Approved → Scheduled/Publish Now → Published
```

Supported statuses:

- `draft`
- `pending_review`
- `approved`
- `scheduled`
- `publishing`
- `published`
- `rejected`
- `archived`

The Publishing Center shows upcoming posts, scheduled queue, published today,
failed publishes, draft count, approval queue, editorial notifications and
per-post status/approval history.

Protected scheduled publish endpoint:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/publish
```

Cron only publishes a scheduled post when all pre-publish checks pass:

- editor approval exists
- hero image exists and is accepted
- fact-check status is `Verified` for AI-generated articles
- trust score is at least 75 for AI-generated articles
- slug is unique
- SEO title, meta description, OpenGraph description and canonical URL exist
- FAQ and JSON-LD inputs are ready

If a check fails, the article remains unpublished and an editorial notification
is stored for review.

## Growth & Revenue Platform

Phase 4.0 adds a business operations layer inside Admin. It does not replace the
existing CMS, AI writer, fact checker, image studio, search, SEO or AdSense
workflows.

Admin routes:

- `/admin/growth` unified business command center
- `/admin/planner` AI Content Planner and seven-day publishing calendar
- `/admin/distribution` Traffic Engine and distribution queue
- `/admin/social` AI Social Distribution Platform and social queue
- `/admin/seo` SEO Intelligence analyzer
- `/admin/discover` Google Discover optimizer
- `/admin/revenue` Revenue Center and AI revenue recommendations
- `/admin/analytics` Analytics Center
- `/admin/monitoring` System Status
- `/admin/system` Production Readiness Dashboard
- `/admin/checklist` live production launch checklist

The planner builds schedules from real saved inputs:

- Google Trends records
- evergreen editorial topics
- existing category balance

It supports drag-and-drop rescheduling, priority, status and timezone metadata.

The production Distribution Center supports queueing jobs for:

- Facebook
- X
- LinkedIn
- Pinterest
- Threads
- Bluesky
- RSS
- Email newsletter

External networks require official API/OAuth credentials. If credentials are
missing, jobs are marked `waiting_credentials` with `Credential Missing` in
Admin and the app never fakes a successful social post. RSS distribution
becomes live through `/rss.xml` when the article is published.

The queue at `/admin/distribution` is created automatically when an article is
published. The legacy `/admin/social` view remains available. The engine
generates platform-specific copy, five factual headline styles, five CTA
versions, ten hashtags, professional/casual/emoji variants, UTM tracking links,
platform image crops, click-tracking URLs, A/B variants and durable action logs
for:

- Facebook Page
- X (Twitter)
- Threads
- LinkedIn Company Page
- Pinterest
- Bluesky
- Newsletter through Resend
- RSS push

Missing credentials never crash the site. Jobs remain in
`waiting_credentials` until the relevant official platform credentials are
added. RSS jobs are marked live through `/rss.xml`.

Queue states include `preparing`, `queued`, `scheduled`, `publishing`,
`published`, `retry`, `failed`, `paused`, `cancelled`,
`waiting_credentials` and `waiting_audience`. Editors can publish immediately,
schedule in a named timezone, choose priority, configure daily/weekly/monthly
recurrence, pause/resume the whole queue or a single job, select an A/B copy
variant and retry failures with exponential backoff.

The publish workflow attempts configured immediate platform deliveries after
the article is live. Future schedules and retries are processed by:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://daily-signal-wire.vercel.app/api/cron/social
```

On Vercel Hobby, the existing daily publish cron also processes the social
queue. For minute-level schedules, call `/api/cron/social` from a trusted
external scheduler or use a Vercel plan that supports a more frequent cron.

Protected distribution cron endpoint:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/distribution
```

Optional distribution environment variables:

```env
FACEBOOK_PAGE_ACCESS_TOKEN=
FACEBOOK_PAGE_ID=
FACEBOOK_GRAPH_API_VERSION=
X_API_KEY=
X_ACCESS_TOKEN=
LINKEDIN_ACCESS_TOKEN=
LINKEDIN_ORGANIZATION_URN=
LINKEDIN_COMPANY_ID=
LINKEDIN_API_VERSION=202605
PINTEREST_ACCESS_TOKEN=
PINTEREST_BOARD_ID=
THREADS_ACCESS_TOKEN=
THREADS_USER_ID=
BLUESKY_IDENTIFIER=
BLUESKY_APP_PASSWORD=
RESEND_API_KEY=
NEWSLETTER_FROM_EMAIL=
EDITORIAL_TIMEZONE=America/New_York
```

`LINKEDIN_ORGANIZATION_URN`, `LINKEDIN_COMPANY_ID`, `PINTEREST_BOARD_ID` and
`THREADS_USER_ID` are optional in local development but required for actual
publishing to those company/page destinations.

SEO Intelligence checks headline length, meta description, slug quality,
content depth, keyword density, internal links, source links, schema inputs,
image SEO and duplicate paragraph risk. Discover optimization scores freshness,
entity clarity, image readiness and headline quality.

Revenue Center uses tracked pageviews and optional imported revenue metrics. If
you set `ADSENSE_ESTIMATED_RPM`, the dashboard displays an internal estimate:

```env
ADSENSE_ESTIMATED_RPM=12.50
```

Leave it empty unless you want an internal planning estimate. The app does not
invent revenue or call Google AdSense APIs without an official OAuth/API
integration.

Analytics Center stores privacy-safe internal events only after analytics
consent. It creates anonymous local visitor/session IDs, but does not store IP
addresses. Tracked internal events include page views, article views, searches,
scroll depth, time on page, AI article generation, AI image generation, publish
actions and Facebook copy actions.

## AI image generation

After an AI article draft is created from Google Trends or an RSS story, the app
attempts to generate an editorial image automatically when `OPENAI_API_KEY` is
configured.

Generated images now run through the full editorial image pipeline:

```text
AI article → topic/category/entities/location/time analysis → prompt builder
→ image generation → quality validation → responsive variants
→ storage → SEO metadata → draft attachment → admin review
```

The prompt builder analyzes headline, subtitle, summary, category, tags,
entities, country, time period and tone, then applies category-specific
composition rules for Technology, Business, Finance, Sports, Health, Science,
Politics, World and Entertainment. It also supports Climate, Education,
Culture, Lifestyle, Travel and general Editorial fallbacks.

Generated images are resized into responsive landscape 16:9 assets:

- `1200x675` for thumbnail/Twitter image
- `1600x900` for featured/OpenGraph image
- WebP and AVIF sidecar variants for CDN/browser optimization

Local development defaults to filesystem storage under `public/generated`.
Production should use Vercel Blob so generated images are stored as public URLs
instead of base64 database payloads.

```env
BLOB_READ_WRITE_TOKEN=...
IMAGE_STORAGE=blob
IMAGE_GENERATION_COST_USD=
```

`IMAGE_GENERATION_COST_USD` is optional. If you set it to your current estimated
per-image OpenAI cost, Image Studio stores and displays that estimate. If it is
empty, the app records generation time but shows cost as “not configured”
instead of inventing a number.

Use `IMAGE_STORAGE=local` only when the runtime has a persistent writable
filesystem. If Blob is not configured in production, the app still saves the
article draft, marks `imageStatus=failed`, shows a category fallback image,
and lets an editor retry after storage is configured.

Each post stores:

- `imagePrompt`
- final prompt in `GeneratedImage.finalPrompt`
- `imageModel`
- `imageGeneratedAt`
- `imageStatus`
- `imageUrl`
- `featuredImageUrl`
- `featuredImage`
- `thumbnailImage`
- `openGraphImage`
- `twitterImage`
- `imageStorage`
- `imageAlt`
- `imageCaption`
- `imageDisclosure`
- `imageSourceType`
- image width/height/format, source type, illustrative flag and validation
  notes in `GeneratedImage`
- generation cost estimate, generation time, prompt version and prompt template
  in `GeneratedImage`

The admin visual desk supports:

- `/admin/image-studio` queue with prompt log, generated image, retry,
  generation cost and generation time
- Generate Image
- Regenerate
- Edit Prompt
- Preview
- Accept Image
- Reject / remove current image
- Remove Image
- Upload / replace image
- Paste licensed image URL
- Retry after failure
- Compare generated/uploaded/licensed image versions
- Use version
- Delete version history record
- Download image

The Prisma model also includes `GeneratedImage` for image generation audit
metadata and `SiteSetting` for future runtime configuration records.

If `OPENAI_API_KEY` is missing, image generation buttons are disabled or return
a clear configuration message. The website does not crash.

Editorial image policy:

- no watermark
- no readable text
- no logo
- no border or frame
- landscape 16:9
- realistic editorial news photography style
- do not create fake documentary photos of real events
- for real-world events, public figures, disasters, elections, wars or ongoing
  news, use a clearly illustrative/symbolic editorial visual and store the
  illustrative flag/disclosure

Published article pages show this disclosure below generated images:

> AI-generated editorial image.

Validate prompt/safeguard behavior without spending image credits:

```bash
npm run images:validate-pipeline
```

This checks Technology, Business, Health, Sports and World fixtures for prompt
quality, constraints, alt text, caption and factual safeguards. To test real
image generation, configure `OPENAI_API_KEY`, `IMAGE_STORAGE=blob` and
`BLOB_READ_WRITE_TOKEN`, then generate a draft from `/admin/trends` or convert
an RSS story from `/admin/stories`.

## Admin

Sign in at `/login` with `ADMIN_PASSWORD`.

Admin routes:

- `/admin` dashboard
- `/admin/feeds` feed management and OPML import/export
- `/admin/stories` RSS story queue
- `/admin/trends` Google Trends US queue
- `/admin/posts` draft/published post manager
- `/admin/image-studio` AI editorial image queue and prompt review
- `/admin/settings` runtime status and ad slot overview

Post actions include:

- Copy Facebook Post
- Copy URL
- Preview
- Edit
- Generate Image
- Regenerate Image
- Publish

Story actions include:

- Copy Facebook Post
- Open original
- Save
- Mark read
- Create Draft

## Editorial and copyright safeguards

- RSS stories store metadata, not copied publisher articles
- Full text is only stored when a feed clearly indicates redistribution rights
- AI drafts must be original English-language articles
- No invented quotes, numbers or unsupported claims
- Source URLs and fact-check notes are saved with drafts
- Image prompts require realistic editorial images, not fake event photos
- Publishing requires admin approval

## AI Fact Checker

Daily Signal Wire includes a pre-publication fact-checking layer for AI
newsroom drafts.

Workflow:

1. AI Writer creates a source-first draft from Research, Trends or RSS context.
2. The Fact Checker extracts important claims from the draft.
3. Claims are checked against saved source URLs, research source packets and
   fact-check notes.
4. The system stores trust score, evidence score, source diversity score,
   freshness score, warnings, risky paragraphs and verification metadata.
5. Editors review the report at `/admin/fact-checker` or inside the post editor.
6. AI-generated articles cannot be published or scheduled until the fact-check
   status is `Verified` and the trust score is at least 75.

Admin routes:

- `/admin/fact-checker`
- `/api/ai/fact-check`
- `/api/ai/verify`

The checker never invents evidence. If source support is weak, single-source,
conflicting or missing, it flags the draft as `Needs Review`, `Low Confidence`
or `Rejected`. Regenerating failed sections requires `OPENAI_API_KEY`; running
the source-based verification report does not crash when the key is missing.

Statuses:

- `Verified`
- `Needs Review`
- `Low Confidence`
- `Rejected`

Preferred evidence domains include Reuters, AP News, BBC, Bloomberg, CNBC,
Financial Times, government websites, WHO, NASA and official company press or
investor pages.

## AdSense

Daily Signal Wire has production-ready Google AdSense slots and an `/ads.txt`
route. When AdSense variables are empty, development shows placeholders labeled
`Advertisement`; production hides real ad units until configuration exists.

Use these variables in Vercel Project Settings → Environment Variables:

```env
NEXT_PUBLIC_ADSENSE_CLIENT_ID=ca-pub-XXXXXXXXXXXXXXXX
ADSENSE_PUBLISHER_ID=pub-XXXXXXXXXXXXXXXX
NEXT_PUBLIC_ADSENSE_SLOT_TOP=1234567890
NEXT_PUBLIC_ADSENSE_SLOT_IN_ARTICLE=1234567891
NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR=1234567892
NEXT_PUBLIC_ADSENSE_SLOT_BOTTOM=1234567893
```

Notes:

- `NEXT_PUBLIC_ADSENSE_CLIENT_ID` includes the `ca-` prefix.
- `ADSENSE_PUBLISHER_ID` is used by `/ads.txt` and should be `pub-...` without
  the `ca-` prefix.
- Each ad slot is the numeric ID from a specific AdSense ad unit.
- The app still supports legacy `NEXT_PUBLIC_ADSENSE_CLIENT` and
  `NEXT_PUBLIC_ADSENSE_SLOT_MIDDLE` so older production deploys do not break.

## Revenue Intelligence

The monetization control plane is available at:

- `/admin/ads` — responsive AdSense placement registry, lazy-loading and reserved-height controls.
- `/admin/revenue` — official AdSense, newsletter and affiliate report imports; no projected or fabricated earnings.
- `/admin/affiliate` — Amazon Associates, Impact, CJ, ShareASale, Awin and custom programs with required disclosures and tracked redirects.
- `/admin/ab-testing` — deterministic headline, CTA, image and ad-position experiments.
- `/admin/heatmap` — consent-aware click targets, scroll depth, session time, exit position and ad visibility.

AdSense supports both `NEXT_PUBLIC_ADSENSE_CLIENT_ID` and the legacy
`NEXT_PUBLIC_ADSENSE_CLIENT`. Configure individual public ad unit IDs with the
`NEXT_PUBLIC_ADSENSE_SLOT_*` variables in `.env.example`. The ad script loads
once, after consent, and ad containers reserve space before loading to reduce
layout shift. Do not click your own ads or use the heatmap to infer AdSense
clicks; official clicks, CPC, RPM and revenue must be imported from Google
AdSense reporting.

Affiliate credentials stay server-side:

```dotenv
AMAZON_TAG=
IMPACT_API_KEY=
CJ_API_KEY=
SHAREASALE_API_TOKEN=
AWIN_API_KEY=
CUSTOM_AFFILIATE_URL=
```

An affiliate block is rendered only when an active link matches the article
category or configured keywords. The outbound redirect records a first-party
click and adds `rel="sponsored nofollow noreferrer"`; conversions and
commissions are recorded only from official network/API report imports.
- After adding or changing Vercel environment variables, redeploy the project.

Check ads.txt:

```text
https://daily-signal-wire.vercel.app/ads.txt
```

Expected configured output:

```text
google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0
```

Do not click your own ads to test them. Use the browser console, AdSense
preview tools, `/admin/settings`, `/ads.txt`, and production page source to
verify configuration.

Ad positions:

- homepage top ad below the reader header
- homepage feed ad after roughly 6 stories
- homepage/right reader sidebar ad
- article top ad after metadata
- article in-content ad after the opening body section when the article is long
  enough
- article bottom and sidebar ads

## SEO and monitoring

Production includes:

- `/api/health`
- `/admin/system`
- `/admin/checklist`
- `/sitemap.xml`
- `/news-sitemap.xml`
- `/robots.txt`
- `/rss.xml`
- canonical URLs
- Open Graph metadata
- Twitter Card metadata
- NewsArticle, Article and Breadcrumb JSON-LD on article pages
- Google Search Console verification through `NEXT_PUBLIC_GSC_VERIFICATION`
  with legacy `GOOGLE_SITE_VERIFICATION` fallback
- admin and draft pages excluded from indexing
- published articles only in `/sitemap.xml`
- Google Analytics 4 integration through `NEXT_PUBLIC_GA_MEASUREMENT_ID`
- consent banner prepared for Google Consent Mode v2

Production operations runbooks:

- `DEPLOYMENT.md`
- `OPERATIONS.md`
- `BACKUP.md`
- `PRODUCTION_CHECKLIST.md`
- `TROUBLESHOOTING.md`

GA4 is optional:

```env
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
NEXT_PUBLIC_GSC_VERIFICATION=google-site-verification-token
```

GA4 scripts load only in production, only once, and only after analytics consent.
In development, the internal privacy-safe analytics endpoint can still collect
consented events without loading Google scripts.

When configured and accepted through the cookie banner, the app tracks these
standard events:

- `page_view`
- `article_view`
- `session_start`
- `search`
- `outbound_click`
- `newsletter_signup`
- `image_generation`
- `ai_publish`
- `scroll_depth`
- `session_time`
- `copy_facebook_post`
- `generate_ai_article`

If no GA4 ID is set, no GA script is loaded and the site does not crash.

Search Console surfaces:

- `google-site-verification` meta tag from `NEXT_PUBLIC_GSC_VERIFICATION`
- optional HTML verification through `GOOGLE_SITE_VERIFICATION_FILE`
- live property-access status when the service account is added to Search Console
- `/robots.txt`
- `/sitemap.xml`
- `/news-sitemap.xml`
- `/image-sitemap.xml`
- `/video-sitemap.xml`
- canonical URLs on public pages

## Google Indexing API

Daily Signal Wire includes a protected Google Indexing queue at:

```text
/admin/indexing
```

Publishing a post automatically queues its canonical `/news/[slug]` URL,
refreshes sitemap/RSS routes, and attempts a Google Indexing API submission when
credentials are configured. If credentials are missing, the job remains pending
with the message `Waiting for Google credentials` and the website does not
crash.

Vercel environment variables:

```env
GOOGLE_INDEXING_ENABLED=true
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
NEXT_PUBLIC_GSC_VERIFICATION=your-meta-verification-token
GOOGLE_SEARCH_CONSOLE_PROPERTY_URL=https://daily-signal-wire.vercel.app/
# Optional HTML-file verification:
GOOGLE_SITE_VERIFICATION_FILE=googleXXXXXXXXXXXX.html
GOOGLE_SITE_VERIFICATION_CONTENT="google-site-verification: googleXXXXXXXXXXXX.html"
```

Important: Google’s official Indexing API documentation says the API is intended
for pages with `JobPosting` or livestream `BroadcastEvent` structured data. For
ordinary news articles, keep XML sitemaps, RSS, canonical URLs and Search
Console as the primary indexing path; the queue exists for safe operational
submission and transparent monitoring.

Protected API routes:

- `POST /api/indexing/publish`
- `POST /api/indexing/submit` (publish, update, delete, and batches)
- `POST /api/indexing/update`
- `POST /api/indexing/delete`
- `GET /api/indexing/status`
- `POST /api/indexing/retry`

Only canonical production URLs under `/news/[slug]` are accepted. Localhost,
preview hosts, foreign domains, query strings and non-published article URLs are
rejected before a Google request is created. Each attempt stores the HTTP
status, truncated response payload, response time, attempt count and exponential
retry time. The cron recovers stale jobs and processes due pending/failed jobs
without dropping the queue.

Public policy pages:

- `/about`
- `/contact`
- `/privacy-policy`
- `/cookie-policy`
- `/terms`
- `/editorial-policy`
- `/ai-content-policy`
- `/dmca`

## Useful commands

```bash
npm install
npx prisma generate
npx prisma migrate dev
npm run seed
npm run dev
npm run build
npm run build:vercel
npm run start
```
