# Roadmap: Contractor Ops

## Milestones

- v1.0 MVP - Phases 1-11 (shipped 2026-03-23)
- v2.0 Platform Expansion - Phases 12-27 (shipped 2026-04-01)
- v3.0 Enterprise & Monetization - Phases 28-44 (shipped 2026-04-10)
- v4.0 International Foundation & Gulf Expansion - Phases 45-55 (shipped 2026-04-12)
- v5.0 UK & Germany Expansion - Phases 56-69 (shipped 2026-04-26)
- ✅ v6.0 Platform Maturity & Operational Hardening - Phases 70-81 (shipped 2026-06-07)
- 🚧 v7.0 GTM Expansion — US Cross-Border + Workforce Management + Integration Marketplace - Phases 82-101 (in progress, pre-prod gate; see `.planning/milestones/v7.0-BACKLOG.md`)

## Phases

<details>
<summary>v1.0 MVP (Phases 1-11) - SHIPPED 2026-03-23</summary>
See .planning/milestones/v1.0/ for details.
</details>

<details>
<summary>v2.0 Platform Expansion (Phases 12-27) - SHIPPED 2026-04-01</summary>
See .planning/milestones/v2.0/ for details.
</details>

<details>
<summary>v3.0 Enterprise & Monetization (Phases 28-44) - SHIPPED 2026-04-10</summary>
See .planning/milestones/v3.0/ for details.
</details>

<details>
<summary>v4.0 International Foundation & Gulf Expansion (Phases 45-55) - SHIPPED 2026-04-12</summary>
See .planning/milestones/v4.0/ for details.
</details>

<details>
<summary>✅ v5.0 UK & Germany Expansion (Phases 56-69) — SHIPPED 2026-04-26</summary>

- [x] Phase 56: Country Foundations & German i18n (8/8 plans) — completed 2026-04-12
- [x] Phase 57: Government API Clients (4/4 plans) — completed by Phase 66 on 2026-04-26
- [x] Phase 58: Classification Engine & Rule Sets (5/5 plans) — completed 2026-04-13
- [x] Phase 59: Classification Documents & Chain Tracking (4/4 plans) — completed 2026-04-13
- [x] Phase 60: Classification Polish (4/4 plans) — completed 2026-04-14
- [x] Phase 61: XRechnung E-Invoicing (8/8 plans) — completed 2026-04-14
- [x] Phase 62: ZUGFeRD E-Invoicing (7/7 plans) — completed 2026-04-16
- [x] Phase 63: UK Payments & Financial Features (7/7 plans) — completed 2026-04-26
- [x] Phase 64: Legal Compliance Hardening (9/9 plans) — completed 2026-04-25
- [x] Phase 65: Phase 63 Critical Bug Fixes (2/2 plans, gap-closure) — completed 2026-04-26
- [x] Phase 66: Phase 57 Completion & Verification (4/4 plans, gap-closure) — completed 2026-04-26
- [x] Phase 67: Phase 56 & 58 Verification (2/2 plans, gap-closure) — completed 2026-04-26
- [x] Phase 68: Skonto BG-20 XRechnung Emission Fix (5/5 plans, gap-closure — closes audit I-1) — completed 2026-04-26
- [x] Phase 69: DE Message-Key Parity Fix (1/1 plan, gap-closure — closes FOUND-03) — completed 2026-04-26

Full details: `.planning/milestones/v5.0-ROADMAP.md`
Audit: `.planning/milestones/v5.0-MILESTONE-AUDIT.md`
Requirements archive: `.planning/milestones/v5.0-REQUIREMENTS.md`
Phase artifacts: `.planning/milestones/v5.0-phases/`

</details>

<details>
<summary>✅ v6.0 Platform Maturity & Operational Hardening (Phases 70-81) — SHIPPED 2026-06-07</summary>

**Goal:** Make the platform production-grade across all supported markets (PL, UK, DE, UAE, SA) by closing four operational gaps deferred across v1.0–v5.0: per-jurisdiction compliance-document expiry blocking payment (F1), IdP deprovisioning across 5 providers (F2), Gulf operational polish (F3 — UAE free-zone + Saudization), and offboarding hardening (F4 — KT templates, IP-assignment verification, contract-clause health check, credential-rotation tracking).

**Shipped:** 12 phases · 90 plans · 392 tasks. Requirements 53/54 satisfied (OFFB-06 deferred). Integration 7/7, E2E flows 5/5.

- [x] Phase 70: v6.0 Foundation — Cross-Cutting CI Guards & Observability Baseline (10/10) — 2026-04-27
- [x] Phase 71: F1 Compliance — Policy Package + Schema + Classification Reconcile (7/7) — 2026-04-27
- [x] Phase 72: F1 Compliance — Reminder Cascade + Payment Block (8/8) — 2026-05-31
- [x] Phase 73: F1 Compliance — Admin Dashboard + Portal Self-Service + i18n (8/8) — 2026-05-31
- [x] Phase 74: F4 Offboarding — Workflow Foundation + KT Templates + Override Permission (8/8) — 2026-04-27
- [x] Phase 75: F4 Offboarding — Contract Health Check + IP Verification + Credential Vault (8/8) — 2026-05-31 *(PARTIAL: OFFB-06 e-sign signing + webhook atomic flow deferred)*
- [x] Phase 76: F2 IdP — Capability Mixin + Saga Schema + Cooldown Gate + GWS Scope Migration (10/10) — 2026-05-31
- [x] Phase 77: F2 IdP — GWS + Slack Adapters (the wedge) (5/5) — 2026-05-31
- [x] Phase 78: F2 IdP — Entra ID + Okta + GitHub Adapters (the differentiator) (7/7) — 2026-05-31
- [x] Phase 79: F3 Gulf — UAE Free-Zone Tracking + Saudization Dashboard + Arabic + RTL (8/8) — 2026-06-03
- [x] Phase 80: v6.0 Verification + Hardening + Manual UAT (5/5) — 2026-06-05
- [x] Phase 81: v6.0 Integration Closure — IdP deprovisioning UI trigger + multi-provider run steps + compliance payment-block recovery (6/6) — 2026-06-06 *(closes INT-01 + INT-02)*

