# Doctor-Radio — Architecture

A collaborative radiology learning platform. This document is the source of truth for
architecture, data model, UI structure, security posture, and phase plan.

## 1. System overview

```
Browser (Next.js App Router, RSC + client islands)
   │  REST (route handlers) + Server Actions
   ▼
Next.js app (Node runtime)  ──►  PostgreSQL (Prisma)
   │                         ──►  Redis (cache, rate limit, BullMQ queues)
   │                         ──►  S3-compatible private bucket (signed URLs)
   │                         ──►  LLM gateway (OpenAI | Anthropic | Gemini | OpenAI-compatible)
   ▼
Worker process (BullMQ)  — archive extraction, DICOM parsing + de-id scan,
                           thumbnailing, malware scan (ClamAV), embeddings
```

Decision: **single Next.js app + separate worker process** sharing the `src/server`
domain layer. A separate API service is not justified yet; route handlers keep a
single deployable while the worker isolates CPU-heavy / untrusted-file processing.

### Layering (clean architecture, pragmatic)

| Layer | Path | Rule |
|---|---|---|
| UI | `src/app`, `src/components` | No direct DB access except via `src/server/services` in RSC |
| Domain services | `src/server/services/*` | Business rules, authorization, transactions |
| Infrastructure | `src/server/{db,storage,queue,llm,security}` | Replaceable adapters |
| Validation | `src/lib/validation/*` (zod) | Shared by client forms and API |
| Worker | `worker/` (Phase 2) | Imports from `src/server`, never from UI |

## 2. Data model

Full schema: `prisma/schema.prisma`. Entity groups:

- **Identity**: `User`, `Account`, `Session`, `VerificationToken`, `PasswordResetToken`,
  `UserProfile`, `Institution`, `VerificationRequest` (professional verification)
- **Social**: `Follow`, `Notification`
- **Cases**: `Case`, `CaseFile`, `CaseTag`/`Tag`, `Modality` (enum), `DeidentificationReport`
- **Collaboration**: `Observation`, `DifferentialDiagnosis`, `Comment` (hierarchical via
  `parentId`; attaches to a case *or* an observation), `Like`, `Bookmark`, `ObservationReveal`
- **AI**: `AIConversation`, `AIMessage` (every message labelled AI, human-review flag)
- **Gamification**: `Achievement`, `UserAchievement`, `PointEvent`
- **Governance**: `Report`, `ModerationAction`, `AuditLog`

Key constraints: composite uniques on `Like`/`Bookmark`/`Follow`, one observation per
(case, author), cascading deletes only for owned children, `deletedAt` soft-delete on
user-generated content (secure-deletion worker hard-deletes + purges storage), indexes on
all feed/filter columns, cursor pagination everywhere.

## 3. Roles and verification

`Role`: `MEMBER`, `MODERATOR`, `ADMIN`. `VerificationStatus`: `UNVERIFIED`, `PENDING`,
`VERIFIED`, `REJECTED`. Members register as unverified (can read, comment); **uploading cases
requires `VERIFIED`** (medical council registration number + institutional email or
document reviewed by moderators). Students are a distinct `Designation` with student-ID
verification and no upload permission by default (configurable).

## 4. Case publication pipeline (Phase 2)

`DRAFT → PROCESSING → PENDING_REVIEW → PUBLISHED` (or `REJECTED` / `REMOVED`)

1. Upload via presigned PUT to a **quarantine** prefix (size cap, content-type allowlist).
2. Worker: magic-byte sniff, ClamAV scan, archive extraction with limits (max entries,
   max total uncompressed bytes, max ratio, path-traversal rejection, no symlinks).
3. DICOM: parse with `dicom-parser`, strip PHI tags (allowlist approach, not blocklist),
   rewrite UIDs, flag burned-in text (OCR heuristic) for manual masking.
4. Uploader confirms de-identification + authorization (stored with timestamp/IP/text version).
5. Moderator review → `PUBLISHED`. Nothing is public before all gates pass.

## 5. AI assistant (Phase 4)

`LLMProvider` interface (`complete`, `stream`) with adapters per vendor, chosen by
`LLM_PROVIDER`. A mandatory **PHI guard** sits in front of every outbound call; only
text fields (never pixels) of published, de-identified cases are sent. System prompt
enforces educational framing, no definitive diagnosis, no treatment advice. Output is
persisted with `isAIGenerated=true`; publishing AI text as an observation requires an
explicit human edit + submit.

## 6. Security checklist

Auth.js (JWT-less DB sessions, argon2/bcrypt hashing, lockout), CSRF via same-site cookies +
Origin checks on mutating handlers, zod on every input, Prisma (parameterised SQL), React
escaping + sanitised markdown, CSP + security headers (`next.config.ts`), Redis rate limiting
on auth/AI/upload, RBAC helper `requireRole()`, audit log on privileged actions, signed URLs
(≤ 5 min), encryption at rest (bucket SSE + Postgres volume), DPDP Act 2023: consent
records, purpose limitation, data export/erasure workflow, grievance contact.

## 7. UI structure

Routes (App Router groups):

```
(auth)/login  register  forgot-password  reset-password
(app)/  home            Dashboard
        explore         Case feed + filters
        cases/new       Upload wizard (Phase 2)
        cases/[id]      Split-screen viewer + observations + AI (Phase 2-4)
        discussions     Threads
        learning        Flashcards, quizzes (Phase 4)
        leaderboard
        profile         Own profile (edit)
        u/[username]    Public profile
        admin/*         Admin + moderation (Phase 6)
```

Design tokens: navy `#0B1B33` / ink, soft white `#F7F9FC`, cool grey scale, teal/cyan accent
`#14B8C4`. Light + dark via CSS variables on `:root` / `.dark`; Inter-style typography
(Geist), 14px radius cards, subtle layered shadows, Framer Motion for transitions.

## 8. Phase plan

1. Setup, design system, auth, profiles, dashboard  ← **current**
2. Case upload, file pipeline, gallery, case detail
3. Observations, comments, reveal mode
4. LLM provider layer + AI assistant
5. Search (+ pgvector), leaderboard, notifications, gamification
6. Admin, moderation, hardening, tests, deployment
