---
gsd_state_version: 1.0
milestone: v7.0
milestone_name: GTM Expansion
status: ready_to_plan
stopped_at: Phase 82 complete (4/4) — ready to discuss Phase 83
last_updated: 2026-06-07T19:38:28.362Z
last_activity: 2026-06-07
progress:
  total_phases: 20
  completed_phases: 1
  total_plans: 4
  completed_plans: 4
  percent: 5
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-07 — v7.0 GTM Expansion started; v6.0 shipped 2026-06-07)

**Core value:** The invoice-to-payment flow must work end-to-end: invoice arrives, gets matched to contract, routed through approval, and batched for payment — with full audit trail and zero manual tracking in spreadsheets.
**Current focus:** Phase 83 — theme a — us region infrastructure

## Current Position

Phase: 83
Plan: Not started
Status: Ready to plan
Last activity: 2026-06-07

Progress: [██████████] 100%

## v7.0 Roadmap Summary (created 2026-06-07)

20 phases (82–101) covering 107 requirements. Themes A/B/C run **parallel** after Foundation (Phase 82); only hard serialization points are WORKER-01 (Phase 89, Theme B gate) and INTEG-API-01 (Phase 98, Theme C gate).

| Phase | Name | Reqs | Theme | Notes |
|---|---|---|---|---|
| 82 | Foundation — Add-On + Flags + US Region | 3 | shared | starts IRIS TCC ~45-day clock |
| 83 | US Region Infrastructure | 3 | A | precedes US-data creation |
| 84 | US Profile Fields + en-US Locale | 5 | A | USPS 60 req/hr throttle |
| 85 | W-Form Intake + Tax-Treaty Engine | 4 | A | treaty table precedes 1042-S |
| 86 | TIN-Match → 1099-NEC → IRIS → State | 4 | A | IRIS A2A hand-built XML; PAF prereq |
| 87 | 1042-S + US Classification + Letter | 5 | A | US-CLASS-04 likely ai-integration-phase |
| 88 | US Payment Rail | 5 | A | NACHA in payment-export factory |
| 89 | Worker Model Abstraction (gate) | 5 | B | ONLY Theme B serialization point |
| 90 | Employee Registry per Market (×6) | 6 | B | new tenant-owning models — leak tests |
| 91 | Akta Osobowe / Personnel File | 4 | B | composes v6.0 F1 |
| 92 | Leave + KP-Grade Time Tracking | 6 | B | e-ZLA/eAU deferred v7.5 |
| 93 | Employee On/Offboarding | 3 | B | extends v6.0 F4 |
| 94 | Payroll Integration Adapters | 7 | B | ADP partner lead-time risk |
| 95 | HRIS Two-Way Sync | 6 | B | research-gated: BambooHR + Personio |
| 96 | Employee Self-Service Portal | 4 | B | extends v2.0 portal |
| 97 | HR Dashboard | 5 | B | composes v6.0 F1 + F3 |
| 98 | Public REST API Surface (gate) | 5 | C | ONLY Theme C serialization point |
| 99 | API Keys + Scopes + Rate Limiting | 5 | C | closes BFLA gap |
| 100 | Outbound Webhooks + Integration Security | 12 | C | SSRF before dispatch; OWASP gate |
| 101 | Marketplace Listings + Dev Experience | 10 | C | external review timelines |

**Research-gated phases (flag for /gsd:plan-phase --research-phase or ai-integration-phase):**

- Phase 86 (US-FORM-05 IRIS A2A — no Node lib; TCC ~45-day lead; transmitter-adapter seam fallback) + US-FORM-03 TIN-Matching PAF per-org prerequisite
- Phase 87 (US-CLASS-04 Determination Letter — AI generation)
- Phase 94 (PAYROLL-US ADP Marketplace partner + mTLS lead-time; QuickBooks+Gusto = v7.0 floor, ADP possibly v7.1)
- Phase 95 (HRIS-SYNC-04 BambooHR custom-attribute contract unverified; HRIS-SYNC-01/02 Personio rate-limit MEDIUM confidence)
- Phase 100 (INTEG-SEC-04 OWASP review = automated tests, not prose)

