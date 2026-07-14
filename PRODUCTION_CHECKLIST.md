# Daily Signal Wire Production Checklist

Use `/admin/checklist` for the live version of this checklist. This file is the operational baseline.

## Application

- [ ] Homepage works.
- [ ] Search works.
- [ ] Article page works.
- [ ] Admin login works.
- [ ] `/api/health` returns healthy or clearly degraded.

## Environment

- [ ] `DATABASE_URL`
- [ ] `NEXT_PUBLIC_SITE_URL`
- [ ] `NEXTAUTH_URL`
- [ ] `NEXTAUTH_SECRET`
- [ ] `ADMIN_PASSWORD`
- [ ] `ADMIN_SESSION_SECRET`
- [ ] `CRON_SECRET`

## AI newsroom

- [ ] `OPENAI_API_KEY`
- [ ] AI writer creates drafts only.
- [ ] Fact checker stores trust score and warnings.
- [ ] Image studio stores real image URLs, not base64.
- [ ] AI image disclosure is visible where required.

## Google and SEO

- [ ] `NEXT_PUBLIC_GA_MEASUREMENT_ID`
- [ ] `NEXT_PUBLIC_GSC_VERIFICATION`
- [ ] `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- [ ] `GOOGLE_PRIVATE_KEY`
- [ ] `/robots.txt`
- [ ] `/sitemap.xml`
- [ ] `/news-sitemap.xml`
- [ ] `/image-sitemap.xml`
- [ ] `/rss.xml`

## Advertising

- [ ] `NEXT_PUBLIC_ADSENSE_CLIENT_ID`
- [ ] `ADSENSE_PUBLISHER_ID`
- [ ] Ad slots configured.
- [ ] `/ads.txt` returns the correct publisher line.
- [ ] Cookie consent is visible.

## Operations

- [ ] Vercel cron configured.
- [ ] Database backup enabled.
- [ ] Media backup plan documented.
- [ ] Monitoring snapshots recorded.
- [ ] Social credentials configured or jobs safely waiting.
- [ ] No fake analytics or fake revenue is displayed.
