---
gsd_state_version: 1.0
milestone: v7.0
milestone_name: GTM Expansion
status: verifying
stopped_at: Completed 89-01-PLAN.md (Wave-0 contractor.* route-shape snapshot + contractor-parity baseline GREEN pre-Worker; backfill + withWorkerTypeDefault RED scaffolds)
last_updated: "2026-06-22T00:00:41.730Z"
last_activity: 2026-06-21
progress:
  total_phases: 20
  completed_phases: 4
  total_plans: 57
  completed_plans: 27
  percent: 20
---

# Project State

## Agent bootstrap

**Start here:** [.planning/INDEX.md](./INDEX.md) — codebase maps, intel queries, brain wiki [`.planning/brain/`](./brain/), invariants in [MEMORY.md](./MEMORY.md).

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-07 — v7.0 GTM Expansion started; v6.0 shipped 2026-06-07)

**Core value:** The invoice-to-payment flow must work end-to-end: invoice arrives, gets matched to contract, routed through approval, and batched for payment — with full audit trail and zero manual tracking in spreadsheets.
**Current focus:** Phase 86 — Theme A — TIN-Match → 1099-NEC → IRIS E-File → State Filing

## Current Position

Phase: 86 (Theme A — TIN-Match → 1099-NEC → IRIS E-File → State Filing) — EXECUTING
Plan: 86-05 of 8 complete (86-02/03/05 done; 86-01 Task 3 + 86-02 Task 3 multi-region migration held at human gates; 86-04 not yet run)
Status: Phase complete — ready for verification
Last activity: 2026-06-21

