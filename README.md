# Reader App

Personal reading system built with Next.js, TypeScript, Tailwind CSS, Prisma, and PostgreSQL.

## Local Development

1. Copy `.env.example` to `.env`.
2. Set `DATABASE_URL` to a local PostgreSQL database.
3. Run `npm install`.
4. Run `npx prisma migrate dev --name init`.
5. Run `npm run dev`.

## Cloud Deployment

Recommended first deployment path:

- App hosting: Vercel
- Database: Neon Postgres
- Git hosting: GitHub
- Fallback app hosting: any Docker-compatible platform

### Required Environment Variables

- `DATABASE_URL`
- `APP_BASIC_AUTH_USERNAME`
- `APP_BASIC_AUTH_PASSWORD`
- `NEXT_PUBLIC_APP_URL`

`APP_BASIC_AUTH_USERNAME` and `APP_BASIC_AUTH_PASSWORD` enable a minimal app-level Basic Auth gate. If either variable is missing, the app is public.

### Production Scripts

- Build: `npm run build`
- Migrate: `npm run prisma:migrate:deploy`

### First Production Rollout

1. Create a GitHub repository and push `main`.
2. Create a Neon database for production.
3. In Vercel, create a new project from the GitHub repo.
4. Add the required environment variables in Vercel.
5. Run `npm run prisma:migrate:deploy` against the production database once.
6. Deploy `main` to production.
7. Bind a domain so the app can be opened directly on mobile.

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

Vercel preview deployments from non-`main` branches are enough for now. GitHub Environments are not required for the first release.
