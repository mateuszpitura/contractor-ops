# Local E2E Testing Guide

> Companion checklist for running the app locally and walking through every user
> flow (happy path + edge cases). Tick items as you go and use the **Notes**
> column to capture anything broken or unclear.

**Author:** Mateusz Pitura · **Generated:** 2026-05-10
**Scope:** `apps/web` (dashboard + portal + admin), `apps/landing`, `apps/public-api`

---

## 0. Pre-flight Configuration Audit

I diffed your local `.env` (187 lines) against `.env.example` (363 lines) and the
Zod env schema in `packages/validators/src/env.ts`. Status:

### 0.1 Required vars — all present ✅

Every var marked required in `serverEnvSchema` is set, so `getServerEnv()`
won't throw at boot. That covers: DB, Better Auth, Google/Microsoft OAuth,
Stripe (test keys), Resend, R2, Slack, Jira, DocuSign, Notion, Confluence,
Google Calendar, Outlook Calendar, Linear, ClamAV, BANK_ACCOUNT_ENCRYPTION_KEY,
ANTHROPIC_API_KEY, QStash, CRON_SECRET, all `*_ENCRYPTION_KEY`s.

### 0.2 Placeholder values that will fail at runtime ⚠️

| Var | Current value | Impact |
|---|---|---|
| `ANTHROPIC_API_KEY` | `__DEVELOPMENT__` | OCR invoice intake (`/invoices/intake`, `/api/ocr/_process`) will 401 against Anthropic. Set a real key or skip OCR tests. |
| `AUTENTI_CLIENT_ID` / `AUTENTI_CLIENT_SECRET` / `AUTENTI_WEBHOOK_SECRET` | `__DEVELOPMENT__` | Autenti e-sign flows will fail. Skip if not testing PL e-signing. |

### 0.3 Configuration drifts to fix before testing 🔧

- [ ] **APP_URL vs BETTER_AUTH_URL mismatch** — `APP_URL=https://bluebird-daring-annually.ngrok-free.app` but `BETTER_AUTH_URL=http://localhost:3000` and `NEXT_PUBLIC_APP_URL=http://localhost:3000`. OAuth `redirect_uri`s and webhook signing will be inconsistent. Pick one:
  - **Local-only testing:** set `APP_URL=http://localhost:3000`.
  - **Integrations testing (Slack, DocuSign, etc. webhooks):** keep ngrok and also set `NEXT_PUBLIC_APP_URL=APP_URL=BETTER_AUTH_URL=https://bluebird-daring-annually.ngrok-free.app`.
- [ ] **`DATABASE_URL_EU` and `DATABASE_URL_ME` point to the same DB.** Multi-region/data-residency edge cases will silently pass even when broken. Acceptable for happy-path local testing; flag as `[N/A — single DB]` in the multi-region rows below.
- [ ] **`R2_BUCKET_NAME_EU` / `R2_BUCKET_NAME_ME` not set.** Defaults are `contractor-ops-documents-{eu,me}` — if those buckets don't exist, uploads fail. Either create them in R2 or set both to `R2_BUCKET_NAME=contractor-ops-documents` (your existing bucket).

### 0.4 Optional — set if you want to test these surfaces

