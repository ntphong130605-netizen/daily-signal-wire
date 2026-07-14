# Daily Signal Wire Troubleshooting

## Production route returns 500

1. Open `/api/health`.
2. Check Vercel runtime logs.
3. Look for structured log event names such as `ops_database_check_failed`, `newsletter_signup_failed`, `scheduled_publish_cron_failed`, `social_publish_failed` or `indexing_job_failed`.
4. Verify required environment variables.
5. Redeploy only after the missing credential/configuration is fixed.

## Database unavailable

Symptoms:

- `/api/health` degraded or 503.
- Admin pages show empty/fallback states.

Fix:

1. Verify `DATABASE_URL` in Vercel.
2. Check Neon/Supabase status.
3. Run `npx prisma db push --schema prisma/schema.postgres.prisma` only against the intended production database.

## AI writer or image generation fails

1. Confirm `OPENAI_API_KEY`.
2. Confirm billing/quota in OpenAI.
3. Confirm `BLOB_READ_WRITE_TOKEN` for production image storage.
4. Retry from `/admin/posts/[id]` or `/admin/image-studio`.

Draft articles should remain saved even if image generation fails.

## Google indexing fails

1. Confirm `GOOGLE_INDEXING_ENABLED=true`.
2. Confirm `GOOGLE_SERVICE_ACCOUNT_EMAIL`.
3. Confirm `GOOGLE_PRIVATE_KEY` keeps newline formatting.
4. Confirm the service account has access to the Search Console property.
5. Retry from `/admin/indexing`.

## AdSense does not show ads

1. Confirm AdSense account/site approval.
2. Confirm `NEXT_PUBLIC_ADSENSE_CLIENT_ID`.
3. Confirm slot IDs.
4. Confirm `/ads.txt`.
5. Do not click your own ads.

In development or missing configuration, placeholders/hidden slots are expected.

## Social publishing fails

1. Open `/admin/social`.
2. Read `errorMessage` and logs.
3. Add missing platform credentials in Vercel.
4. Redeploy if environment variables changed.
5. Retry from the queue.

The system must not mark a third-party post as published unless the platform API confirms it.

## Build fails on Vercel

1. Read the Vercel build log.
2. Run locally:

```bash
npm install
npx prisma generate
npm run typecheck
npm run lint
npm run build
```

3. Fix TypeScript/Prisma errors before pushing.
4. Avoid adding Vercel cron routes beyond the project plan limit.