**Load-bearing research corrections (already reflected in REQUIREMENTS.md):** IRIS-PRIMARY (FIRE decommissions 2026-12-31); 1099-NEC threshold $2,000 TY2026 as config table; 1099-K $20,000+200; API-key storage HMAC-SHA256 (not bcrypt).

## Performance Metrics

**Velocity:**

- v6.0 shipped: 12 phases (70–81), 90 plans, 392 tasks (full history: `.planning/milestones/v6.0-*`)
- v7.0: 0 plans completed

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table. Recent decisions affecting v7.0:

- [v7.0 backlog, 2026-05-31]: `Workforce` + `US Cross-Border` add-on SKUs via `requireAddOn` middleware (composes after `requireTier`); Theme C tier-gated within base (Starter read / Pro read+write / Enterprise unlimited)
- [v7.0 backlog, 2026-05-31]: Themes A/B/C parallel; WORKER-01 only hard Theme B serialization point; INTEG-API-01 Theme C foundation
- [v7.0 research, 2026-06-07]: Reuse-don't-rebuild — ACH NACHA = payment-export factory; outbound webhooks ride OutboxEvent outbox (NOT inbound webhook-dispatcher); Personio/BambooHR/payroll on v2.0 integration framework; US-CLASS extends v5.0 classification; public-api already has Hono + OpenAPI/Scalar + rate-limiter + apiKeyTenantProcedure
- [v7.0 research, 2026-06-07]: `us-east-1` is a 4-place atomic change (SUPPORTED_REGIONS / DataRegion enum / DATABASE_URL_US / buildLazyBag coercion) with a lockstep test — Phase 82/83
- [v7.0 research, 2026-06-07]: never add v7.0 tenant-owning models to `globalModels` (IDOR landmine); two-org cross-leak test per new model
- [Phase ?]: [82-01, 2026-06-07]: Wave 0 RED scaffolds for FOUND7-01/02/03; error-handler.test.ts extended (pre-existing) not recreated; 5-way region lockstep split across packages/db + feature-flags (no new dep edge); IRIS TCC ~45-day clock started 2026-06-07, earliest-ready 2026-07-22 (Phase 86 / US-FORM-05)
- [Phase ?]: [82-02, 2026-06-07]: us-east-1 enabled across the five-way lockstep (SUPPORTED_REGIONS/DataRegion/regionSchema/REGION_ENV_MAP/REPLICA_ENV_MAP); DATABASE_URL_US OPTIONAL (D-06, lazy-throw on access); buildLazyBag explicit US branch (no silent EU coercion, T-82-02-01); 'payroll' flag category added in schemas.ts for 82-03; seed-dev US seed-org deferred to Phase 83
- [Phase ?]: [82-04, 2026-06-07]: FOUND7-01 add-on primitive — Subscription.addOns String[] (additive); requireAddOn clones tier.ts (ADD_ON_REQUIRED FORBIDDEN JSON); workforceProcedure/usCrossBorderProcedure = tenant -> requireTier(STARTER) -> requireAddOn (D-11); owner-gated audit-logged cache-invalidating grantAddOn (D-03, Stripe SKU deferred); schema via scoped ALTER (db push fallback, migrate dev blocked by pre-existing migration-history drift); per-region prod apply deferred
- [Phase ?]: [82-03, 2026-06-07]: FOUND7-02 — 19 v7.0 flags registered PENDING (D-09 dot-namespaced) + V7_FLAG_KEYS cohort; 10 narrow gated prefixes (pre-v7.0 non-gated flags unaffected, D-10); assertFlagSignoffsOrExit() wired into all three app boots (api/public-api/cron-worker) — the load-bearing UNWIRED-gate fix; boot passes clean with 19 PENDING entries (no exit(1)); feature-flags added as direct dep to api+public-api (was phantom)

### Pending Todos