Progress: [█████░░░░░] 47%

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
- v7.0: Phase 85 Plan 03 completed (portal/staff W-form routers + immutable record service; 85-01 schema/seed landed with its migration checkpoint resolved, 85-02 engine/validators)

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
- [Phase ?]: [83-01]: Postgres DataRegion enum widened to { EU ME US } via additive ALTER TYPE ADD VALUE IF NOT EXISTS (dev DB; migrate dev drift-blocked); per-region prod apply deferred. Lockstep test now asserts Prisma enum == SUPPORTED_REGIONS (closes Phase-82 Pitfall-1 drift). Wave 0 RED scaffolds laid for retention resolver (Plan 04) + resolveDataRegionFromBilling org-creation hook (Plan 02).
- [Phase ?]: [83-02]: US-INFRA-01 routing complete — beforeCreateOrganization is the single immutable origin of dataRegion='US' (D-01); billingCountry input-only/Zod-validated/not-persisted (derive-and-strip); OrgMeta.dataRegion + all 'EU'|'ME' cast sites widened to shared DataRegion; tenant.ts widened structurally via OrgMeta; seed-dev types widened, runtime CLI EU/ME-only.
- [Phase 83-03]: US-INFRA-02 — REGION_BUCKET_MAP widened to Record<DataRegion> (compile-time lockstep, missing US fails tsc); US branch lazy-throws when R2_BUCKET_NAME_US unset, resolves when set (ONE US bucket for all US-org files incl. tax archives, D-03); R2_BUCKET_NAME_US OPTIONAL no-default in env schema + .env.example (DATABASE_URL_US posture); DATA_HOSTING_REGION left EU/ME (deployment knob, not per-org routing, D-08).
- [Phase 83]: [83-04, 2026-06-07]: US-INFRA-03 — ONE statutory-retention resolver in packages/db (RETENTION_YEARS 4y 1099-NEC / 7y backup-withholding; MODEL_RETENTION_TYPE ships EMPTY per D-06) consumed by all three deletion chokepoints — soft-delete extension, the load-bearing base-prisma data-purge cron (per-model cutoffFor), and gdpr RODO erasure (softDeleteByOrgAndCount + retainedUnderStatute citation + writeAuditLog); statutory hold supersedes retainFinancialRecords=false; verified against the Invoice fixture; citations annotated LOCAL-ONLY. Theme B AKTA-02/03 extend the same resolver.
- [Phase ?]: Phase 84 Wave-0: six RED scaffolds lock EIN/SSN/crypto/revealSsn-RBAC/USPS/web-vite contracts; RED accepted as terminal (Waves 1-4 turn GREEN)
- [Phase ?]: Phase 84-01: SSN_ENCRYPTION_KEY is a NEW separate hex-32 key (blast-radius separation, D-01); SSN excluded from countryFields JSONB — dedicated encrypted columns land in Plan 03
- [Phase ?]: [84-02]: en-US registered as fallback-aware (NOT strict) i18n:parity peer — thin en-US.json passes via fallbackPeers (peerKeys union en keys); de/pl/ar keep exact-parity (T-84-02-01 preserved); fallbackLng map en-US to en to pl; pickBestLocale exact region-tag match wins (en-US sticks, en-GB to en); US copy keys deferred to Plan 05
- [Phase ?]: [84-03] SSN encrypt-at-rest in dedicated Contractor columns (ssnEncrypted/ssnLast4), never countryFields JSONB (D-01); keyed by a separate SSN_ENCRYPTION_KEY (blast-radius isolation)
- [Phase ?]: [84-03] contractorPii:read granted to owner/admin/finance_admin ONLY; external_accountant + 6 others DENIED (D-09); a new Better Auth permission requires editing BOTH accessControlStatement and the roles.ts allPermissions owner-duplicate (Pitfall 2)
- [Phase ?]: [84-03] columns applied via direct additive ALTER (db push fallback; migrate dev drift-blocked); per-region production apply deferred (Phase 82/83 posture)
- [Phase ?]: 84-04: USPS rate limiter keyed on FIXED GLOBAL 'usps-global' (60/hr per-credential), NOT organizationId (Pitfall 4, D-03)
- [Phase ?]: 84-04: USPS adapter fail-open advisory — throttle/5xx/network/Redis-down/malformed/missing-creds → unverified, never throws to save (D-03)
- [Phase ?]: 84-05: SSN encrypted into dedicated ssnEncrypted/ssnLast4 columns (never countryFields JSONB); revealSsn staff-router-only + contractorPii:[read] + audit-logged (no SSN in row); USPS validation advisory/non-blocking on save (D-01/D-02/D-03)
- [Phase ?]: [84-06] US contractor UI: SsnMaskedReveal gated reveal (absent-without-contractorPii:read, audit-logged via use-reveal-ssn hook, no full SSN in DOM); UspsAddressStatusPill advisory (never blocks save); case 'US' = place 3 of 3 in CountryFieldsDispatch; reveal-button accessible name = visible text (WCAG Label-in-Name); en base American + de/pl/ar parity + thin en-US overrides
- [Phase 85]: [85-01, 2026-06-16] Treaty engine extends WithholdingTaxRate additively (one nullable treatyArticle column; serviceType reused as income-type axis 'business_profits'; 4-field @@unique key UNTOUCHED — adding a 5th breaks the seed upsert + calculateWht lookup). US seed rows in whole-number percent (30.0/0.0/null, never fractions). AE/SA have NO US income-tax treaty → 30% statutory (treatyRate null); only PL/DE/GB/IE/NL reduce to 0% (Article 7). TaxFormSubmission is append-only + supersede-chain, FK'd to Contractor not Worker (Worker = Theme B/P89). Generated Prisma client is tracked in-repo → committed with schema/seed. Multi-region Neon migration (EU/ME/US) + DB seed HELD at human-verify checkpoint (migration-history-drift fallback from P82-84 available).
- [Phase 85]: [85-02, 2026-06-16] treaty-rate.service mirrors reverse-charge (pure resolveTreatyDecision + DB applyTreaty); override needs a non-empty reason and flags auditRequired (router writes the audit in P03). applyTreaty resolves the auto-detected value from the table EVEN under an override so the audit captures what was overridden (diverges from reverse-charge which short-circuits with a constant). New PARALLEL service — never edits the SA-gated calculateWht; regression proves calculateWht('US')=null. determineFormType is pure: countryCode==='US'→W9; foreign COMPANY→W8BENE else W8BEN (routes the coarse Contractor.type, NOT the fine-grained US entity type). taxFormSubmissionSchema = Zod discriminatedUnion on formType; W9 carries EIN or SSN last-4 ONLY (no full-SSN field); W8BENE adds LOB line-14b. TaxFormType mirrored as a local literal union to keep determineFormType import-free/pure.
- [Phase 85]: [85-03, 2026-06-16] Portal-primary W-form self-cert on portalAppRouter — every read/write scoped to ctx.contractorId (IDOR), never client-supplied. ESIGN attestation ip/actorId/signedAt 100% server-derived (deriveClientIp(ctx.headers) / ctx.contractorId / new Date()) — client schema omits all three. buildFormSnapshot recursively strips full-SSN/TIN keys (ssn/ssnencrypted/fullssn/scalar-tin), keeps {ssnLast4,ein} — a 2nd PII guard behind the validators schema. supersedeAndInsert is append-only: flips prior ACTIVE→SUPERSEDED then inserts new ACTIVE inside one $transaction; saveTaxFormDraft only ever touches a DRAFT row (signed rows never mutated). Staff read/track on a DEDICATED taxFormRouter (mounted taxForm:) NOT tax.ts — only a separate namespace can be conditionally spread out of appRouter when module.us-expansion is OFF; tax.ts stays always-mounted. Defense-in-depth flag gate: isUsExpansionRegistered() spreads the staff router at boot (METHOD_NOT_FOUND when OFF) + assertUsExpansionEnabled per-request on BOTH surfaces (the flat portal merge cannot be conditionally spread). Form read/track reuses contractor:[read]; full-SSN reveal stays on contractor.revealSsn (contractorPii:[read]) — NO new Better Auth permission (Pitfall 2 avoided). Dead TAX_FORM_NOT_FOUND/NOT_DRAFT error exports removed (append-only makes the reject path unreachable). 25 scoped tests GREEN (immutability/supersede/PII non-leak/ESIGN/W8BENE LOB+article/IDOR/staff RBAC/flag gate).
- [Phase ?]: [85-04, 2026-06-16] Portal W-form wizard = page→container→hook→component; use-tax-form-wizard.ts the SOLE tRPC boundary. Attestation gate = real <input type=checkbox> perjury + typed legal-name match + signature affirmation. formType discriminant synced via useEffect for the discriminated-union resolver. Staff card reuses UspsAddressStatusPill VARIANT_MAP + SsnMaskedReveal verbatim (absent without contractorPii:read). i18n TaxFormWizard/TaxFormStaff en/de/pl/ar + en-US fallback. Phase 85 COMPLETE (US-FORM-01/02 + US-LOC-02/03).
- [Phase 86]: [86-01] @contractor-ops/iris package + SHA-256 XSD checksum guard established (mirrors einvoice validator-bundle); D-01 XSD-validate-in-CI seam + D-18 adviser-verify provenance in source.txt; reused fast-xml-parser ^5.7.3 + libxmljs2 ^0.37.0 verbatim (zero new external deps, T-86-01-SC accept); 9 Wave-0 RED scaffolds laid (terminal-RED). PAUSED at human-action checkpoint awaiting IRS IRIS XSD download (IRS-SOR login) before checksums pin.
- [Phase 86]: TIN-match seam: mock default + dark SSRF-safe e-Services client; mismatch advisory (flag + escalate + audit, never hard-block) — 86-02 migration unapplied + unit test injects only a client, so side-effect persistence is an injected port; the deterministic core ships and is fully tested with no live DB
- [Phase 86]: 86-05: 1099-NEC threshold read from the tax-year-keyed Tax1099Threshold table, never a constant ($600 TY2025 / $2,000 TY2026 OBBBA); box-1 aggregated by payment-date + FX-to-USD per recipient/payer-org
- [Phase 86]: 86-05: box-4 backup withholding + generateBatch persistence are injected ports (no Contractor flag column / 86-02 migration unapplied); CORRECTED = supersede in one tx; the 86-06 wiring caller supplies the real DB writers
- [Phase ?]: [90-01] Wave-0 RED scaffolds: 8 greenfield statutory validators (PESEL/Steuer-IdNr/NI/tax-code/Saudi-ID/Emirates-ID/GOSI/WPS) each pinned with canonical valid+invalid vectors before impl; Emirates-ID asserted as { formatValid, checksumValid } so the Luhn checksum stays advisory and never hard-rejects a format-valid ID; country-fields test locks the no-national-ID-key-in-JSON PII boundary.
- [Phase ?]: [90-01] P89-independent crypto scaffold (employee-pii-crypto) fails RED on the missing module now; the P89-gated cross-org-leak + registry scaffolds are describe.skip with a HOLD-until-P89 marker and import no P89 surface, so they register+skip cleanly and become the GREEN target when Phase 89 lands EmployeeProfile + employeeRouter + employeePii.
- [Phase 90]: 90-03: employee country-fields is a parallel employeeCountryFieldsSchemaMap (.strict() per-country), not a fork of the contractor map; no national-ID key (pesel/ssn/iqama/emiratesId) can enter the countryFields JSON
- [Phase 90]: 90-03: PESEL/Iqama/Emirates-ID encrypt under a dedicated EMPLOYEE_PII_ENCRYPTION_KEY (separate blast radius); US SSN keeps SSN_ENCRYPTION_KEY + ssn-crypto unchanged
- [Phase ?]: [89-01, 2026-06-22] Wave-0 baselines locked the contractor surface BEFORE any Worker model change: contractor.* route-shape snapshot (19 procedure names + input/output JSON-Schema shapes via appRouter._def.procedures + zod 4 z.toJSONSchema, no zod-to-json-schema dep — A1 confirmed) GREEN on the current router, and a contractor-parity baseline (list/getById/dashboard activeContractors raw count/search FTS raw site/buildContractorListWhere list-payment-run-export predicate + 2 facet raw sites/portal contractor read) GREEN on the pre-Worker schema — the provable regression net (D-03/D-07).
- [Phase ?]: [89-01, 2026-06-22] backfill-worker + worker-type RED scaffolds are terminal-RED via Cannot-find-module (import a not-yet-existing module), NOT assertion-logic; db tsconfig excludes src/**/__tests__/** so the RED imports do not brick typecheck. planWorkerBackfill idempotency (skip linked, re-run no-op, no source mutation — Plan 03) + withWorkerTypeDefault inject-default+explicit-where-wins across all 8 read ops on Worker only, non-Worker untouched (design A — Plan 02). No WORKER-* requirement marked complete (phase 89 = 1/6 plans; table/extension/backfill/router/RBAC/flag are later waves behind a [BLOCKING] human gate).

### Pending Todos

- Next: `/gsd:plan-phase 82` (v7.0 Foundation). Phase 82 + 83 + 89 + 98 are STANDARD (verified in-tree patterns); the research-gated phases above need `--research-phase`.
- Standing reminder: every v7.0 Unleash flag must register PENDING in `signoff-registry.ts` (FOUND7-02 / Phase 82); boot-gate enforces it.

### Blockers/Concerns

- **Tooling history (v6.0):** several v6.0 plan/execute runs hit a nested-agent `Task`-API limit + a missing `~/.claude/sdk/shared/model-catalog.json` (RESOLVED by 2026-05-31 — `gsd-sdk query` returns valid JSON). If a background `/gsd:plan-phase` run again cannot spawn `gsd-phase-researcher`/`gsd-planner`/`gsd-plan-checker`, run it from a **top-level** interactive session.
- **`.planning/phases` is a symlink** — stage planning commits via the real `milestones/vX.Y-phases/` path (git add/commit through the symlink fails "beyond a symbolic link").
- Phase 86-01 Task 3 (human-action): IRS IRIS XSD schema package (TY2025 v2.0) must be downloaded from the IRS Secure Object Repository (IRS-login-only) and placed under packages/iris/src/schema-bundle/, then pinned via 'pnpm --filter @contractor-ops/iris exec tsx scripts/verify-iris-schema-checksums.ts --write'. Generator/validator scaffolds stay RED until then.
- Plan 86-02 Task 3 [BLOCKING]: multi-region Prisma migration (EU/ME/US) for Form1099Nec/IrisSubmission/IrisAck/Tax1099Threshold/StateFilingConfig + db:generate + db:seed is held at a human gate (mutates live regional DBs). Resume 86-02 after the migration lands and is approved.

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
| Phase 83 P83-01 | 18m | 3 tasks | 6 files |
| Phase 83 P83-02 | 9m | 2 tasks | 10 files |
| Phase 83 P83-03 | 4m | 1 tasks | 4 files |
| Phase 83 P83-04 | 9m | 3 tasks | 7 files |
| Phase 84 P00 | 25min | 3 tasks | 6 files |
| Phase 84 P84-01 | 5min | 2 tasks | 7 files |
| Phase 84 P84-02 | 25min | 2 tasks | 14 files |
| Phase 84 P84-03 | 7m | 3 tasks | 8 files |
| Phase 84 P84-04 | 9min | 1 tasks | 5 files |
| Phase 84 P84-05 | 13min | 2 tasks | 2 files |
| Phase 84 P84-06 | 17min | 3 tasks | 11 files |
| Phase 85 P85-02 | ~11m | 3 tasks | 8 files |
| Phase 85 P85-03 | ~27m | 3 tasks | 11 files |
| Phase 85 P04 | ~26m | 3 tasks | 28 files |
| Phase 86 P01 | 5m | 2 tasks | 15 files |
| Phase 86 P86-03 | ~13min | 2 tasks | 11 files |
| Phase 86 P05 | ~10min | 2 tasks | 8 files |
| Phase 90 P90-01 | 14min | 2 tasks | 5 files |
| Phase 90 P03 | 4min | 2 tasks | 6 files |
| Phase 89 P01 | ~22min | 2 tasks | 5 files |

## Standing Project Constraints

- **Deployment status: LOCAL-ONLY.** Not deployed to production; no external users / regulated customers / live data.
- **Legal/regulatory verification is DEFERRED.** Features needing external sign-off (US tax-form copy, akta-osobowe/Personalakte retention, IR35/DRV wording, PDPL, etc.) ship working code annotated "Needs verification by jurisdiction-specific legal/tax adviser before production deploy" and recorded as post-merge items — must NOT hard-block build/CI/local-exec. No STATE.md blockers for missing legal sign-off unless a plan explicitly hard-stops.
- **Codebase standards override plan templates.** Prisma enum values `UPPER_SNAKE_CASE` (`db:audit-enum-casing`); no hardcoded user-facing strings (`useTranslations` + i18n parity en/de/pl/ar — and en-US for v7.0 US surfaces); run the relevant gates before marking a plan done (`lint:schema`, `lint:audit-log`, `lint:raw-sql`, `lint:logs`, `lint:silent-catch`, `i18n:parity`, `check:web-vite-*`). Fix only your own additions, not pre-existing unrelated offenders.

## Session Continuity

Last session: 2026-06-22T00:00:10.602Z
Stopped at: Completed 89-01-PLAN.md (Wave-0 contractor.* route-shape snapshot + contractor-parity baseline GREEN pre-Worker; backfill + withWorkerTypeDefault RED scaffolds)
Resume file: None
Next command: execute Phase 85 Plan 04 (web-vite portal wizard + staff status card + i18n)
