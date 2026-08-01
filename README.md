This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Self-hosted local stack

The repository includes a local Supabase stack in `docker-compose.yml`. It runs
Postgres, GoTrue, PostgREST, Storage API, and Kong. The app should use Kong at
`http://localhost:8000`, not the Postgres port or a direct GoTrue URL.

```bash
cp .env.example .env
docker compose up -d
```

GoTrue and Storage API run their own internal database migrations when they
start. Wait for those services to finish starting, then apply the application
migrations, create the storage bucket, and optionally seed local auth data:

```bash
npm install
npm run db:deploy
npx tsx scripts/create-storage-bucket.ts
npm run db:seed
npm run dev
```

For this local setup, `.env` must keep `NEXT_PUBLIC_SUPABASE_URL` at
`http://localhost:8000`, use the anon JWT as
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and use the service-role JWT only as
the server-side `SUPABASE_SECRET_KEY`. Change the example JWT, database
passwords, and SMTP/autoconfirm settings before using the stack beyond local
development. The first-boot SQL file only runs when the Postgres data volume is
initialized for the first time.

## Deployment checklist (hosted or self-hosted)

Steps required once per environment, beyond the usual `npm run db:deploy`:

1. **Storage bucket** — nothing creates the `employee-documents` bucket
   automatically (Supabase's dashboard/CLI project init doesn't include it,
   and the self-hosted stack starts with an empty `storage.buckets`). Run
   `npx tsx scripts/create-storage-bucket.ts` once against the target
   project — it's idempotent, safe to re-run. Skipping this means the first
   document upload will fail.
2. **PII encryption key** — set `EMPLOYEE_PII_ENCRYPTION_KEY` to a real key
   generated with `openssl rand -base64 32` (never the placeholder in
   `.env.example`). Back it up outside the app's own database — losing it
   makes existing encrypted `nationalId`/`bankName`/`bankAccountNumber`
   values permanently unrecoverable.
3. **Existing-data PII backfill** — if you're deploying the PII-encryption
   migration against a database that already has employee rows (i.e. this
   isn't a fresh install), run `npx tsx scripts/encrypt-existing-pii.ts`
   once, right after that migration lands. It's a manual, idempotent,
   one-time backfill — it is not wired into `db:deploy` or any other
   automation, so it's easy to miss on an existing deployment.
4. **Migrations are not applied automatically** — `npm run build` (what
   Vercel runs) does not run `prisma migrate deploy`. Merging to `main` gets
   the code deployed; it does not, by itself, get the schema/RLS changes
   applied to the database. Run `npm run db:deploy` against the target
   database (or merge a validated Supabase branch) as its own explicit step
   after every merge that includes a new migration. Confirm it landed with
   `SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY
   finished_at DESC LIMIT 5;` — do not assume it happened.
5. **Self-hosted CORS origin** — `supabase/kong.yml` hardcodes
   `http://localhost:3000` as the only allowed CORS origin. Edit the
   `origins` list there for any real domain before pointing a self-hosted
   deployment at it.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