- Next: `/gsd:plan-phase 82` (v7.0 Foundation). Phase 82 + 83 + 89 + 98 are STANDARD (verified in-tree patterns); the research-gated phases above need `--research-phase`.
- Standing reminder: every v7.0 Unleash flag must register PENDING in `signoff-registry.ts` (FOUND7-02 / Phase 82); boot-gate enforces it.

### Blockers/Concerns

- **Tooling history (v6.0):** several v6.0 plan/execute runs hit a nested-agent `Task`-API limit + a missing `~/.claude/sdk/shared/model-catalog.json` (RESOLVED by 2026-05-31 — `gsd-sdk query` returns valid JSON). If a background `/gsd:plan-phase` run again cannot spawn `gsd-phase-researcher`/`gsd-planner`/`gsd-plan-checker`, run it from a **top-level** interactive session.
- **`.planning/phases` is a symlink** — stage planning commits via the real `milestones/vX.Y-phases/` path (git add/commit through the symlink fails "beyond a symbolic link").

## Deferred Items

Carried forward from v6.0 milestone close (2026-06-07). Full enumeration: `.planning/milestones/v6.0-MILESTONE-AUDIT.md`. All consistent with Standing Project Constraints (LOCAL-ONLY, legal/manual-UI verification deferred to post-deploy — never hard-blocking).

| Category | Item | Status |
|----------|------|--------|
| requirement | OFFB-06 — e-sign IP-ratification signing + webhook atomic flow (OWNER-override unblocks) | deferred-by-design |
| migration_apply | Phase 72/73/74/75/76 + 76-WR1 additive migrations — apply per region (`pnpm db:migrate:all` EU then ME) post-merge | open |
| tech-debt | 76-WR1 — confirm `@@unique([organizationId, idempotencyKey])` applied on live Neon EU before relying on runtime P2002 | open |
| tech-debt | Per-phase code-review never run for phases 72/73/75/76/77/78 (pre-standards plans) | open |
| deferred-refactor | Consolidate 3 per-provider connection routers (entra/okta/github) into `deprovisioning.enableProviderForOrg` (78 WR-1) | open |
| verification-coverage | Phases 70/71/75 — no/partial VERIFICATION.md | deferred |
| manual-uat | 28 open human-UAT scenarios across phases 72/79/80/81 | partial |
| i18n_review | Phase-73 machine-translated ar.json strings — native review pre-prod | open |
| legal_signoff | 24 PENDING signoff-registry namespaces (US tax-form copy, akta/Personalakte retention, per-market statutory paperwork) — per-adviser PRs post-deploy | open |
| Phase 82 P82-01 | 10m | 3 tasks | 7 files |
| Phase 82 P02 | 9m | 3 tasks | 9 files |
| Phase 82 P82-04 | ~14m | 3 tasks | 8 files |
| Phase 82 P82-03 | 18m | 3 tasks | 11 files |

## Standing Project Constraints

- **Deployment status: LOCAL-ONLY.** Not deployed to production; no external users / regulated customers / live data.
- **Legal/regulatory verification is DEFERRED.** Features needing external sign-off (US tax-form copy, akta-osobowe/Personalakte retention, IR35/DRV wording, PDPL, etc.) ship working code annotated "Needs verification by jurisdiction-specific legal/tax adviser before production deploy" and recorded as post-merge items — must NOT hard-block build/CI/local-exec. No STATE.md blockers for missing legal sign-off unless a plan explicitly hard-stops.
- **Codebase standards override plan templates.** Prisma enum values `UPPER_SNAKE_CASE` (`db:audit-enum-casing`); no hardcoded user-facing strings (`useTranslations` + i18n parity en/de/pl/ar — and en-US for v7.0 US surfaces); run the relevant gates before marking a plan done (`lint:schema`, `lint:audit-log`, `lint:raw-sql`, `lint:logs`, `lint:silent-catch`, `i18n:parity`, `check:web-vite-*`). Fix only your own additions, not pre-existing unrelated offenders.

## Session Continuity

Last session: 2026-06-07T19:28:11.502Z
Stopped at: Completed 82-04-PLAN.md
Resume file: None
Next command: `/gsd:plan-phase 82`
