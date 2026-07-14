# Daily Signal Wire Backup and Restore Plan

## What must be backed up

1. PostgreSQL production database.
2. Vercel Blob media assets.
3. Vercel environment variables.
4. GitHub repository.
5. Google/AdSense/Search Console configuration notes.

## Database backup

Use your database provider first:

- Neon: enable point-in-time restore and branch-based backups.
- Supabase: enable scheduled backups and point-in-time recovery if available.

Manual PostgreSQL backup:

```bash
pg_dump "$DATABASE_URL" --format=custom --file=daily-signal-wire-$(date +%Y%m%d).dump
```

Restore to a new database:

```bash
pg_restore --clean --if-exists --dbname "$DATABASE_URL" daily-signal-wire-YYYYMMDD.dump
```

After restore:

```bash
npx prisma generate
npx prisma db push --schema prisma/schema.postgres.prisma
```

## Media backup

Images are stored through the configured storage mode. In production, use Vercel Blob.

Operational plan:

1. Export Blob object list from Vercel dashboard/API.
2. Store a dated copy of image URLs and metadata.
3. Keep database image URL fields backed up with the database.
4. Re-run image generation only if the original asset cannot be recovered.

## Configuration backup

At least once per launch/change:

1. Export the list of environment variable names from Vercel.
2. Store secret values in a password manager, not GitHub.
3. Keep `.env.example` updated with variable names only.

Never commit real credentials, database URLs, OpenAI keys, Google private keys or social access tokens.

## Recovery checklist

1. Restore database.
2. Restore Blob/media access.
3. Re-enter Vercel environment variables.
4. Redeploy latest `main`.
5. Check `/api/health`.
6. Check `/admin/system`.
7. Verify `/`, `/search`, `/news/[slug]`, `/rss.xml`, `/sitemap.xml`.
8. Retry failed image, indexing and social jobs only after credentials are restored.
