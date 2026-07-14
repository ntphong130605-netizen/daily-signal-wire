# Daily Signal Wire Deployment Guide

Daily Signal Wire is deployed as a Next.js application on Vercel with Prisma, PostgreSQL, OpenAI, Vercel Blob, Google integrations and optional social publishing connectors.

## Required production environment

Set these in Vercel Project Settings → Environment Variables for Production and Preview:

```bash
DATABASE_URL=
NEXTAUTH_SECRET=
NEXTAUTH_URL=https://daily-signal-wire.vercel.app
NEXT_PUBLIC_SITE_URL=https://daily-signal-wire.vercel.app
ADMIN_PASSWORD=
ADMIN_SESSION_SECRET=
CRON_SECRET=
OPENAI_API_KEY=
AI_MODEL=
IMAGE_MODEL=
BLOB_READ_WRITE_TOKEN=
```

## Google, SEO and advertising

```bash
NEXT_PUBLIC_GA_MEASUREMENT_ID=
NEXT_PUBLIC_GSC_VERIFICATION=
GOOGLE_SITE_VERIFICATION=

NEXT_PUBLIC_ADSENSE_CLIENT_ID=
ADSENSE_PUBLISHER_ID=
NEXT_PUBLIC_ADSENSE_SLOT_TOP=
NEXT_PUBLIC_ADSENSE_SLOT_IN_ARTICLE=
NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR=
NEXT_PUBLIC_ADSENSE_SLOT_BOTTOM=

GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_PRIVATE_KEY=
GOOGLE_INDEXING_ENABLED=true
```

If any of these credentials are missing, the application must remain usable and the admin UI should display `Waiting for credentials`.

## Social distribution credentials

```bash
FACEBOOK_PAGE_ACCESS_TOKEN=
FACEBOOK_PAGE_ID=
X_API_KEY=
X_ACCESS_TOKEN=
LINKEDIN_ACCESS_TOKEN=
LINKEDIN_ORGANIZATION_URN=
LINKEDIN_COMPANY_ID=
PINTEREST_ACCESS_TOKEN=
PINTEREST_BOARD_ID=
THREADS_ACCESS_TOKEN=
THREADS_USER_ID=
BLUESKY_IDENTIFIER=
BLUESKY_APP_PASSWORD=
RESEND_API_KEY=
NEWSLETTER_FROM_EMAIL=
```

Missing social credentials do not block article publishing. Social jobs remain queued as `waiting_credentials`.

## Build command

Vercel uses:

```bash
npm run build:vercel
```

This runs:

```bash
prisma db push --schema prisma/schema.postgres.prisma
prisma generate --schema prisma/schema.postgres.prisma
next build
```

## Local validation before deploy

```bash
npm install
npx prisma generate
npm run typecheck
npm run lint
npm run build
```

## Post-deploy verification

Check:

- `/`
- `/search`
- `/news/inside-the-source-first-newsroom`
- `/admin`
- `/admin/system`
- `/admin/checklist`
- `/admin/social`
- `/admin/indexing`
- `/api/health`
- `/robots.txt`
- `/sitemap.xml`
- `/news-sitemap.xml`
- `/image-sitemap.xml`
- `/rss.xml`

Do not manually call production cron endpoints unless you intend to process real queues.