Full details: `.planning/milestones/v6.0-ROADMAP.md`
Audit: `.planning/milestones/v6.0-MILESTONE-AUDIT.md` (gaps_found = verification/UAT process debt only)
Requirements archive: `.planning/milestones/v6.0-REQUIREMENTS.md`
Phase artifacts: `.planning/milestones/v6.0-phases/`
Known gaps / deferred at close: see STATE.md `## Deferred Items` (3 unverified phases 70/71/75; 28 open human-UAT scenarios; OFFB-06; multi-region apply; per-phase code-review debt).

</details>

### 🚧 v7.0 GTM Expansion (Phases 82-101) — IN PROGRESS

**Milestone Goal:** Ship the net-new product surface required for credible production GA — US cross-border billing/compliance (Theme A), workforce/employee management (Theme B), and an open integration platform (Theme C) — atop the shipped v1–v6 contractor-ops core. 107 requirements across 20 phases.

**Theme parallelism (locked 2026-05-31):** After the shared Foundation (Phase 82), Themes A / B / C run **concurrently** (concurrency capped by solo-dev-with-AI throughput, not by the dependency graph). The only hard serialization points are `WORKER-01` (Phase 89 — no Theme B work starts before it) and `INTEG-API-01` (Phase 98 — Theme C foundation). Reuse posture is mandatory: extend existing factories/frameworks (payment-export, integration adapters, OutboxEvent outbox, public-api Hono host, v5 classification, v2 portal) — do NOT rebuild. See `.planning/milestones/v7.0-BACKLOG.md` + `.planning/research/SUMMARY.md` + `.planning/research/ARCHITECTURE.md`.

- [x] **Phase 82: v7.0 Foundation — Add-On Billing + Flag Registry + US Region Enablement** - `requireAddOn` middleware, all v7.0 flags PENDING with boot-gate, `us-east-1` 4-place region enablement; starts IRIS TCC ~45-day enrollment clock (completed 2026-06-07)
- [x] **Phase 83: Theme A — US Region Infrastructure** - `us-east-1` per-org DB routing + US R2 tax-archive bucket + IRS 4yr/7yr retention; precedes any US-data creation (completed 2026-06-07)
- [ ] **Phase 84: Theme A — US Contractor Profile Fields + en-US Locale** - EIN/SSN/USPS-address validators, US profile component, `en-US` full key parity
- [ ] **Phase 85: Theme A — W-Form Intake + Tax-Treaty Engine** - W-9 + W-8BEN/E wizards, US tax-treaty rate table, W-8BEN treaty-article auto-populate
- [ ] **Phase 86: Theme A — TIN-Match → 1099-NEC → IRIS E-File → State Filing** - IRS TIN-matching, tax-year-keyed 1099-NEC ($2,000 TY2026), IRIS XML A2A transmit + ack, per-state CFSF
- [ ] **Phase 87: Theme A — 1042-S + US Classification + Determination Letter** - treaty-rate 1042-S, US rule set (federal/AB5/§530), 1099-K tracker ($20k+200), Determination Letter PDF
- [ ] **Phase 88: Theme A — US Payment Rail** - ACH NACHA in payment-export factory, USD first-class, Modern Treasury programmatic ACH, Fedwire, Plaid identity
- [ ] **Phase 89: Theme B — Worker Model Abstraction (serial gate)** - additive `workerType` discriminator, router split, RBAC roles, flag gate; the only Theme B serialization point
- [ ] **Phase 90: Theme B — Employee Registry per Market (×6)** - PL/DE/UK/US/AE/SA statutory-identifier validators on the EmployeeProfile
- [ ] **Phase 91: Theme B — Akta Osobowe / Personnel File** - 4-section file + per-jurisdiction retention engine + RODO erasure with statutory holds + upload classification
- [ ] **Phase 92: Theme B — Leave Management + KP-Grade Time Tracking** - per-market leave-balance engine, request workflow, team calendar, employee time + working-time alerts + ewidencja report
- [ ] **Phase 93: Theme B — Employee On/Offboarding** - per-market on/offboarding workflow templates; offboarding extends (not duplicates) v6.0 F4
- [ ] **Phase 94: Theme B — Payroll Integration Adapters** - PL (Symfonia/Comarch/Enova), DE (DATEV/Sage), UK (Sage/BrightPay/Moneysoft), US (Gusto/QuickBooks/ADP) export adapters
- [ ] **Phase 95: Theme B — HRIS Two-Way Sync (Personio + BambooHR)** - both adapters, source-of-truth field partition, one-HRIS-per-org constraint, pull/push handlers
- [ ] **Phase 96: Theme B — Employee Self-Service Portal** - `/employee/*` routes on v2 portal, employee + manager dashboards, en/pl/de/ar/en-US parity
- [ ] **Phase 97: Theme B — HR Dashboard** - headcount / vacation-utilization / document-expiry / probation-watchlist / Gulf-rollup widgets
- [ ] **Phase 98: Theme C — Public REST API Surface (foundation gate)** - read+write endpoints with `.strict()` DTOs, OpenAPI 3.1, versioning, cursor pagination, TS/Python SDKs
- [ ] **Phase 99: Theme C — API Keys + Scopes + Rate Limiting** - HMAC-SHA256 keys, per-endpoint scope enforcement (BFLA fix), Developer page, per-tier rate limits, mutation audit
- [ ] **Phase 100: Theme C — Outbound Webhooks + Integration Security** - WebhookSubscription on the outbox dispatcher, HMAC + DLQ + PII redaction, SSRF guard with DNS-rebind, OWASP review gate
- [ ] **Phase 101: Theme C — Marketplace Listings + Dev Experience** - Zapier / n8n / Make listings + status dashboard, dev portal, Postman/Insomnia, public status page, sandbox tier

