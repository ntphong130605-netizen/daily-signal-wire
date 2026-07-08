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
DATABASE_URL="file:./dev.db"

OPENAI_API_KEY=
AI_MODEL=gpt-5.4-mini
IMAGE_MODEL=gpt-image-2

NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=replace-with-a-nextauth-secret-before-production

NEXT_PUBLIC_ADSENSE_CLIENT=
NEXT_PUBLIC_ADSENSE_SLOT_TOP=
NEXT_PUBLIC_ADSENSE_SLOT_MIDDLE=
NEXT_PUBLIC_ADSENSE_SLOT_BOTTOM=
NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR=

ADMIN_PASSWORD=choose-a-strong-password
ADMIN_SESSION_SECRET=replace-with-at-least-32-random-characters
CRON_SECRET=replace-with-a-long-random-string
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

For production, switch `DATABASE_URL` to PostgreSQL and change the Prisma
datasource provider in `prisma/schema.prisma` before deploying.

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

Generated images are saved locally under `public/generated` in two landscape
16:9 sizes:

- `1200x675` for thumbnail/Twitter image
- `1920x1080` for featured/OpenGraph image

Each post stores:

- `imagePrompt`
- `imageModel`
- `imageGeneratedAt`
- `imageStatus`
- `imageUrl`
- `featuredImage`
- `thumbnailImage`
- `openGraphImage`
- `twitterImage`

The admin visual desk supports:

- Generate Image
- Regenerate
- Edit Prompt
- Preview
- Accept Image
- Reject Image
- Retry after failure

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

> Illustration generated with AI.

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

When AdSense variables are empty, the site shows development placeholders
labeled `Ad Slot`.

The AdSense script is only loaded when `NEXT_PUBLIC_ADSENSE_CLIENT` is set.

## Useful commands

```bash
npm install
npx prisma generate
npx prisma migrate dev
npm run seed
npm run dev
npm run build
npm run start
```
