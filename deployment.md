# Deployment and local setup

Shortlist is a Next.js 16 app with Postgres. This file covers running it locally and how the hosted copy was set up. It is deployed at **https://shortlist-six-ecru.vercel.app** (Vercel, with Neon Postgres). Section 4 describes how.

## 1. Prerequisites

- Node.js 20 or newer (built and tested on Node 24), npm
- PostgreSQL 14 or newer (local, or a Neon project)
- A Groq API key if you want real AI scoring (optional: without it the app uses the rule-based extractor and says so)
- A Vercel account for deployment (optional)

## 2. Local setup

```bash
git clone https://github.com/mohitoza08/shortlist.git && cd shortlist
npm install
cp .env.example .env        # then fill in the values below
npx prisma migrate deploy   # creates the tables
npx prisma db seed          # users, clients, five requisitions
npm run seed:resumes        # writes the synthetic CVs (already committed; only needed to regenerate)
npm run seed:demo           # loads ~33 CVs through the real pipeline with stages and decisions
npm run dev                 # http://localhost:3000
```

Minimum `.env` for local use:

```
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/shortlist"
DIRECT_URL="postgresql://USER:PASSWORD@localhost:5432/shortlist"
AUTH_SECRET="<output of: openssl rand -base64 32>"
AUTH_URL="http://localhost:3000"
AI_MOCK="1"                 # use the rule-based extractor; set to 0 and add GROQ_API_KEY for the model
SEED_DEMO_PASSWORD="Demo1234!"
```

To use Groq: set `GROQ_API_KEY`, `AI_MOCK="0"`, and optionally `GROQ_TEXT_MODEL` (default `openai/gpt-oss-20b`). The live path was checked on 3 sample CVs (`npx tsx --env-file=.env scripts/live-ai-test.ts`, then `scripts/live-ai-report.ts` to see each score and whether every quote is a real line of the CV). With `AI_MOCK="1"`, `npm run seed:demo` scores the 33 seed CVs with the rule-based extractor (labelled `heuristic` in the UI and in `AiRun`); with a key and `AI_MOCK="0"` the scores come from the model.

## 3. Tests and checks

```bash
npm run lint
npm run typecheck
npm run test            # 44 unit + integration tests (integration needs DATABASE_URL and a seeded database)
npm run build
npm run start &         # then:
npm run test:e2e        # Playwright; install the browser once with: npx playwright install chromium
node scripts/smoke.mjs  # 49 HTTP checks against the running server
```

Run e2e and smoke tests with `AI_MOCK=1` so results are deterministic. They create new requisitions with "Smoke" or "E2E" in the title; `npm run seed:demo -- --reset` removes smoke data.

## 4. How it is deployed

1. **Neon:** create a project and database. Copy the pooled connection string to `DATABASE_URL` and the direct one to `DIRECT_URL`.
2. **Vercel:** import the repository. Framework preset Next.js. Set the environment variables below. Build command `prisma migrate deploy && next build`.
3. **Seed once** from your machine against the production database: `DATABASE_URL=... DIRECT_URL=... npx prisma db seed && npm run seed:demo`.
4. **File storage:** the build stores resume bytes in Postgres, which works on Vercel without extra setup. For real volume, switch `src/lib/storage.ts` to Vercel Blob (private) or S3 and set `BLOB_READ_WRITE_TOKEN`.
5. **Verify on the deployed URL:** sign in as the recruiter, create a requisition from the sample JD, upload 3 sample CVs, open one and submit it, sign in as the Ashford client on a 390 px viewport, shortlist, request and process a deletion for one candidate, and check the access log.

Environment variable names (values are never committed):

`DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `AUTH_URL`, `GROQ_API_KEY`, `GROQ_TEXT_MODEL`, `GROQ_VISION_MODEL`, `BLOB_READ_WRITE_TOKEN`, `NEXT_PUBLIC_APP_URL`, `SEED_DEMO_PASSWORD`, `AI_MOCK`.

Optional limiter overrides: `AI_RPM`, `AI_TPM`, `AI_RPD`, `AI_TPD`.

## 5. Demo logins

Password for all: `Demo1234!` (set from `SEED_DEMO_PASSWORD`; change it for anything that is not a demo).

| Role | Email |
|---|---|
| Recruiter | `recruiter@meridian.example` |
| Recruiter (lead) | `lead@meridian.example` |
| Client, Ashford Bank | `hiring@ashfordbank.example` |
| Client, Vela Retail | `hiring@velaretail.example` |
| Client, Orbit IT Services | `hiring@orbitit.example` |

## 6. Known limits and troubleshooting

- **Free-tier AI is slow.** About 3 CVs a minute and about 75 a day on the free tier. A `Queued — provider limit` badge means the limiter or provider asked us to wait; the upload page retries automatically while it stays open.
- **Closing the upload tab pauses processing.** Reopen the upload page; unfinished CVs resume.
- **Scanned CVs** land in Needs review with a reason. OCR is not built.
- **`next build` fails with a "dynamic is not compatible with cacheComponents" error:** `cacheComponents` must stay off in `next.config.ts`; every page here is per-user.
- **Windows and Postgres:** if you use a private cluster (as the author did), start it with `pg_ctl -D <dir> start` and give it its own port.
- **Prisma:** this project uses Prisma 6. Do not upgrade to the 8.x release candidate without migrating the config.

## 7. Regenerating seed data

- `npm run seed:resumes` rewrites `prisma/seed-data/resumes/` (deterministic: same input, same files).
- `npm run seed:demo -- --reset` wipes applications, candidates, AI runs, deletion requests and the audit log, then reloads everything through the real pipeline. With `GROQ_API_KEY` set and `AI_MOCK=0` the scores come from the model; otherwise from the rule-based extractor. Each `AiRun` row records which.
- `npm run samples` regenerates the CVs offered by the "Try 3 sample CVs" button in `public/samples/`.
- `npm run screenshots` retakes `docs/screenshots/` from a running app. `npm run pdf` rebuilds the TDD PDF (needs pandoc). If Playwright's own browser is not installed, run either with `PW_CHANNEL=chrome` to use the installed Chrome.
