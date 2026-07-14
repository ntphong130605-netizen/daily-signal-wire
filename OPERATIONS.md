# Daily Signal Wire Operations Runbook

## Daily checks

1. Open `/admin/system`.
2. Confirm health score, database, OpenAI, image generation, indexing, AdSense and social queue status.
3. Open `/admin/checklist` and review anything marked `Waiting` or `Review`.
4. Open `/admin/publishing` and review scheduled, failed and pending articles.
5. Open `/admin/social` and review social jobs waiting for credentials or retry.
6. Open `/admin/indexing` and retry failed/pending Google indexing jobs only when credentials are configured.

## Editorial workflow

Research → AI Writer → Fact Check → AI Image → Draft → Editor Review → Schedule → Publish → Social Queue → Indexing Queue.

AI-generated articles must stay draft/pending until an editor approves them. Never bypass fact-check notes, source URLs, image disclosure or publish validation for AI drafts.

## Monitoring

The application writes structured logs with event names and JSON context. Vercel logs are the source of truth for runtime failures.

Monitor:

- `/api/health`
- failed AI writer jobs
- failed image generation jobs
- failed social publish jobs
- failed Google indexing jobs
- failed cron jobs
- database connectivity
- Vercel build failures

## Incident response

1. Check `/api/health`.
2. Check Vercel runtime logs for the request id or structured log event.
3. If credentials are missing, add them in Vercel and redeploy.
4. If database is unavailable, verify Neon/Supabase status and `DATABASE_URL`.
5. If OpenAI fails, keep drafts saved and retry after service recovery.
6. If social publishing fails, retry from `/admin/social` after fixing credentials.
7. If indexing fails, retry from `/admin/indexing`.

## Cron operations

Production cron routes are protected by `CRON_SECRET`.

- `/api/cron/feeds`
- `/api/cron/trends`
- `/api/cron/research`
- `/api/cron/publish`
- `/api/cron/indexing`

Do not call cron endpoints from a browser unless you intend to process real queues.

## Security operations

- Rotate `ADMIN_PASSWORD` and `ADMIN_SESSION_SECRET` regularly.
- Keep `CRON_SECRET` private.
- Keep all social/API credentials server-side.
- Do not put private keys or tokens in GitHub.
- Review Content Security Policy after adding new third-party scripts.

## Revenue operations

Daily Signal Wire does not create fake AdSense revenue. Use AdSense and GA4 official dashboards as the source of truth. The internal admin displays readiness and internal event counts only.