| Var | Why set it locally | Default behaviour if unset |
|---|---|---|
| `DEV_SMTP_HOST=127.0.0.1` + `DEV_SMTP_PORT=1025` | Captures all transactional email (signup verification, portal magic link, invitations) in Mailpit at `http://localhost:8025` instead of sending real Resend mail. | Real Resend emails fire (uses `RESEND_API_KEY`). |
| `TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` + `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Test the bot-protection widget on `/register`. | Signup verifier short-circuits to "ok" in dev. |
| `PLATFORM_OPERATOR_ORG_ID=<uuid>` | Enables the `/admin/*` shell. Set to your owner-org's UUID. | `/admin/*` is hard-blocked. |
| `API_KEY_HMAC_SECRET` (`openssl rand -hex 32`) | Required to boot `apps/public-api` (Enterprise REST). | `apps/public-api` won't start. |
| `UNLEASH_URL_EU/ME` + `UNLEASH_API_TOKEN_EU/ME` | Real feature-flag evaluation. | All flags fall back to code-declared defaults (graceful). |
| `HMRC_PLATFORM_VRN` | UK VAT verification flows. | VIES/HMRC lookup features disabled. |
| `AZURE_BOT_APP_ID/SECRET` | Microsoft Teams notification adapter. | Teams adapter disabled. |
| `SEED_PASSWORD=Test1234!` | Shared password for every seeded user (default already `Test1234!`). | Defaults to `Test1234!`. |

Tick what you've configured:

- [ ] APP_URL / BETTER_AUTH_URL aligned
- [ ] R2 bucket naming verified (region buckets exist OR consolidated to one)
- [ ] DEV_SMTP_HOST set (Mailpit on)
- [ ] PLATFORM_OPERATOR_ORG_ID set (admin testable)
- [ ] TURNSTILE keys set (signup widget testable)
- [ ] API_KEY_HMAC_SECRET set (public-api testable)
- [ ] UNLEASH set (real feature flag tests)
- [ ] ANTHROPIC_API_KEY real (OCR testable)

---

## 1. Local Setup

### 1.1 Toolchain

```bash
nvm use                                # uses .nvmrc (Node version pinned)
corepack enable
corepack prepare pnpm@10.33.2 --activate
pnpm --version                         # should be 10.33.2
```

- [ ] Node + pnpm versions match `package.json#engines`.

### 1.2 Install + bootstrap

```bash
pnpm install                           # postinstall builds validators/auth/integrations/logger/api
node scripts/setup.mjs                 # sanity-check + tells you what's missing
pnpm db:generate                       # Prisma client
```

- [ ] `pnpm install` finishes clean (no peer-dep errors that block).
- [ ] `setup.mjs` prints all `✓` checks.
- [ ] `pnpm db:generate` writes `packages/db/src/generated/prisma/client/`.

### 1.3 Database

DB is hosted on Neon (cloud) — no local Postgres needed. Schema is already
deployed if `pnpm db:push` was run in the past; otherwise:

```bash
pnpm db:push                           # apply schema to Neon (single region)
# or, with seed data:
pnpm db:seed:dev -- --profile=showcase --confirm
```

`--profile=showcase` produces 1 fully-populated demo org with every state
(invoices in every lifecycle, payment runs, reminders, equipment, e-invoicing
events, portal sessions). Other profiles: `empty`, `solo`, `small` (default),
`medium`, `huge`, `all`.

> Default seeded password: `Test1234!` (set via `SEED_PASSWORD`). Logins
> for seeded users are listed in stdout when the script finishes.

- [ ] Schema applied to Neon (or seed ran successfully).
- [ ] Captured one seeded login email/password (write below).

```
Seed login (owner): __________________________
```

### 1.4 Required local services (Docker)

```bash
docker compose up -d clamav            # REQUIRED for any file-upload flow
```

Optional dev tooling:

```bash
docker compose --profile dev-tooling up -d   # Mailpit, MinIO, CloudBeaver, Redis Insight, dev-portal
docker compose --profile unleash up -d        # Local Unleash on :4242
docker compose --profile infisical up -d      # Self-hosted secret manager on :8090
```

- [ ] `clamav` container healthy (`docker ps` shows `(healthy)`).
- [ ] (optional) Mailpit reachable at `http://localhost:8025`.
- [ ] (optional) MinIO console at `http://localhost:9001`.

### 1.5 Start the dev stack

```bash
pnpm dev                               # turbo dev — apps/web :3000, landing :3001, cms :3002, public-api :4100
```

Smoke checks before flows:

- [ ] `http://localhost:3000` loads the dashboard root (redirects to `/en` or your default locale).
- [ ] `http://localhost:3000/api/health` returns `200` JSON with all probes `ok` or `skipped`. **If `r2: fail`, the canary key is missing — that's OK for local but flag it.**
- [ ] `http://localhost:3001` loads the landing page (`apps/landing`).
- [ ] `http://localhost:3002` loads the CMS/blog (`apps/cms`) — only after Payload migrations + CMS env (skip if you're not exercising CMS locally).
- [ ] `http://localhost:4100/health` (`apps/public-api`) — only if `API_KEY_HMAC_SECRET` is set.
- [ ] No "Environment validation failed" stack trace in `pnpm dev` output.
- [ ] No `console.*` warnings from `lint:logs` baseline.

---

## 2. Cross-cutting smoke (run once)

| # | Check | Pass | Notes |
|---|---|---|---|
| S1 | `/api/health` returns 200 with all configured probes `ok` |  |  |
| S2 | Dev server starts without env validation errors |  |  |
| S3 | Sentry receives a test event (throw in a server action, check Sentry inbox) |  |  |
| S4 | Pino logs show structured JSON (not human-formatted) in `pnpm dev` |  |  |
| S5 | Dashboard root redirects unauthenticated users to `/{locale}/login` |  |  |
| S6 | Switching locale URL (`/en` → `/de` → `/pl` → `/ar`) renders translated UI |  |  |
| S7 | `/ar/...` flips layout to RTL (verify body `dir="rtl"`) |  |  |
| S8 | Hitting `/api/trpc/...` 11 times in a minute returns `429` after 60 (rate limit) |  |  |
| S9 | Bad route returns localized `not-found.tsx` (not Next.js default) |  |  |
| S10 | Sentry `tunnelRoute` requests succeed (no CORS errors in browser console) |  |  |

---

## 3. Auth & Onboarding (`/[locale]/(auth)/*`)

| # | Flow | Happy / Edge | Pass | Notes |
|---|---|---|---|---|
| A1 | Visit `/register`, sign up with new email + password | Happy |  |  |
| A2 | Receive verification email (Mailpit if `DEV_SMTP_HOST` set, otherwise inbox) and click link → land on `/verify-email` confirmed | Happy |  |  |
| A3 | Try logging in **before** verifying — should be blocked / prompted | Edge |  |  |
| A4 | Log in with verified user → lands on dashboard `/{locale}/` | Happy |  |  |
| A5 | Log in with **wrong password** 11× — auth limiter (10/min) returns 429 with `Retry-After` | Edge |  |  |
| A6 | "Sign in with Google" round-trip succeeds | Happy |  |  |
| A7 | "Sign in with Microsoft" round-trip succeeds | Happy |  |  |
| A8 | Email/password reset request fires email | Happy |  |  |
| A9 | Reset link consumed twice — second use rejected | Edge |  |  |
| A10 | Org owner sends invite from `/settings/members` → invitee receives email | Happy |  |  |
| A11 | Click invite link `/invite/[token]`, accept, become member | Happy |  |  |
| A12 | Replay accepted invite link → rejects (already-consumed) | Edge |  |  |
| A13 | Open expired invite token → friendly error (not stack trace) | Edge |  |  |
| A14 | Log out → session cookie cleared, dashboard URLs redirect to login | Happy |  |  |
| A15 | Try `/dashboard` URL while logged-out → redirects to login with `?redirect=` preserved | Edge |  |  |
| A16 | Turnstile widget renders on `/register` (only if `NEXT_PUBLIC_TURNSTILE_SITE_KEY` set) | Edge |  |  |

---

## 4. Onboarding & Org Setup (post-signup)

| # | Flow | Happy / Edge | Pass | Notes |
|---|---|---|---|---|
| O1 | First login lands on onboarding/setup wizard (or empty dashboard) | Happy |  |  |
| O2 | Create the first organisation; saved to DB; user becomes owner | Happy |  |  |
| O3 | Set `dataRegion` (EU vs ME) — verify subsequent reads/writes routed correctly | Happy |  |  |
| O4 | `/onboarding/import` — bulk-import contractors via CSV; validates, previews, commits | Happy |  |  |
| O5 | Bulk import with malformed CSV → row-level errors surfaced, no partial commit | Edge |  |  |
| O6 | Org-create rate limit: try 6 org creations in 1m — 6th returns 429 (NEW-SEC-05 fix) | Edge |  |  |

---

## 5. Dashboard Home (`/[locale]/(dashboard)/`)

| # | Flow | Happy / Edge | Pass | Notes |
|---|---|---|---|---|
| D1 | Dashboard renders with KPI cards (`dashboard.kpis` query) — counts match seeded data | Happy |  |  |
| D2 | Skeleton states show for ≤ 1s before data resolves | Happy |  |  |
| D3 | Quick actions (new contractor, new invoice, new contract) link correctly | Happy |  |  |
| D4 | Sidebar nav highlights the active route | Happy |  |  |
| D5 | Empty-state for brand new org (no contractors yet) renders the "get started" panel | Edge |  |  |

---

## 6. Contractors (`/[locale]/(dashboard)/contractors`)

| # | Flow | Happy / Edge | Pass | Notes |
|---|---|---|---|---|
| C1 | List page paginates, filters, sorts | Happy |  |  |
| C2 | Create new contractor with full profile (name, email, country, billing) | Happy |  |  |
| C3 | Add VAT/tax IDs; validation per country (UK UTR, DE USt-IdNr, PL NIP) | Happy |  |  |
| C4 | Country mismatch (UK contractor, DE VAT format) → validation error | Edge |  |  |
| C5 | Edit contractor; audit log captures before/after | Happy |  |  |
| C6 | Archive contractor; disappears from active list, still visible filtered | Happy |  |  |
| C7 | Open `/contractors/[id]` — full profile + tabs (engagements, classification, etc.) | Happy |  |  |
| C8 | Delete contractor with active engagements → blocked with explanation | Edge |  |  |

---

## 7. Engagements & Classification (`/contractors/[id]/engagements/...`)

| # | Flow | Happy / Edge | Pass | Notes |
|---|---|---|---|---|
| CL1 | Create engagement; classification assessment auto-prompted | Happy |  |  |
| CL2 | Run a classification assessment; produces RAG status + decision | Happy |  |  |
| CL3 | Save assessment, view at `/classification/[assessmentId]` | Happy |  |  |
| CL4 | Request expert help (`/classification/expert-help`) — submits ticket | Happy |  |  |
| CL5 | Reassess with changed answers → new assessment version, history preserved | Edge |  |  |
| CL6 | High-risk classification triggers `/approvals` queue entry | Edge |  |  |

---

## 8. Contracts (`/[locale]/(dashboard)/contracts`)

| # | Flow | Happy / Edge | Pass | Notes |
|---|---|---|---|---|
| CT1 | List contracts with status badges (DRAFT / SENT / SIGNED / TERMINATED) | Happy |  |  |
| CT2 | Create contract from template; rate periods + amendments | Happy |  |  |
| CT3 | Send for e-signature (DocuSign) — redirect to envelope | Happy |  |  |
| CT4 | Send for e-signature (Autenti) — only if real Autenti creds set | Edge / N/A |  |  |
| CT5 | Webhook callback updates contract to SIGNED automatically | Happy |  |  |
| CT6 | View signed contract PDF inline | Happy |  |  |
| CT7 | Terminate contract — reason captured, audit log entry written | Happy |  |  |
| CT8 | Try editing a SIGNED contract — blocked, requires amendment instead | Edge |  |  |

---

## 9. Invoices — Internal (`/[locale]/(dashboard)/invoices`)

| # | Flow | Happy / Edge | Pass | Notes |
|---|---|---|---|---|
| I1 | List invoices, filter by lifecycle state | Happy |  |  |
| I2 | Open invoice detail `/invoices/[id]` — line items, totals, attachments | Happy |  |  |
| I3 | Create manual invoice; tax calc per jurisdiction | Happy |  |  |
| I4 | Approve invoice via `/approvals` queue | Happy |  |  |
| I5 | Reject invoice with comment → notifies submitter | Happy |  |  |
| I6 | Mark invoice as PAID manually | Happy |  |  |
| I7 | Void invoice; cannot be re-activated | Edge |  |  |

---

## 10. Invoice Intake / OCR (`/invoices/intake`)

> Skip section if `ANTHROPIC_API_KEY=__DEVELOPMENT__` (placeholder).

| # | Flow | Happy / Edge | Pass | Notes |
|---|---|---|---|---|
| OCR1 | Drag-drop a PDF invoice onto `/invoices/intake` | Happy |  |  |
| OCR2 | ClamAV scan passes (file upload < 10s) | Happy |  |  |
| OCR3 | OCR job processes; `/invoices/intake/[id]` shows extracted fields | Happy |  |  |
| OCR4 | Edit OCR'd fields; save creates draft invoice | Happy |  |  |
| OCR5 | Upload an EICAR test file → ClamAV blocks, error toast shown | Edge |  |  |
| OCR6 | Upload non-PDF (e.g. .exe) → MIME validation rejects | Edge |  |  |
| OCR7 | Upload >25 MB file → size limit error | Edge |  |  |
| OCR8 | Anthropic API returns 5xx → user sees "OCR temporarily unavailable", file preserved | Edge |  |  |

---

## 11. Approvals Queue (`/[locale]/(dashboard)/approvals`)

| # | Flow | Happy / Edge | Pass | Notes |
|---|---|---|---|---|
| AP1 | Queue lists pending approvals (invoices + classification escalations) | Happy |  |  |
| AP2 | Approve item — moves to history | Happy |  |  |
| AP3 | Reject item with mandatory comment | Happy |  |  |
| AP4 | Multi-step approval: step 1 approver passes, step 2 approver receives notification | Happy |  |  |
| AP5 | Approver tries to act on item outside their step → 403 | Edge |  |  |

---

## 12. Payments / Payment Runs (`/payments`)

| # | Flow | Happy / Edge | Pass | Notes |
|---|---|---|---|---|
| P1 | List existing payment runs with status badges | Happy |  |  |
| P2 | Create a new run; pick approved invoices to include | Happy |  |  |
| P3 | Run preview shows totals per currency / per contractor | Happy |  |  |
| P4 | Export BACS / SEPA file — file downloads, header valid | Happy |  |  |
| P5 | Mark run as EXECUTED; included invoices flip to PAID | Happy |  |  |
| P6 | Cancel run before execution; invoices remain APPROVED | Happy |  |  |
| P7 | Try to include the same invoice in two open runs → blocked (advisory lock) | Edge |  |  |

---

## 13. Reports & Time (`/reports`, `/time`)

| # | Flow | Happy / Edge | Pass | Notes |
|---|---|---|---|---|
| R1 | Reports dashboard renders charts (recharts) — no NaN values | Happy |  |  |
| R2 | Export report as CSV — file structure correct | Happy |  |  |
| R3 | Time tracking calendar shows entries per contractor | Happy |  |  |
| R4 | Add manual time entry; appears immediately | Happy |  |  |
| R5 | Filter by contractor (`/time/[contractorId]`) | Happy |  |  |

---

## 14. Equipment (`/equipment`)

| # | Flow | Happy / Edge | Pass | Notes |
|---|---|---|---|---|
| EQ1 | List equipment, filter by status (ASSIGNED / RETURNED / IN_TRANSIT) | Happy |  |  |
| EQ2 | Add new equipment item with serial + cost | Happy |  |  |
| EQ3 | Assign to contractor — shipment created | Happy |  |  |
| EQ4 | InPost webhook updates shipment status (only if real provider configured) | Edge / N/A |  |  |
| EQ5 | Mark as returned, generate return shipping label | Happy |  |  |

---

## 15. Workflows (`/workflows`)

| # | Flow | Happy / Edge | Pass | Notes |
|---|---|---|---|---|
| W1 | List workflow templates and runs | Happy |  |  |
| W2 | Create new template (`/workflows/templates/new`) — visual editor saves | Happy |  |  |
| W3 | Trigger a workflow manually; `/workflows/[id]` shows step states live | Happy |  |  |
| W4 | A failing step records error and shows retry button | Edge |  |  |
| W5 | Edit template that has active runs → warning, only future runs use new version | Edge |  |  |

---

## 16. Settings — `/settings/*`

| # | Flow | Happy / Edge | Pass | Notes |
|---|---|---|---|---|
| ST1 | `/settings` — general org settings (name, logo, locale, dataRegion) | Happy |  |  |
| ST2 | `/settings/members` — list members + roles | Happy |  |  |
| ST3 | Change member role (owner → admin → member) | Happy |  |  |
| ST4 | Remove member; their sessions invalidated | Happy |  |  |
| ST5 | `/settings/payments` — connect bank, configure payment runs | Happy |  |  |
| ST6 | `/settings/calendar` — connect Google / Outlook calendar (OAuth round-trip) | Happy |  |  |
| ST7 | `/settings/e-invoicing` — KSeF (PL) configuration; cert upload | Happy |  |  |
| ST8 | `/settings/integrations/zatca` — Saudi e-invoicing setup | Happy |  |  |
| ST9 | Stripe billing portal opens (`/settings/billing` if exposed, or via Stripe CTA) | Happy |  |  |
| ST10 | Trial banner appears for trial orgs; CTA opens checkout | Happy |  |  |
| ST11 | Disconnect a calendar integration — token revoked, encrypted blob deleted | Happy |  |  |

---

## 17. Portal — Contractor-side (`/[locale]/(portal)/portal/*`)

> Test from the contractor's perspective using a magic link.

| # | Flow | Happy / Edge | Pass | Notes |
|---|---|---|---|---|
| PR1 | `/portal/login` — enter email; magic link sent | Happy |  |  |
| PR2 | Click link in inbox / Mailpit — lands on `/portal/login/verify` | Happy |  |  |
| PR3 | Verify nonce; portal session created; lands on `/portal` | Happy |  |  |
| PR4 | Magic link reused → rejected (one-shot) | Edge |  |  |
| PR5 | Magic link >15 min old → expired error | Edge |  |  |
| PR6 | Portal limiter: request 11 magic links in 1 min → 429 | Edge |  |  |
| PR7 | `/portal/contracts` — see only own contracts | Happy |  |  |
| PR8 | Open a contract; sign via embedded signing flow | Happy |  |  |
| PR9 | `/portal/documents` — download own documents only | Happy |  |  |
| PR10 | Manipulate URL to another contractor's contract `/portal/contracts/<other-id>` → 404/403 | Edge |  |  |
| PR11 | `/portal/invoices/submit` — upload invoice PDF | Happy |  |  |
| PR12 | Submission success → `/portal/invoices/submit/success` | Happy |  |  |
| PR13 | Submission of >25 MB or wrong MIME → friendly error | Edge |  |  |
| PR14 | `/portal/equipment` — see assigned equipment + shipment status | Happy |  |  |
| PR15 | `/portal/payments` — see payment history (own only) | Happy |  |  |
| PR16 | `/portal/time` — log hours; visible to org-side `/time` page | Happy |  |  |
| PR17 | `/portal/settings` — update banking details (encrypted at rest) | Happy |  |  |
| PR18 | Subdomain routing: `acme.portal.localhost:3000` resolves to org "acme" portal (requires hosts file entry or `*.localhost` resolver) | Edge |  |  |
| PR19 | Logout — `POST /api/portal/clear-session` invalidates session | Happy |  |  |

---

## 18. Admin Shell (`/admin/*`)

> Skip if `PLATFORM_OPERATOR_ORG_ID` is not set.

| # | Flow | Happy / Edge | Pass | Notes |
|---|---|---|---|---|
| AD1 | `/admin/boe-rate` — view + update Bank of England base rate | Happy |  |  |
| AD2 | Update triggers backfill of late-payment-interest calculations | Happy |  |  |
| AD3 | `/admin/feature-flags/classification-engine` — toggle a flag | Happy |  |  |
| AD4 | Non-`platform_operator` user accessing `/admin/*` → 403 (F-SEC-04) | Edge |  |  |
| AD5 | User in non-operator org accessing `/admin/*` → 403 | Edge |  |  |

---

## 19. Legal pages (`/[locale]/(legal)/*`)

| # | Flow | Happy / Edge | Pass | Notes |
|---|---|---|---|---|
| L1 | `/privacy` renders MDX with TOC and anchor links | Happy |  |  |
| L2 | `/terms` renders | Happy |  |  |
| L3 | `/sub-processors` lists current data processors | Happy |  |  |
| L4 | `/breach-notification` renders | Happy |  |  |
| L5 | All pages translated for `de`, `pl`, `ar` (RTL) | Happy |  |  |

---

## 20. i18n & RTL

| # | Flow | Happy / Edge | Pass | Notes |
|---|---|---|---|---|
| I18N1 | `/en` UI is fully English | Happy |  |  |
| I18N2 | `/de` UI is fully German | Happy |  |  |
| I18N3 | `/pl` UI is fully Polish | Happy |  |  |
| I18N4 | `/ar` UI is fully Arabic; layout is RTL (sidebar on right) | Happy |  |  |
| I18N5 | Locale switcher in app preserves the current path | Happy |  |  |
| I18N6 | Currency / date / number formatting respects locale | Happy |  |  |
| I18N7 | Untranslated keys fall back to English (no raw `key.path` shown) | Edge |  |  |

---

## 21. Multi-tenancy isolation (security edge)

| # | Flow | Happy / Edge | Pass | Notes |
|---|---|---|---|---|
| MT1 | Create org A and org B with different users | Setup |  |  |
| MT2 | Switch active org; data swaps correctly (no leak) | Happy |  |  |
| MT3 | User of org A cannot access `/contracts/<orgB-id>` (404 not 200) | Edge |  |  |
| MT4 | Direct tRPC call with `orgB-id` returns `FORBIDDEN` | Edge |  |  |
| MT5 | Direct DB-id manipulation in URL (`/contractors/[other-orgs-id]`) → 404 | Edge |  |  |
| MT6 | Editing the `better-auth.active_organization` cookie does NOT escalate access (verified at tRPC layer, see `middleware/tenant.ts`) | Edge |  |  |

---

## 22. RBAC enforcement

| # | Flow | Happy / Edge | Pass | Notes |
|---|---|---|---|---|
| RB1 | Member role cannot delete contractors (UI hidden + tRPC blocks) | Edge |  |  |
| RB2 | Member cannot remove other members | Edge |  |  |
| RB3 | Admin can manage members but not delete the org | Edge |  |  |
| RB4 | Owner can do everything | Happy |  |  |
| RB5 | Demoted owner loses owner-only menu items immediately on next request | Edge |  |  |

---

## 23. Webhooks & external events

> Use Stripe CLI / ngrok / curl with the webhook secret to fire signed events.

| # | Flow | Happy / Edge | Pass | Notes |
|---|---|---|---|---|
| WH1 | `stripe trigger checkout.session.completed` updates org plan | Happy |  |  |
| WH2 | Wrong signature on `/api/webhooks/stripe` → 400 | Edge |  |  |
| WH3 | Resend `email.delivered` webhook updates audit log (`/api/webhooks/resend` via `[provider]`) | Happy |  |  |
| WH4 | DocuSign envelope-completed webhook flips contract status | Happy |  |  |
| WH5 | KSeF status-update poll (`/api/ksef/_sync`) writes events | Happy |  |  |
| WH6 | InPost shipment webhook (`/api/webhooks/inpost`) updates equipment shipment | Happy |  |  |
| WH7 | Storecove inbound (`/api/webhooks/storecove`) processes incoming PEPPOL invoice | Happy |  |  |
| WH8 | Replay attack (same delivery_id twice) → idempotent (no duplicate side-effects) | Edge |  |  |

---

## 24. Cron jobs (manual trigger via `CRON_SECRET`)

```bash
# Replace <SECRET> with $CRON_SECRET from .env
curl -H "Authorization: Bearer <SECRET>" http://localhost:3000/api/cron/reminders
curl -H "Authorization: Bearer <SECRET>" http://localhost:3000/api/cron/trial-notifications
curl -H "Authorization: Bearer <SECRET>" http://localhost:3000/api/cron/data-purge
curl -H "Authorization: Bearer <SECRET>" http://localhost:3000/api/cron/token-refresh
curl -H "Authorization: Bearer <SECRET>" http://localhost:3000/api/cron/job-health
```

| # | Endpoint | Pass | Notes |
|---|---|---|---|
| CR1 | `/api/cron/reminders` 200 + emails queued for due invoices |  |  |
| CR2 | `/api/cron/trial-notifications` 200 + trial-expiry emails for orgs near end |  |  |
| CR3 | `/api/cron/data-purge` 200 + retention cleanup runs |  |  |
| CR4 | `/api/cron/token-refresh` 200 + integration tokens rotated |  |  |
| CR5 | `/api/cron/boe-rate-poll` 200 (UK BoE rate fetched) |  |  |
| CR6 | `/api/cron/job-health` 200 + Cronitor heartbeat sent |  |  |
| CR7 | `/api/cron/inpost-status-poll` 200 + shipments updated |  |  |
| CR8 | `/api/cron/late-interest-pdf-reaper` 200 + stale PDFs removed |  |  |
| CR9 | `/api/cron/classification-economic-dependency` 200 |  |  |
| CR10 | `/api/cron/classification-reassessment-triggers` 200 |  |  |
| CR11 | Missing/wrong Authorization → 401 | Edge |  |

---

## 25. Background async (QStash + outbox)

| # | Flow | Happy / Edge | Pass | Notes |
|---|---|---|---|---|
| Q1 | Trigger an action that publishes to QStash (e.g. send invoice email) — message lands in QStash dashboard | Happy |  |  |
| Q2 | `/api/webhooks/_process` consumes message; outbox row marked SENT | Happy |  |  |
| Q3 | Force a 5xx in handler → message retries with backoff (verify retry count cap) | Edge |  |  |
| Q4 | Backpressure: hammer a route — `/api/health` reports `backpressure: fail` once over threshold | Edge |  |  |
| Q5 | `/api/outbox/_drain` empties pending events | Happy |  |  |

---

## 26. Error & not-found pages

| # | Flow | Happy / Edge | Pass | Notes |
|---|---|---|---|---|
| E1 | `/{locale}/foo-bar` → localized 404 page (`not-found.tsx`) | Edge |  |  |
| E2 | Server error in a page → `global-error.tsx` rendered (force with `throw` in a server component) | Edge |  |  |
| E3 | `/{locale}/(dashboard)/unauthorized` renders the canonical 403 view | Edge |  |  |
| E4 | Sentry captures the thrown error (visible in Sentry inbox) | Edge |  |  |

---

## 27. Performance & polish (light)

| # | Flow | Pass | Notes |
|---|---|---|---|
| PF1 | Cold dashboard load < 3s (Lighthouse / DevTools) |  |  |
| PF2 | Subsequent navigations under 500ms (RSC streaming) |  |  |
| PF3 | No layout-shift on auth pages |  |  |
| PF4 | Tab order is sensible on every page (a11y) |  |  |
| PF5 | All form fields have associated labels (a11y) |  |  |
| PF6 | Color contrast passes for primary CTAs (a11y) |  |  |

---

## 28. Public API (`apps/public-api`, Hono on `:4100`)

> Skip if `API_KEY_HMAC_SECRET` not set.

| # | Flow | Happy / Edge | Pass | Notes |
|---|---|---|---|---|
| PA1 | Issue an API key via `/settings/api-keys` (or tRPC), copy plaintext once | Happy |  |  |
| PA2 | `GET http://localhost:4100/v1/contractors -H "Authorization: Bearer <key>"` returns 200 JSON | Happy |  |  |
| PA3 | Bad key → 401 | Edge |  |  |
| PA4 | Revoked key → 401 immediately | Edge |  |  |
| PA5 | Rate limit (per key) returns 429 with `X-RateLimit-*` headers | Edge |  |  |

---

## 29. Final teardown

- [ ] No errors in browser console after a full pass.
- [ ] No `level=error` lines in the `pnpm dev` Pino output (warnings OK).
- [ ] Sentry inbox reviewed; only intentional test errors present.
- [ ] Mailpit inbox reviewed (if used) — every expected email arrived.
- [ ] R2 bucket inspected; uploaded files visible.

---

## Appendix A — Known limitations / things that won't work locally

| Feature | Reason | Workaround |
|---|---|---|
| Real KSeF e-invoice submission | Uses test endpoint (`api-test.ksef.mf.gov.pl`); already configured | Already wired up; results visible in `KSEF_DEBUG=1` logs |
| OCR invoice parsing | `ANTHROPIC_API_KEY=__DEVELOPMENT__` placeholder | Set a real key; or skip OCR rows |
| Autenti e-sign | Placeholder credentials | Use DocuSign instead (real keys configured) |
| Multi-region routing | `DATABASE_URL_EU` and `DATABASE_URL_ME` point to same DB | Acceptable for happy-path; flag region-specific behaviour rows as N/A |
| Teams integration | `AZURE_BOT_APP_ID` not set | Out of scope locally |
| Real feature flags | Unleash not configured locally | All flags fall back to code defaults — usable, just no toggle UI |
| Public-API Enterprise REST | `API_KEY_HMAC_SECRET` not set | Set the var to enable section 28 |
| Production-grade rate limit fail-CLOSED | Only fires when `NODE_ENV=production`; in dev, falls back to in-memory | Trust the production behaviour from automated tests |

## Appendix B — Useful commands while testing

```bash
# Watch the worker-cron output
pnpm --filter @contractor-ops/web exec node worker-cron.mjs

# Tail Pino logs prettified
pnpm dev | npx pino-pretty

# Inspect DB with CloudBeaver (if dev-tooling profile up)
open http://localhost:8978

# Mailpit inbox (if dev-tooling profile up)
open http://localhost:8025

# Type-check without building
pnpm typecheck

# Hit health endpoint
curl -s http://localhost:3000/api/health | jq

# Reset and reseed the DB
pnpm db:push --force-reset && pnpm db:seed:dev -- --profile=showcase --confirm
```

## Appendix C — Quick env-doctor command

```bash
node -e "
const { validateServerEnv } = require('./packages/validators/dist/env.js');
require('dotenv').config({ path: '.env' });
try { validateServerEnv(); console.log('✅ Env OK'); }
catch (e) { console.error(e.message); process.exit(1); }
"
```

---

**Found a problem?** Drop a line in the relevant **Notes** column and reference
the row id (e.g. *"OCR4: extracted amount lost the decimal point on a EUR
invoice"*). When done, hand this file back and we can convert the open items
into GitHub issues.