## Phase Details

### Phase 82: v7.0 Foundation — Add-On Billing + Flag Registry + US Region Enablement
**Goal**: The shared billing, feature-flag, and region primitives that gate every revenue-bearing and US-data surface exist before any theme work begins.
**Depends on**: Nothing (first v7.0 phase; builds on shipped v6.0 platform)
**Requirements**: FOUND7-01, FOUND7-02, FOUND7-03
**Success Criteria** (what must be TRUE):
  1. A revenue-gated procedure decorated with `requireAddOn('workforce')` (or `'us-cross-border'`) returns a structured `ADD_ON_REQUIRED` error for an org lacking the add-on, and proceeds for one that holds it (composes after `requireTier`).
  2. The app boots with all v7.0 Unleash flags registered PENDING in the signoff registry; the boot-time gate exits if any listed flag is missing from the registry.
  3. A request carrying `region=US` resolves through `SUPPORTED_REGIONS`, the `DataRegion` enum, `DATABASE_URL_US`, and `buildLazyBag` flag coercion without a runtime throw or silent EU-coercion (lockstep test asserts all four stay in sync).
  4. The IRIS TCC enrollment workflow document exists and records the ~45-day lead-time as a started calendar dependency.
**Plans**: 4 plans (3 waves)
- [x] 82-01-PLAN.md — Wave 0 test scaffolding (all VALIDATION.md test files) + IRIS TCC enrollment ops doc (SC#4) [wave 1]
- [x] 82-02-PLAN.md — FOUND7-03 US region 5-place lockstep + D-07 adjacents + 'payroll' flag category [wave 2]
- [x] 82-03-PLAN.md — FOUND7-02 19 v7.0 flags PENDING + V7_FLAG_KEYS cohort + gated prefixes + boot-gate wiring (apps/api, public-api, cron-worker) [wave 3]
- [x] 82-04-PLAN.md — FOUND7-01 Subscription.addOns + [BLOCKING] migration + requireAddOn + ADD_ON_REQUIRED REST branch + owner-gated grant + seed [wave 2]
**Research flag**: Standard — `requireAddOn` mirrors `requireTier`; flag registry + boot-gate are documented patterns. Decided: `Subscription.addOns String[]` (additive array) over normalized `OrgAddOn` table (D-01).

### Phase 83: Theme A — US Region Infrastructure
**Goal**: A new org with US billing is durably routed to `us-east-1` data + storage with IRS retention enforced, so US tax data can be created safely.
**Depends on**: Phase 82
**Requirements**: US-INFRA-01, US-INFRA-02, US-INFRA-03
**Success Criteria** (what must be TRUE):
  1. A US-billing org's requests resolve a `us-east-1` Prisma client; cross-region read replicas remain off by default.
  2. Tax-form archives for US orgs are stored in a US-specific R2 bucket (data residency for US tax records).
  3. IRS-mandated retention is enforced (4-year 1099-NEC, 7-year backup-withholding) via soft-delete + scheduled archive, with no early hard-delete of a retained record.
**Plans**: 4 plans
- [x] 83-01-PLAN.md — [BLOCKING] Add US to the DataRegion Postgres enum + Wave 0 RED test scaffolds (region-lockstep Prisma-enum assertion, retention resolver, org-creation hook)
- [x] 83-02-PLAN.md — US DB routing: organizationCreation.beforeCreate US assignment (D-01) + widen dataRegion cast sites to DataRegion + US tenant routing
- [x] 83-03-PLAN.md — US R2 tax-archive bucket: REGION_BUCKET_MAP Record<DataRegion> + optional R2_BUCKET_NAME_US (lazy-throw)
- [x] 83-04-PLAN.md — IRS retention: retention-policy resolver (4yr/7yr) wired into all 3 deletion chokepoints (soft-delete, data-purge cron, gdpr erasure)
**Research flag**: Standard — the 4-place change is fully identified in-tree; the lockstep test landed in Phase 82 protects it.

### Phase 84: Theme A — US Contractor Profile Fields + en-US Locale
**Goal**: A US contractor's identity fields validate to IRS/USPS standards and the product renders in correct American English before any form intake.
**Depends on**: Phase 83
**Requirements**: US-FIELD-01, US-FIELD-02, US-FIELD-03, US-FIELD-04, US-LOC-01
**Success Criteria** (what must be TRUE):
  1. An EIN is accepted only in `XX-XXXXXXX` format with a valid IRS prefix; an SSN displays last-4 by default and full only behind `CONTRACTOR_PII:READ`.
  2. A US address is validated/normalized via the USPS Addresses API (CASS format) within the documented throttle/cache budget.
  3. The US contractor profile section dispatches from the existing `CountryComplianceSection` pattern with US fields.
  4. The app renders `en-US` at full key parity vs `en`, with American-English copy and US date/currency/measure formatting.
**Plans**: 7 plans (4 waves)
- [x] 84-00-PLAN.md — Wave 0 RED test scaffolds (us-validators, ssn-crypto, contractor-reveal-ssn, usps-client, the two web-vite component tests) [wave 1]
- [x] 84-01-PLAN.md — US-FIELD-01/02 validators: isValidEin (IRS prefix) + isValidSsn (range) + usCountryFieldsSchema (US, SSN excluded) + SSN_ENCRYPTION_KEY/USPS env (D-05) [wave 1]
- [ ] 84-02-PLAN.md — US-LOC-01 en-US: register locale + fallbackLng en-US→en→pl + fallback-aware i18n:parity (NOT a strict peer) + thin en-US.json (D-04) [wave 1]
- [ ] 84-03-PLAN.md — US-FIELD-02 security core: [BLOCKING] ssnEncrypted/ssnLast4/usps* columns (db push) + ssn-crypto (dedicated key) + contractorPii:read (owner/admin/finance_admin, owner-dup) + ssn/ein pii-mask (D-01/D-02/D-08/D-09) [wave 2]
- [ ] 84-04-PLAN.md — US-FIELD-03 USPS adapter: UspsAddressClient (mirror HMRC) + GLOBAL 60/hr limiter + fail-open advisory + safeParse (D-03) [wave 2]
- [ ] 84-05-PLAN.md — US-FIELD-01/02/03/04 server: getCountryFieldsConfig US + updateUsProfile (SSN→encrypted columns, USPS advisory) + revealSsn (staff-only, RBAC, audit) (D-01/D-02/D-03/D-06/D-09) [wave 3]
- [ ] 84-06-PLAN.md — US-FIELD-04 + US-LOC-01 UI: UsComplianceFields + SsnMaskedReveal (gated, absent-without-perm) + UspsAddressStatusPill (advisory) + case 'US' dispatch + en/en-US copy (D-04/D-06, 84-UI-SPEC) [wave 4]
**Research flag**: Standard — consistency phase; every hard part has an in-tree mirror (bank-account-crypto, hmrc-vat-client, uk-validators, uk-compliance-fields, Better Auth roles). USPS throttle/cache designed (GLOBAL 60/hr, fail-open). No new deps.
**UI hint**: yes

### Phase 85: Theme A — W-Form Intake + Tax-Treaty Engine
**Goal**: US-resident and foreign contractors complete the correct tax-status wizard, with treaty rates and articles auto-applied from a single treaty table.
**Depends on**: Phase 84
**Requirements**: US-FORM-01, US-FORM-02, US-LOC-02, US-LOC-03
**Success Criteria** (what must be TRUE):
  1. A US-resident contractor completes a W-9 wizard (TIN + entity type + backup-withholding flag), stored against the worker with an audit trail.
  2. A foreign contractor completes a W-8BEN / W-8BEN-E wizard (treaty country + article picker, FTIN, certifications).
  3. When contractor and payer jurisdictions trigger a treaty (PL/DE/UK/UAE/KSA/IE/NL), the US treaty-rate table is applied automatically.
  4. The W-8BEN treaty article auto-populates from the contractor's home jurisdiction + treaty table.
**Plans**: TBD
**Research flag**: Standard — treaty table extends the v5.0 reverse-charge engine pattern. Treaty table must precede 1042-S (Phase 87).
**UI hint**: yes

### Phase 86: Theme A — TIN-Match → 1099-NEC → IRIS E-File → State Filing
**Goal**: The year-end US information-return loop runs end-to-end: validate TINs, generate 1099-NEC at the correct threshold, e-file via IRIS, and handle separate-state filing.
**Depends on**: Phase 85
**Requirements**: US-FORM-03, US-FORM-04, US-FORM-05, US-FORM-07
**Success Criteria** (what must be TRUE):
  1. A TIN is checked against IRS TIN-Matching (24h cache + retry); a mismatch raises admin escalation rather than a hard block.
  2. A 1099-NEC is generated per recipient using a tax-year-keyed threshold config table ($2,000 for TY2026), with CORRECTED-form support, recipient PDF, and an audit-immutable archive.
  3. A year-end return is built and transmitted via IRS IRIS (XML A2A primary path) and its acknowledgement is parsed; FIRE is documented as a legacy fallback only.
  4. Per-state 1099 filing is produced for states requiring separate filing (CFSF participation where eligible).
**Plans**: TBD
**Research flag**: IRIS A2A has no Node lib — hand-build XML against IRS XSDs, XSD-validate in CI, keep a transmitter-adapter seam (Sovos/1099Pro fallback if TCC not approved by plan-phase). IRS TIN-Matching PAF enrollment is a per-org operational prerequisite — flag as a plan-phase checklist item.

### Phase 87: Theme A — 1042-S + US Classification + Determination Letter
**Goal**: US-source payments to foreign contractors are reported with treaty-correct withholding, and US worker classification (federal/AB5/§530) produces a defensible determination.
**Depends on**: Phase 85 (treaty table); composes with v5.0 classification engine
**Requirements**: US-FORM-06, US-CLASS-01, US-CLASS-02, US-CLASS-03, US-CLASS-04
**Success Criteria** (what must be TRUE):
  1. A 1042-S is generated for US-source payments to foreign contractors with the withholding rate sourced from the treaty table, plus recipient PDF + IRS file.
  2. The classification engine evaluates the US rule set (federal common-law / economic-realities, CA ABC/AB5, §530 safe-harbor flagger).
  3. A CA-worker engagement is flagged on the AB5 watchlist and gets the stricter ABC test by default, with an audit-logged admin override.
  4. A "Classification Determination Letter" PDF generates (mirroring the v5.0 UK SDS), and the 1099-K tracker surfaces cumulative payouts approaching $20,000 + 200 transactions.
**Plans**: TBD
**Research flag**: US-CLASS-04 Determination-Letter AI generation likely needs `/gsd:ai-integration-phase`.
**UI hint**: yes

### Phase 88: Theme A — US Payment Rail
**Goal**: US and cross-border payouts settle through ACH/wire rails with USD as a first-class currency and optional programmatic initiation.
**Depends on**: Phase 83 (USD/region); independent of forms
**Requirements**: US-PAY-01, US-PAY-02, US-PAY-03, US-PAY-04, US-PAY-05
**Success Criteria** (what must be TRUE):
  1. A payment run can export a balanced ACH NACHA file (PPD/CCD/CTX) as a new format in the existing payment-export factory, with valid effective-entry-date and return-code handling.
  2. USD is selectable as a first-class currency with per-org default, exchange-rate sourcing, and settlement-currency choice on cross-border payouts.
  3. An opt-in org can initiate programmatic ACH payouts via a Modern Treasury / Stripe Treasury adapter on the integration framework.
  4. A Fedwire wire-transfer file exports for high-value payouts above the Same-Day ACH ceiling, and a US contractor bank account is verifiable via Plaid Identity at onboarding.
**Plans**: TBD
**Research flag**: Standard — NACHA is a payment-export factory extension; `@midlandsbank/node-nacha` is a formatter helper (hand-roll ODFI-specific fields). The W-9 backup-withholding flag must actually reduce payout by 24%, not just be stored.

### Phase 89: Theme B — Worker Model Abstraction (serial gate)
**Goal**: The platform models employees as a discriminated `Worker` type with zero data migration for existing orgs and no regression to contractor read paths — the gate every other Theme B phase waits on.
**Depends on**: Phase 82 (add-on + flag); the ONLY Theme B serialization point
**Requirements**: WORKER-01, WORKER-02, WORKER-03, WORKER-04, WORKER-05
**Success Criteria** (what must be TRUE):
  1. An additive `workerType` discriminator (default `CONTRACTOR`) + `@@index([organizationId, workerType])` ships with zero data migration for v1–v6 orgs (verified on a staging snapshot of the largest org).
  2. Existing `contractor.*` tRPC route shapes are preserved (snapshot-locked); a shared `workerRouter` + new `employeeRouter` expose cross-type and employment ops; all contractor `findMany`/`findFirst` call sites are filtered to `workerType:'CONTRACTOR'`.
  3. The `organizationId` tenant invariant holds on `Worker`/employee rows, with HR-only fields gated by per-type RBAC and four new roles (`HR_ADMIN`, `HR_MANAGER`, `PAYROLL_OFFICER`, `LEAVE_APPROVER`); existing 8 roles unchanged.
  4. With `workforce-employees` flag off, employee routes are removed from the render tree and return tRPC FORBIDDEN/NOT_FOUND.
**Plans**: TBD
**Research flag**: Standard — locked, verified additive pattern. Pitfall: contractor list/dashboard/payment-run/classification-scan corruption if call sites aren't pre-filtered.

### Phase 90: Theme B — Employee Registry per Market (×6)
**Goal**: HR can register an employee in any of the six supported markets with all statutory identifiers validated.
**Depends on**: Phase 89
**Requirements**: EMP-REG-PL-01, EMP-REG-DE-01, EMP-REG-UK-01, EMP-REG-US-01, EMP-REG-AE-01, EMP-REG-SA-01
**Success Criteria** (what must be TRUE):
  1. A PL employee record validates PESEL (mod-11 + dob), urząd skarbowy / ZUS oddział, etat (0.10–1.00), stawka brutto, ZUS title code, NFZ oddział.
  2. DE and UK employee records validate Steuer-IdNr / SV-Nummer / Krankenkasse / Lohnsteuerklasse and NI number / PAYE / tax code / student-loan / pension-auto-enrol respectively.
  3. A US employee record carries PII-masked SSN, W-4 step-1c filing status, and state withholding for the 10 supported states + free-text fallback.
  4. UAE (Emirates ID + visa + WPS Establishment ID) and KSA (Iqama/National ID + GOSI + Saudization flag) employee records validate.
**Plans**: TBD
**Research flag**: Standard — reuses v5.0 validators (SV-Nummer) and v4.0 Gulf field patterns. New Prisma models — never add to `globalModels`; cross-org leak test per new tenant-owning model.
**UI hint**: yes

### Phase 91: Theme B — Akta Osobowe / Personnel File
**Goal**: Each employee has a jurisdiction-correct personnel file with section-level access control, statutory retention, and RODO-defensible erasure.
**Depends on**: Phase 90
**Requirements**: AKTA-01, AKTA-02, AKTA-03, AKTA-04
**Success Criteria** (what must be TRUE):
  1. An employee file presents a 4-section structure (PL cz. A/B/C/D per KP §94; DE Personalakte / UK personnel file / US I-9+file equivalents) with per-section RBAC.
  2. Retention is enforced per jurisdiction (PL 10yr post-2019 / 50yr legacy, DE 10yr tax / 30yr accident, UK 6yr / 7yr financial, US I-9 3yr-post-hire-or-1yr-post-termination).
  3. A RODO/GDPR erasure request honors erasure only past the retention window and flags blocked sections with a statutory citation (never claims full erasure during a hold).
  4. A document uploaded to the file is auto-classified to section A/B/C/D; an ambiguous document triggers an admin classify step.
**Plans**: TBD
**Research flag**: Standard — composes with v6.0 F1 compliance-document engine + document infra. Legal annotation required on retention-rule copy (Standing Constraint).
**UI hint**: yes

### Phase 92: Theme B — Leave Management + KP-Grade Time Tracking
**Goal**: Employees request and managers approve leave against market-correct balances, and statutory employee working time is tracked and limit-checked.
**Depends on**: Phase 90
**Requirements**: LEAVE-01, LEAVE-02, LEAVE-03, TIME-EMP-01, TIME-EMP-02, TIME-EMP-03
**Success Criteria** (what must be TRUE):
  1. A leave balance computes per market (PL 20/26-day, DE BUrlG + overrides, UK 5.6-week, US per-state, UAE/SA per-MOL/MHRSD); a leave request routes through the v1.0 approval-chain with per-org leave types, blackout periods, and manual sick-leave entry.
  2. A team calendar shows month/quarter capacity with conflict warnings on overlapping same-team requests.
  3. Employee time tracking (distinct from v2.0 B2B time) captures overtime, night-shift, and weekend/holiday work, and raises per-jurisdiction working-time-limit alerts (PL 8h/48h, DE ArbZG, UK 48h WTR opt-out, US FLSA >40h non-exempt).
  4. A PL "ewidencja czasu pracy" report generates per KP §149 with a 3-year audit-immutable archive.
**Plans**: TBD
**Research flag**: Standard — e-ZLA/eAU auto-pull explicitly deferred to v7.5; v7.0 ships manual sick-leave entry only.
**UI hint**: yes

### Phase 93: Theme B — Employee On/Offboarding
**Goal**: A new or departing employee runs the correct per-market statutory workflow, reusing v6.0 offboarding hardening rather than duplicating it.
**Depends on**: Phase 90 (registry context); composes with v6.0 F4
**Requirements**: EMP-ON-01, EMP-OFF-01, EMP-OFF-02
**Success Criteria** (what must be TRUE):
  1. A per-market onboarding workflow template runs for PL / DE / UK / US (badania wstępne/PIT-2/PPK; Personalfragebogen/Steuer-ID/SV-Ausweis; P45/P46/RTI/pension; W-4/I-9+E-Verify/state-W-4/direct-deposit).
  2. A per-market offboarding workflow runs for PL / DE / UK / US (świadectwo pracy/ekwiwalent/ZUS ZWUA/PIT-11; Arbeitszeugnis/Abmeldung SV/Lohnsteuerbescheinigung; P45/final RTI/pension/P11D; final paycheck/COBRA/W-2/401k).
  3. Employee offboarding composes with v6.0 F4 (IP verification, KT templates, IdP deprovisioning) by extending the existing run rather than duplicating it.
**Plans**: TBD
**Research flag**: Standard — extends v6.0 F4 offboarding saga. Legal annotation required on statutory-paperwork copy (Standing Constraint).
**UI hint**: yes

### Phase 94: Theme B — Payroll Integration Adapters
**Goal**: HR exports employee payroll data to the incumbent payroll system in each market — adapters only, never an own payroll engine.
**Depends on**: Phase 90 (registry fields) and Phase 93 (on/offboarding context)
**Requirements**: PAYROLL-PL-01, PAYROLL-PL-02, PAYROLL-PL-03, PAYROLL-DE-01, PAYROLL-DE-02, PAYROLL-UK-01, PAYROLL-US-01
**Success Criteria** (what must be TRUE):
  1. PL payroll exports to Symfonia Kadry i Płace (CSV+XML), Comarch ERP XL/Optima, and Enova365.
  2. DE payroll exports to DATEV Lohn und Gehalt (ASCII import + DATEVconnect REST where subscribed) and Sage HR/Personalwirtschaft.
  3. UK payroll exports RTI-compatible FPS/EPS XML to Sage / BrightPay / Moneysoft.
  4. US payroll exports to exactly Gusto + QuickBooks Payroll + ADP (CSV mappings + native API where available).
**Plans**: TBD
**Research flag**: Each adapter is a new `PayrollExportProfile` in the existing factory (standard for PL/DE/UK). ADP requires Marketplace partner approval + mTLS — external lead-time; treat ADP as potentially v7.1, with QuickBooks + Gusto as the v7.0 US floor.

### Phase 95: Theme B — HRIS Two-Way Sync (Personio + BambooHR)
**Goal**: An org syncs people data two-way with one HRIS, with registry fields owned by the HRIS and financial/compliance fields locked against overwrite.
**Depends on**: Phase 90 (registry fields)
**Requirements**: HRIS-SYNC-01, HRIS-SYNC-02, HRIS-SYNC-03, HRIS-SYNC-04, HRIS-SYNC-05, HRIS-SYNC-06
**Success Criteria** (what must be TRUE):
  1. A Personio adapter on the v2.0 integration framework pulls people/contracts/departments/custom-attributes on hourly cron + on-demand, and pushes invoice-paid/payment-status/classification-outcome on event.
  2. A BambooHR adapter (OAuth 2.0, REST) provides the same sync surface as Personio.
  3. On conflict, registry fields update from the HRIS while financial/compliance fields are physically un-writable by the pull mapper (source-of-truth split enforced, not advisory).
  4. An org can connect Personio OR BambooHR but not both, enforced by a DB unique constraint.
**Plans**: TBD
**Research flag**: HRIS-SYNC-04 BambooHR custom-attribute contract is unverified — gate with `/gsd:plan-phase --research-phase`. HRIS-SYNC-01/02 Personio endpoint-level rate limits are MEDIUM-confidence community data — verify against contract before plan-phase. Conflict-resolution may warrant `/gsd:ai-integration-phase`.

### Phase 96: Theme B — Employee Self-Service Portal
**Goal**: Employees and their managers self-serve through the existing portal shell, fully localized across all five locales.
**Depends on**: Phases 90–95 (data surfaces to display); extends v2.0 portal
**Requirements**: EMP-PORTAL-01, EMP-PORTAL-02, EMP-PORTAL-03, EMP-PORTAL-04
**Success Criteria** (what must be TRUE):
  1. The employee portal extends the v2.0 contractor portal (same magic-link auth + subdomain) with new `/employee/*` routes.
  2. An employee sees pay stubs (where payroll-integrated), leave balance, time-off request, document upload, and a personal akta view.
  3. A manager sees direct reports' leave requests, time entries to approve, and document-expiry flags.
  4. The portal renders at i18n parity across en / pl / de / ar (RTL) / en-US.
**Plans**: TBD
**Research flag**: Standard — extends v2.0 portal magic-link + subdomain shell under the existing auth model.
**UI hint**: yes

### Phase 97: Theme B — HR Dashboard
**Goal**: HR sees workforce health at a glance across headcount, leave, document expiry, probation, and Gulf nationalization.
**Depends on**: Phases 90–93 (employee + leave + document data)
**Requirements**: HR-DASH-01, HR-DASH-02, HR-DASH-03, HR-DASH-04, HR-DASH-05
**Success Criteria** (what must be TRUE):
  1. A headcount widget breaks down total / by department / jurisdiction / employment-type / contract-end date.
  2. A vacation-utilization widget shows days taken vs entitled per worker and flags under-utilization (>10 unused days approaching year-end).
  3. A document-expiry widget (visa/work-permit/contract-renewal/medical/training) composes with the v6.0 F1 compliance-document engine, and a probation-end watchlist surfaces workers within 14/7/0 days.
  4. A Saudization / Emiratisation rollup composes with v6.0 F3 Gulf operational polish.
**Plans**: TBD
**Research flag**: Standard — composes with v6.0 F1 (HR-DASH-03) and F3 (HR-DASH-05).
**UI hint**: yes

### Phase 98: Theme C — Public REST API Surface (foundation gate)
**Goal**: External consumers can read and write core domain entities over a versioned, documented public REST API with generated SDKs — the gate every other Theme C phase waits on.
**Depends on**: Phase 82 (flags); the ONLY Theme C serialization point
**Requirements**: INTEG-API-01, INTEG-API-02, INTEG-API-03, INTEG-API-04, INTEG-API-05
**Success Criteria** (what must be TRUE):
  1. `apps/public-api` (Hono) exposes read+write endpoints for contractors / invoices / payments / payment_runs / workflows / workflow_tasks / classifications / compliance_documents / audit_log, each with Zod input validation, tenant-scoped via API key, and `.strict()` DTOs that reject mass-assignment of `organizationId` / `workerType` / money fields.
  2. An OpenAPI 3.1 spec auto-generates from Zod (`@hono/zod-openapi`) and publishes to a Scalar developer portal.
  3. All list endpoints use cursor-based pagination + standardized `?filter[field]=` / `?sort=`; the base path is `/v1/*` with `Sunset` headers per RFC 8594.
  4. Auto-generated TypeScript + Python SDKs publish to npm + PyPI (`@contractor-ops/sdk` / `contractor-ops-sdk`).
**Plans**: TBD
**Research flag**: Standard — Hono host, `OrganizationApiKey.scopes`, per-tier rate-limiter already exist. SDK gen via Speakeasy from the 3.1 spec (standalone binary, no day-zero npm dep). Write endpoints must not ship before Phase 99 scope enforcement lands.

### Phase 99: Theme C — API Keys + Scopes + Rate Limiting
**Goal**: API access is least-privilege: keys are hashed, every write endpoint enforces a scope, and per-tier rate limits cap usage — closing the current BFLA gap.
**Depends on**: Phase 98
**Requirements**: INTEG-AUTH-01, INTEG-AUTH-02, INTEG-AUTH-03, INTEG-AUTH-04, INTEG-AUTH-05
**Success Criteria** (what must be TRUE):
  1. An org creates/rotates/revokes named `co_live_*` API keys stored HMAC-SHA256-hashed, with each lifecycle event audited.
  2. Each endpoint enforces its required per-key scope (`contractors:read|write`, `invoices:read|write`, `payments:read|write`, `webhooks:manage`, `classifications:read`, `compliance:read`, `audit:read`); a `read` key cannot call a `write` endpoint; least-privilege default.
  3. A Settings → Developer page provides key CRUD, last-used-at, source-IP log, scope visualization, and a rotation flow with grace period.
  4. Per-tier rate limits apply (Starter 1k/mo + 1 webhook sub, Pro 10k + 5, Enterprise unlimited), and every external mutation is audit-logged with `apiKeyId` + `sourceIp` + `userAgent`.
**Plans**: TBD
**Research flag**: Standard — `OrganizationApiKey.scopes` + `permissionToScopes` already bridge to RBAC; extend the scope map for `payments`/`workflows`/`webhooks:manage`. Per-tier rate-limit buckets extend the existing Redis rate-limiter.
**UI hint**: yes

### Phase 100: Theme C — Outbound Webhooks + Integration Security
**Goal**: The platform reliably dispatches signed, PII-safe outbound events to subscriber URLs, with SSRF defense and an OWASP review gate before any dispatch ships.
**Depends on**: Phase 99 (scopes); INTEG-SEC-01 must land before INTEG-WEBHOOK dispatch
**Requirements**: INTEG-WEBHOOK-01, INTEG-WEBHOOK-02, INTEG-WEBHOOK-03, INTEG-WEBHOOK-04, INTEG-WEBHOOK-05, INTEG-WEBHOOK-06, INTEG-WEBHOOK-07, INTEG-SEC-01, INTEG-SEC-02, INTEG-SEC-03, INTEG-SEC-04, INTEG-SEC-05
**Success Criteria** (what must be TRUE):
  1. An org subscribes to events from the catalog (contractor/invoice/payment_run/workflow/classification/compliance_doc, Zod-typed discriminated-union payloads), and a greenfield dispatcher on the existing `OutboxEvent` outbox + QStash delivers them with exponential backoff (max 6), DLQ, and admin alert at 5 failures/1h.
  2. Each delivery carries an `X-CO-Signature: t=…,v1=…` HMAC-SHA256 header with a per-subscription secret and a 5-minute replay-acceptance window; sample verifiers ship in TS/Python/Go/PHP.
  3. A subscription targeting a private range, loopback, link-local, or `169.254.169.254` is rejected at BOTH subscribe time and dispatch time (re-resolve + IP-pin, redirects disabled), HTTPS-only by default, dispatch rate-limited to 100 events/min per subscription.
  4. Payloads redact PII (`include_pii: false` default), an OWASP API Top-10 review runs as automated tests at the phase gate, and a key used from >3 source IPs in 24h raises a leak alarm.
**Plans**: TBD
**Research flag**: INTEG-SEC-04 OWASP review must be real automated tests, not prose — flag for plan-phase rigor. Outbound SSRF is greenfield (`request-filtering-agent`); the inbound `webhook-dispatcher.ts` must not be overloaded.
**UI hint**: yes

### Phase 101: Theme C — Marketplace Listings + Developer Experience
**Goal**: Contractor Ops is reachable from ~9,000 apps via three marketplace listings, backed by a complete developer-experience surface.
**Depends on**: Phases 98–100 (stable API + webhooks)
**Requirements**: INTEG-ZAPIER-01, INTEG-ZAPIER-02, INTEG-N8N-01, INTEG-N8N-02, INTEG-MAKE-01, INTEG-MARKETPLACE-01, INTEG-DX-01, INTEG-DX-02, INTEG-DX-03, INTEG-DX-04
**Success Criteria** (what must be TRUE):
  1. A Zapier app (8+ triggers, 6+ actions) passes its sandbox bundle test and is submitted for public listing; a `@contractor-ops/n8n-nodes` community package publishes to npm with docs + example workflows; a Make.com app is submitted to the App Directory; an internal dashboard tracks all three listing states + version pins + review feedback.
  2. A Scalar developer portal hosts the OpenAPI reference, webhook event catalog, SDK install guides, sample recipes, changelog, and deprecation notices.
  3. A Postman collection auto-generates from OpenAPI and an Insomnia workspace is downloadable.
  4. A public status page reports API + webhook-dispatcher uptime + incident history (reusing v2.0 health monitoring), and a free-forever sandbox tier (100 req/day, no real writes) auto-seeds a fresh test org per developer signup.
**Plans**: TBD
**Research flag**: Marketplace review timelines are external/non-deterministic (Zapier 2–4wk, Make 1–2wk) — submit early, do NOT gate GA on approvals; n8n self-serve npm publish is the launch-day integration story. INTEG-ZAPIER-02 review iteration tracked as a separate ongoing milestone.
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 82 → 83 → … → 101. After Foundation (82), the three themes are concurrent — Theme A (83-88), Theme B (89-97, gated on 89), Theme C (98-101, gated on 98) — capped by solo-dev throughput, not by the numbering.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 82. v7.0 Foundation — Add-On + Flags + US Region | v7.0 | 4/4 | Complete    | 2026-06-07 |
| 83. Theme A — US Region Infrastructure | v7.0 | 4/4 | Complete    | 2026-06-07 |
| 84. Theme A — US Profile Fields + en-US Locale | v7.0 | 2/7 | In Progress|  |
| 85. Theme A — W-Form Intake + Tax-Treaty Engine | v7.0 | 0/TBD | Not started | - |
| 86. Theme A — TIN-Match → 1099-NEC → IRIS → State | v7.0 | 0/TBD | Not started | - |
| 87. Theme A — 1042-S + US Classification + Letter | v7.0 | 0/TBD | Not started | - |
| 88. Theme A — US Payment Rail | v7.0 | 0/TBD | Not started | - |
| 89. Theme B — Worker Model Abstraction (gate) | v7.0 | 0/TBD | Not started | - |
| 90. Theme B — Employee Registry per Market (×6) | v7.0 | 0/TBD | Not started | - |
| 91. Theme B — Akta Osobowe / Personnel File | v7.0 | 0/TBD | Not started | - |
| 92. Theme B — Leave + KP-Grade Time Tracking | v7.0 | 0/TBD | Not started | - |
| 93. Theme B — Employee On/Offboarding | v7.0 | 0/TBD | Not started | - |
| 94. Theme B — Payroll Integration Adapters | v7.0 | 0/TBD | Not started | - |
| 95. Theme B — HRIS Two-Way Sync | v7.0 | 0/TBD | Not started | - |
| 96. Theme B — Employee Self-Service Portal | v7.0 | 0/TBD | Not started | - |
| 97. Theme B — HR Dashboard | v7.0 | 0/TBD | Not started | - |
| 98. Theme C — Public REST API Surface (gate) | v7.0 | 0/TBD | Not started | - |
| 99. Theme C — API Keys + Scopes + Rate Limiting | v7.0 | 0/TBD | Not started | - |
| 100. Theme C — Outbound Webhooks + Integration Security | v7.0 | 0/TBD | Not started | - |
| 101. Theme C — Marketplace Listings + Developer Experience | v7.0 | 0/TBD | Not started | - |
