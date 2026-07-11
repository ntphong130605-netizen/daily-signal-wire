# Daily Signal Wire

Daily Signal Wire is a full-stack news reader and AI-assisted newsroom built
with Next.js, TypeScript, Prisma and SQLite local fallback.

It combines:

- a three-column RSS reader inspired by professional news readers
- Google Trends US idea monitoring
- AI-assisted original article drafts
- admin review before publishing
- safe AdSense placeholders in development

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
GOOGLE_SITE_VERIFICATION=

ADMIN_PASSWORD=choose-a-strong-password
ADMIN_SESSION_SECRET=replace-with-at-least-32-random-characters
MAX_TRENDS_PER_RUN=5
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

Vercel runs `npm run build:vercel`, which generates Prisma Client from that
PostgreSQL schema. Local development keeps `prisma/schema.prisma` on SQLite.

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

`db:push:prod` applies the Prisma data model to the PostgreSQL database. Use a
managed migration workflow before large schema changes on a live production
database.

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

The `Refresh Google Trends` action fetches Google Trends US, falls back to
mock-safe signals if the upstream feed fails, and saves new trends as idle
signals. It does not generate, publish or overwrite stories automatically.

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

AI drafts are never published automatically. Editors must review and publish
from the admin area.

## AI image generation

After an AI article draft is created from Google Trends or an RSS story, the app
attempts to generate an editorial image automatically when `OPENAI_API_KEY` is
configured.

Generated images are resized into two landscape 16:9 assets:

- `1200x675` for thumbnail/Twitter image
- `1920x1080` for featured/OpenGraph image

Local development defaults to filesystem storage under `public/generated`.
Production should use Vercel Blob so generated images are stored as public URLs
instead of base64 database payloads.

```env
BLOB_READ_WRITE_TOKEN=...
IMAGE_STORAGE=blob
```

Use `IMAGE_STORAGE=local` only when the runtime has a persistent writable
filesystem. If Blob is not configured in production, the app still saves the
article draft, marks `imageStatus=failed`, shows a category placeholder image,
and lets an editor retry after storage is configured.

Each post stores:

- `imagePrompt`
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

The admin visual desk supports:

- Generate Image
- Regenerate
- Edit Prompt
- Preview
- Accept Image
- Remove Image
- Upload / replace image
- Paste licensed image URL
- Retry after failure

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
- photorealistic editorial illustration
- do not create fake documentary photos of real events

Published article pages show this disclosure below generated images:

> AI-generated editorial illustration.

## Admin

Sign in at `/login` with `ADMIN_PASSWORD`.

Admin routes:

- `/admin` dashboard
- `/admin/feeds` feed management and OPML import/export
- `/admin/stories` RSS story queue
- `/admin/trends` Google Trends US queue
- `/admin/posts` draft/published post manager
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
- Image prompts require editorial illustrations, not fake event photos
- Publishing requires admin approval

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
- `/sitemap.xml`
- `/news-sitemap.xml`
- `/robots.txt`
- `/rss.xml`
- canonical URLs
- Open Graph metadata
- Twitter Card metadata
- NewsArticle, Article and Breadcrumb JSON-LD on article pages
- Google Search Console verification through `GOOGLE_SITE_VERIFICATION`
- admin and draft pages excluded from indexing
- published articles only in `/sitemap.xml`
- Google Analytics integration through `NEXT_PUBLIC_GA_MEASUREMENT_ID`
- consent banner prepared for Google Consent Mode v2

GA4 is optional:

```env
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

When configured and accepted through the cookie banner, the app tracks:

- `page_view`
- `article_view`
- `copy_facebook_post`
- `publish_article`
- `generate_ai_article`
- `generate_ai_image`

If no GA4 ID is set, no GA script is loaded and the site does not crash.

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
