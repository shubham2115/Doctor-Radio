# Doctor Radio

A collaborative radiology learning platform: upload de-identified cases, write independent
observations, compare interpretations, and learn with an AI study companion.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for architecture, data model, security and the phase plan.

## Quick start

```bash
cp .env.example .env          # set AUTH_SECRET (npx auth secret); Google keys optional
docker compose up -d postgres redis
npm install
npx prisma migrate dev
npm run dev                   # http://localhost:3000
```

Without `SMTP_URL`, password-reset links are logged to the server console.

## First run

```bash
npm run dev
# 1. Register at /register and finish onboarding.
# 2. Make yourself a moderator (also marks you verified so you can upload):
npm run make-admin -- you@example.com
# 3. Upload a case at /cases/new → review → submit → approve it at /admin.
```

Set `LLM_PROVIDER` + `LLM_API_KEY` (anthropic | openai | gemini | openai-compatible) to enable the AI assistant and Learning study sets.
For local development set `ALLOW_UNSCANNED="true"` unless you run ClamAV.

`node scripts/e2e.mjs http://localhost:3000` runs an end-to-end API smoke test (needs a running server; creates `@t.org` test users).

## Status

| Phase | Scope | State |
|---|---|---|
| 1 | Setup, design system, auth, profiles, dashboard | Done |
| 2 | Case upload (JPG/PNG/PDF/ZIP/RAR/DICOM), de-identification, signed private files, viewer, case page | Done |
| 3 | Observations, reveal mode, threaded comments, mentions, reports | Done |
| 4 | Provider-independent AI assistant, flashcards/quizzes | Done (needs an API key to run) |
| 5 | Explore search/filters, leaderboard, notifications, gamification | Done (keyword search; pgvector semantic search planned) |
| 6 | Full admin (user suspension, content browser), S3 driver, SMTP, tests, deployment | Partial: moderation queue, reports, verification, audit log exist |
