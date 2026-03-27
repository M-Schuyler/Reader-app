# Reader

Reader is a personal, reading-first input hub.

It collects web pages, articles, and PDFs into one document-centered flow so you can:

- capture signal quickly
- read in a calm, structured surface
- keep light traces through highlights, notes, and AI summary
- send the finished signal onward to Obsidian

Reader is intentionally **not** a full personal knowledge system. It does not try to replace long-form notes, backlinks, graphs, or project management.

## Product Surfaces

### Library
- The intake queue for everything worth reading
- Primary actions: capture, scan, filter, star, defer, archive

### Reader
- The core surface
- Reading stays central; controls remain secondary

### Highlights
- A revisit surface for marked passages
- Not a long-form notes workspace

### Export
- The downstream handoff lane
- Reader prepares material; Obsidian owns deeper synthesis

## Boundaries

Reader is responsible for:
- collecting
- storing as unified `Document` records
- reading
- light annotation and state
- export preparation

Reader is not responsible for:
- replacing Obsidian
- heavy PKM dashboards
- graph views
- task or project management
- multi-user collaboration

## Current Product Direction

The next stage follows the **Input Hub Reader** direction:

- keep Library as the main intake queue
- keep Reader as the main stage
- add Highlights as the review surface
- add Export as the exit lane
- expand sources without expanding into a bloated workspace product

## Local Development

1. Copy `.env.example` to `.env`.
2. Set `DATABASE_URL` to a local PostgreSQL database.
3. Run `npm install`.
4. Run `npx prisma migrate dev --name init`.
5. Run `npm run dev`.

## Cloud Deployment

Production target for v1:

- Git hosting: GitHub
- App hosting: Vercel
- Database: Neon Postgres
- Authentication: Auth.js with GitHub OAuth
- Migration runner: GitHub Actions

### Required Environment Variables

- `DATABASE_URL`
- `AUTH_SECRET`
- `AUTH_GITHUB_ID`
- `AUTH_GITHUB_SECRET`
- `INTERNAL_API_SECRET`
- `CRON_SECRET`
- `ALLOWED_EMAILS`
- `AI_PROVIDER`
- `GEMINI_API_KEY` or `OPENAI_API_KEY`

`ALLOWED_EMAILS` is a comma-separated whitelist. If it is empty, all sign-ins are denied.

### Authentication Model

- App-level authentication is mandatory. Vercel Deployment Protection is not used as the real access control layer.
- The app uses GitHub login through Auth.js.
- Only whitelisted email addresses may enter the Reader.
- Private pages and private API routes are both protected.

### GitHub OAuth Setup

1. Create a GitHub OAuth App.
2. Set the homepage URL to your eventual production domain.
3. Add the callback URL:
   `https://YOUR_DOMAIN/api/auth/callback/github`
4. For local development, also allow:
   `http://localhost:3000/api/auth/callback/github`
5. Copy the client ID and client secret into `AUTH_GITHUB_ID` and `AUTH_GITHUB_SECRET`.

Generate `AUTH_SECRET` with a strong random value, for example:

`openssl rand -base64 32`

### Production Scripts

- Build: `npm run build`
- Migrate: `npm run prisma:migrate:deploy`

### First Production Rollout

1. Push `main` to GitHub.
2. Create one production database in Neon.
3. In Vercel, create a new project from the GitHub repo.
4. Set `main` as the production branch.
5. Add the Vercel environment variables:
   `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `INTERNAL_API_SECRET`, `CRON_SECRET`, `ALLOWED_EMAILS`, `AI_PROVIDER`, and the matching AI provider key
6. In GitHub repository secrets, add `DATABASE_URL` for the migration workflow.
7. Merge migration files into `main`; the workflow at [.github/workflows/prisma-migrate-deploy.yml](/Users/chenshukai/Documents/Projects/reader-app/.github/workflows/prisma-migrate-deploy.yml) applies them with `prisma migrate deploy`.
8. Deploy the app on Vercel.
9. Bind a custom domain.
10. Update the GitHub OAuth callback URL to the final production domain if needed.

### Migration Flow

- Development uses `prisma migrate dev`.
- Migration files are committed into the repository.
- Production applies migrations only through GitHub Actions with `npx prisma migrate deploy`.
- Vercel build is intentionally not responsible for schema changes.

### AI Summary Worker

- Web imports now enqueue AI summary generation after the document is captured successfully.
- When `AI_PROVIDER` and the matching API key are configured, new imports will try to generate the summary immediately after capture.
- The worker route remains the safety net for pending jobs and the main drain path for historical backfills.
- The internal worker endpoints are:
  - `GET /api/internal/summary-jobs/run`
  - `POST /api/internal/summary-jobs/run`
  - `POST /api/internal/summary-jobs/backfill`
- Logged-in app users may open the worker and backfill routes directly in the browser for manual maintenance.
- Internal or scripted calls may authenticate with:
  `Authorization: Bearer YOUR_INTERNAL_API_SECRET`
- Vercel cron calls may authenticate with `CRON_SECRET`.
- The repository includes `vercel.json`, which schedules `/api/internal/summary-jobs/run` once per day for Hobby-compatible deployments.
- To backfill older documents that are still missing summaries:
  1. Open `/api/internal/summary-jobs/backfill?limit=20` while signed in to queue a batch quickly
  2. If you want to run a small batch immediately, use `/api/internal/summary-jobs/backfill?limit=5&run=true`
  3. Or open `/api/internal/summary-jobs/run?limit=5` while signed in to drain queued work manually

### Docker Deployment

If you do not want to depend on Vercel, the repo now includes a production `Dockerfile`.

1. Build the image: `docker build -t reader-app .`
2. Run it with your production environment variables:
   `docker run --rm -p 3000:3000 --env-file .env reader-app`
3. Point `DATABASE_URL` at a managed PostgreSQL database.
4. Run `npm run prisma:migrate:deploy` against that database before first production traffic.

### Branch Strategy

Keep it simple for MVP:

- `main`: production
- `feature/*`: working branches

Vercel preview deployments from non-`main` branches are enough for now. GitHub Environments and preview database branches are optional follow-up work, not part of the first release.
