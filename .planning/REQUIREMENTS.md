# Requirements: Contractor Ops — Milestone v6.0

**Defined:** 2026-04-26
**Milestone:** v6.0 Platform Maturity & Operational Hardening
**Core Value:** The invoice-to-payment flow must work end-to-end: invoice arrives, gets matched to contract, routed through approval, and batched for payment — with full audit trail and zero manual tracking in spreadsheets.

## v6.0 Scope Decisions (locked at requirements time)

| Decision | Outcome | Source |
|---|---|---|
| Phase ordering | Foundation (Phase 70) BEFORE any feature work | PITFALLS P27–P31 (cross-tenant leak, PII redaction, message-key parity, Unleash signoff, OAuth scope cohabitation) |
| F2 IdP split | GWS+Slack as wedge (sub-phase 1) → Entra+Okta+GitHub as differentiator (sub-phase 2) | FEATURES (~95% SMB market hits GWS+Slack) + ARCHITECTURE (sub-phase containment) |
| F2 ordering | F4 ships before F2 (cooldown gate references F4 final-invoice state) | PITFALLS P7 |
| F3 ordering | F1 ships before F3 (free-zone license expiry composes on F1 reminder cron) | ARCHITECTURE schema dependency |
| Stripe tier gating | Compliance dashboard advisory at Starter; Compliance hard-block at Pro+; GWS+Slack deprovisioning at Starter; Entra+Okta+GitHub at Pro+; F4 IP-clause scanner at Pro+; UAE permitted-activity hard-block at Enterprise | FEATURES tier-gating recommendation |
| Arabic localization | F3 Gulf surfaces ship FULL AR + RTL; other v6.0 surfaces en/pl/de + AR-deferred-to-v6.x | FEATURES customer-facing-only AR scope |
| Contract clause scanner | Regex-first per-jurisdiction phrase library; Claude Vision tool_use only as MANUAL_REVIEW_REQUIRED tristate fallback | FEATURES + PITFALLS P22 (avoid AI hallucination in legal-adjacent surface) |
| Saudization band entry | Manual self-reported band; we do NOT auto-compute band (legal liability + quarterly matrix changes); we surface inputs (nationality breakdown, Qiwa-auth coverage, Iqama expiry) | FEATURES anti-features list |
| Drift escape hatch | Reused 3x (compliance requirement-set, Saudization Nitaqat thresholds, role taxonomy) — milestone-wide pattern mirrors v5.0 `recreateDraftAfterDrift` | SUMMARY milestone-wide patterns |
| Legal sign-off posture | LOCAL-ONLY deploy; legal sign-off DEFERRED. Every locked phrase guarded; every legal-sensitive flag PENDING in code-side signoff registry | Standing Project Constraints (memory + STATE.md) |

## v6.0 Requirements

Requirements for the v6.0 milestone. Each maps to exactly one phase (filled by roadmapper).

### Foundation (cross-cutting CI guards)

- [ ] **FOUND6-01**: Engineer can run `pnpm lint:schema` to fail CI when any new Prisma model lacks `organizationId` and is not registered in the global-lookup-list allowlist
- [ ] **FOUND6-02**: API receives strict-by-default body redaction — `LOG_BODY_EXCLUDE_PREFIXES` becomes opt-in body logging via explicit `LOG_BODY_INCLUDE_PREFIXES`, with all v6.0 routers added to the include list only after manual review
- [ ] **FOUND6-03**: Engineer can run `pnpm i18n:parity` per-PR; CI fails if any new i18n key in en.json is missing a peer in de/pl/ar (locked-phrase guard remains the existing 78-phrase superset)
- [ ] **FOUND6-04**: Admin cannot ship a legal-sensitive Unleash flag to staging unless the corresponding entry in `signoff-registry.ts` is PENDING (CI gate); flipping to APPROVED requires a code commit referencing the legal-sign-off ticket
- [ ] **FOUND6-05**: Engineer can re-OAuth a v3.0 Google Workspace connection to upgrade scopes without breaking existing read-only directory-import use; `IntegrationConnection.scopeCapabilities` JSONB persists per-connection scope set with backfill migration for existing connections
- [ ] **FOUND6-06**: Engineer can use a separate Pino child logger with explicit allow-list for IdP audit trails (avoids over-redacting fields the audit needs)

### Compliance Document Lifecycle (F1)

- [x] **COMPL-01**: Admin can view a per-org compliance dashboard showing at-risk contractor count, upcoming-renewal queue, and currently-blocked-payments queue
- [ ] **COMPL-02**: System auto-resolves required documents per contractor based on country + engagement type + classification outcome (IR35 / Scheinselbständigkeit), persisting them as `ContractorComplianceItem` rows
- [x] **COMPL-03**: System sends reminder cascades at 90 / 60 / 30 / 15 / 7 days before document expiry, with per-recipient daily-digest throttle and per-band idempotency
- [x] **COMPL-04**: Contractor receives portal-side notification of upcoming expiry with one-click upload-replacement flow that auto-marks the requirement satisfied with a refreshed expiry date
- [x] **COMPL-05**: Admin payment-run creation is hard-blocked when any selected contractor has an EXPIRED CRITICAL compliance item, with structured per-contractor reason and deep link to the affected document
- [x] **COMPL-06**: Approval engine evaluates a `complianceCritical(EXPIRED)` condition operator and holds the approval in `PENDING_COMPLIANCE` state when triggered, preventing back-door auto-`READY` transitions
- [x] **COMPL-07**: System writes an immutable `PaymentRunComplianceCheck` audit row in the same transaction as the bank-file export (mid-batch race protection)
- [ ] **COMPL-08**: Document expiry dates are stored as `@db.Date` (not `DateTime`) with explicit `expiry_jurisdiction_tz` field — "expires today" resolves in contractor jurisdiction, not org HQ
- [ ] **COMPL-09**: Per-jurisdiction policy registry seeds (PL/UK/DE/UAE/SA) cover at minimum: UK Right-to-Work share code (90-day generation expiry), UK UTR, DE A1-Bescheinigung (24-month max), DE Aufenthaltstitel, DE §48b EStG (construction conditional), PL ZUS A1 (12-month max), PL UDT, KSA Iqama (1-year), KSA work permit + Qiwa-auth boolean, UAE Emirates ID, UAE free-zone trade license
- [ ] **COMPL-10**: Admin can trigger `recreateComplianceAssessment(reason)` to regenerate requirements when the compliance-policy rule set version changes (mirrors v5.0 `recreateDraftAfterDrift`); operation is audit-logged and never auto-runs
- [x] **COMPL-11**: All COMPL surfaces ship en/pl/de parity at message-key level; locked-phrase registry extended with jurisdiction-specific document type names

### IdP Deprovisioning (F2)

- [x] **IDP-01**: Admin can trigger access revocation for a single contractor via the offboarding workflow's `ACCESS_REVOKE` task; system enumerates connected IdPs and presents a per-IdP impact preview (`describeImpact`) before executing
- [x] **IDP-02**: System enforces a 14-day cooldown gate after `ContractorAssignment.status = ENDED` before allowing IdP deprovisioning to start (final-invoice race protection)
- [x] **IDP-03**: Admin can deprovision a contractor's Google Workspace identity — system suspends user, revokes all OAuth grants, and signs the user out of all sessions
- [x] **IDP-04**: Admin can deprovision a contractor's Slack identity — system invalidates active sessions and SCIM-deactivates the user (`active=false`)
- [x] **IDP-05**: Admin can deprovision a contractor's Microsoft Entra ID identity — system disables the account and revokes all sign-in sessions, with pre-flight Conditional Access policy enumeration warning when org policies may override the revoke
- [x] **IDP-06**: Admin can deprovision a contractor's Okta identity — system deactivates the user and clears active sessions
- [x] **IDP-07**: Admin can deprovision a contractor's GitHub org membership — system removes the org member, explicitly revokes per-PAT credentials, and flags outside-collab repos as manual-task with link
- [x] **IDP-08**: Each IdP adapter implements both `suspendAccount()` and `revokeAllSessions()`; per-provider integration test asserts revocation is verifiable within 5 minutes
- [x] **IDP-09**: System runs each provider deprovisioning step as an independent QStash job (no `Promise.allSettled` aggregation); aggregate `DeprovisioningRun.status` resolves to `COMPLETED` / `PARTIAL_FAILURE` / `FAILED`
- [x] **IDP-10**: Admin can view a `DeprovisioningRun` audit trail showing per-step status, retry attempts, request/response hashes (SOC2 evidence-grade), and last-error message; `PARTIAL_FAILURE` runs surface in an admin reconcile queue
- [x] **IDP-11**: System detects a v3.0 Google Workspace connection lacking write scopes and presents a re-OAuth prompt with `prompt=consent` rather than silently failing or breaking existing read-only flows
- [x] **IDP-12**: Admin can manually mark a `MANUAL_ESCALATION` step as complete with a written reason (audit-logged), unblocking the offboarding workflow while preserving the failure record
- [x] **IDP-13**: Webhook events from IdPs that originate from our own deprovision call are filtered out via short-TTL `IdpChangeProvenance` table — no self-trigger loops with v3.0 GWS directory-import
- [x] **IDP-14**: System enforces minimum-privilege OAuth scopes per provider (GWS `admin.directory.user`, Entra `User.EnableDisableAccount.All` + `User.RevokeSessions.All`, GitHub `admin:org`, Slack `admin.users.session:write` + `scim:write` org-token, Okta "User Admin" role)
- [x] **IDP-15**: System has no "reactivate contractor" button — returning contractors create a new engagement with fresh provisioning, by design

### Gulf Operational Polish (F3)

- [x] **GULF-01**: Admin can record a contractor's UAE free-zone assignment — selecting from 10-zone seed enum (DIFC, DMCC, IFZA, Dubai Internet City, Dubai Media City, Meydan FZ, JAFZA, SHAMS, RAKEZ, ADGM) plus Mainland — with license number, license category, license expiry, and permitted-activities text
- [x] **GULF-02**: System tracks UAE free-zone trade license expiry as a `ContractorComplianceItem` of severity CRITICAL participating in the F1 reminder cascade and payment-block gate
- [x] **GULF-03**: System surfaces a permitted-activity scope-mismatch advisory when a contract's activity descriptor falls outside the contractor's free-zone permitted-activities list, with auto-add of NOC required-document for the affected engagement
- [x] **GULF-04**: Admin can record per-engagement Saudi nationality + `isSaudi` boolean + `qiwaContractAuthenticated` boolean (2026-04-15 reg)
- [x] **GULF-05**: Admin can manually enter and update the org's current Saudization Nitaqat band (PLATINUM / HIGH_GREEN / MID_GREEN / LOW_GREEN / YELLOW / RED) with industry-segment field; system records last-updated timestamp and prompts quarterly re-entry — system does NOT auto-compute the band
- [x] **GULF-06**: Admin can view a Saudization dashboard surfacing total headcount, Saudi-national count, nationalisation rate, current band, Qiwa-auth coverage gap, and Iqama expiry roll-up (reusing F1 expiry data)
- [x] **GULF-07**: Admin offboarding a Saudi-national contractor sees a pre-offboarding impact banner showing the projected Saudization-band trajectory after the offboarding completes
- [ ] **GULF-08**: All GULF surfaces (compliance dashboard, free-zone forms, Saudization dashboard, NOC flow) ship full Arabic localization with RTL CSS logical properties (`ms-` / `me-` / `ps-` / `pe-` only); ESLint guard bans `ml-` / `mr-` in v6.0 surfaces
- [x] **GULF-09**: Locked-phrase registry extends with UAE/KSA Arabic statutory terms (free-zone authority names, Saudization band labels, Qiwa-auth status)
- [ ] **GULF-10**: Admin can override seed Saudization Nitaqat thresholds + UAE permitted-activity catalogues per-org with audit-logged write; system displays "Custom — verify with adviser" badge on overrides
- [x] **GULF-11**: System routes ME-region (UAE/KSA) data to the ME database per the existing v4.0 multi-region strategy; new gulf models carry explicit regional-routing annotations and ship with a schema-lint test asserting no cross-region leakage

### Offboarding Hardening (F4)

- [x] **OFFB-01**: Admin offboarding workflow includes 4 role-typed knowledge-transfer seed templates (Software Engineer / Designer / Product Manager / Generic Consultant); template auto-selects from contractor's primary role tag with manual override
- [x] **OFFB-02**: System auto-routes KT tasks to the contractor's manager; if the manager is on PTO (per v2.0 calendar integration) the task delegates to the configured fallback approver
- [x] **OFFB-03**: Admin can extend role taxonomy via per-org `WorkflowRole` model with editable templates; v6.0 ships 4 seed templates, ops customise without engineering involvement
- [ ] **OFFB-04**: System runs an IP-assignment contract clause health check at contract upload via reused `ClaudeOcrAdapter` with `contract-health-tools.ts` tool_use schema, storing `Contract.complianceFlagsJson` + `complianceFlagsCheckedAt` + `complianceFlagsModelVer`
- [ ] **OFFB-05**: Health check returns a tristate verdict (`LIKELY_PRESENT` / `LIKELY_MISSING` / `MANUAL_REVIEW_REQUIRED`) using a regex-first per-jurisdiction phrase library covering UK + DE + PL + KSA + UAE + US wording, including DE Werkvertrag Schöpferprinzip + Nutzungsrechte distinction
- [ ] **OFFB-06**: System hard-blocks the offboarding workflow's `WorkflowRun.completedAt` until the `IP_VERIFICATION` task completes — admin signs the IP-assignment ratification document via existing v2.0 e-sign integration (DocuSign for UK/PL/US, Autenti for DE)
- [x] **OFFB-07**: OWNER-role admin can override the IP_VERIFICATION block with a required reason text + acknowledgement checkbox; override is audit-logged and surfaces a permanent badge on the offboarding record
- [ ] **OFFB-08**: System tracks structured credential-rotation tasks per offboarding — admin records `CredentialReference` rows (label + vault URL + successor user) for each access type; content-validation regex rejects strings shaped like AKIA*, GitHub PATs, JWT structure, or hex≥32 (system stores POINTERS only, never secrets)
- [ ] **OFFB-09**: Admin can view a contract clause health audit log showing every health-check run with model version (`complianceFlagsModelVer`) for replay/audit; manual re-run available
- [x] **OFFB-10**: System adds `WorkflowTaskType.IP_VERIFICATION` and `WorkflowTaskType.CONTRACT_HEALTH_CHECK` to the workflow engine; `workflow:override_blocking_task` permission registered OWNER-only
- [x] **OFFB-11**: All OFFB surfaces ship en/pl/de parity at message-key level; locked-phrase registry extends with Werkvertrag IP-clause canonical wordings

## v7+ Requirements (Future / Deferred)

Acknowledged but not in v6.0 roadmap.

> **v7.0 GTM Expansion milestone planned** — US cross-border + Workforce management.
> Full backlog spec: [`milestones/v7.0-BACKLOG.md`](milestones/v7.0-BACKLOG.md). Gates pre-prod release alongside v6.0.
> Requirement IDs below grouped by milestone target.

### Compliance & Governance

- **COMPL-FUTURE-01**: AI-suggested document policies based on past contracts
- **COMPL-FUTURE-02**: Department-based per-doc-policy overrides
- **COMPL-FUTURE-03**: Per-org custom required documents beyond seeded jurisdiction registry

### IdP & Identity

- **IDP-FUTURE-01**: Time-delayed and immediate IdP deprovisioning modes (alternative to manual approval gate)
- **IDP-FUTURE-02**: Vacation-responder configuration on deprovision
- **IDP-FUTURE-03**: Drive ownership transfer
- **IDP-FUTURE-04**: Slack DM history export
- **IDP-FUTURE-05**: Additional IdP adapters (1Password SaaS Manager, Jamf, JumpCloud)
- **IDP-FUTURE-06**: 1Password / Bitwarden actual-rotation integration (vs reference-only)

### Gulf Polish

- **GULF-FUTURE-01**: UAE NOC drafting and submission flow
- **GULF-FUTURE-02**: Saudization band auto-compute (likely never — legal liability + quarterly matrix drift)

### Offboarding

- **OFFB-FUTURE-01**: Embedding-similarity contract-clause matching (vs regex)
- **OFFB-FUTURE-02**: AI-generated KT documentation drafts

### v7.0 — US Cross-Border Expansion

Wedge thesis: *Bill.com for cross-border, without the Deel EOR markup.* Theme A in [`milestones/v7.0-BACKLOG.md`](milestones/v7.0-BACKLOG.md). NOT a US-domestic-AP head-on play.

- **US-FORM-01**: W-9 collection wizard for US-resident contractors with audit trail
- **US-FORM-02**: W-8BEN / W-8BEN-E collection for foreign contractors of US clients with treaty article picker
- **US-FORM-03**: IRS TIN-matching API (e-Services) integration with retry + admin escalation on mismatch
- **US-FORM-04**: 1099-NEC year-end generation per recipient (threshold $600 USD-eq) with corrections + PDF + audit archive
- **US-FORM-05**: IRS FIRE e-file integration (with IRIS-ready cutover per IRS roadmap; FIRE as fallback)
- **US-FORM-06**: 1042-S generation for US-source payments to foreign contractors (treaty-rate withholding)
- **US-FORM-07**: Per-state 1099 filing handler (7 states; CFSF participation where eligible)
- **US-PAY-01**: ACH NACHA file generator (PPD/CCD/CTX) reusing v4.0/v5.0 payment-export factory
- **US-PAY-02**: USD as first-class currency with per-org default + exchange-rate sourcing
- **US-PAY-03**: Modern Treasury / Stripe Treasury adapter for programmatic ACH initiation
- **US-PAY-04**: Wire-transfer (Fedwire) export for high-value cross-border payouts
- **US-PAY-05**: Plaid Identity verification for US contractor bank-account linking
- **US-CLASS-01**: Generic classification engine extension with US rule set (federal common-law, CA ABC test / AB5, §530 safe harbor)
- **US-CLASS-02**: California AB5 watchlist with stricter ABC test by default + admin override with reason
- **US-CLASS-03**: 1099-K threshold tracker (informational; surfaces on cumulative engagement payouts)
- **US-CLASS-04**: Classification Determination Letter PDF generator (mirrors UK SDS from v5.0 Phase 59)
- **US-FIELD-01**: EIN validator (XX-XXXXXXX + IRS prefix table)
- **US-FIELD-02**: SSN intake with PII-grade masking + RBAC-gated full-display
- **US-FIELD-03**: US address validation via USPS Address API (CASS-certified)
- **US-FIELD-04**: US contractor profile component dispatched from CountryComplianceSection
- **US-LOC-01**: en-US locale full key parity (date/currency/measure formatting, American English copy)
- **US-LOC-02**: US tax-treaty rate table (PL/DE/UK/UAE/KSA/IE/NL) auto-applied on cross-border
- **US-LOC-03**: W-8BEN treaty-article auto-populate based on contractor home jurisdiction
- **US-INFRA-01**: `us-east-1` Neon region added to per-org region routing (v4.0 pattern)
- **US-INFRA-02**: US-specific R2 storage bucket for tax-form archives (data-residency)
- **US-INFRA-03**: IRS-mandated retention (4-year 1099-NEC, 7-year backup-withholding) via soft-delete + scheduled archive

### v7.0 — Workforce Management (Employee Lite + HRIS Sync)

Positioning: *One tool for your whole workforce — contractors AND employees. Payroll stays with your accountant.* Theme B in [`milestones/v7.0-BACKLOG.md`](milestones/v7.0-BACKLOG.md). Ścieżka A (lite) — explicitly NO own payroll engine; integration adapters only.

- **WORKER-01**: `Worker` discriminated-union model (Contractor | Employee) with non-breaking migration (defaults to CONTRACTOR for back-compat)
- **WORKER-02**: tRPC namespace split — workerRouter + contractorRouter + employeeRouter (preserve v1–v6 route shapes)
- **WORKER-03**: RLS / tenant-isolation extension; HR-only fields gated by per-type RBAC
- **WORKER-04**: New roles HR_ADMIN, HR_MANAGER, PAYROLL_OFFICER, LEAVE_APPROVER (existing 8 roles unchanged)
- **WORKER-05**: Feature flag `workforce-employees` with render-tree removal + tRPC FORBIDDEN on flag-off (v5.0 classification pattern)
- **EMP-REG-PL-01**: PL employee fields — PESEL (mod-11), urząd skarbowy, ZUS oddział, stanowisko, wymiar etatu, stawka brutto, ZUS title code, NFZ oddział
- **EMP-REG-DE-01**: DE employee fields — Steuer-IdNr (11-digit mod-11), Sozialversicherungsnummer, Krankenkasse ID, Lohnsteuerklasse, Kinderfreibetrag, Kirchensteuer flag, ELStAM hook
- **EMP-REG-UK-01**: UK employee fields — NI number (DWP-validated), PAYE reference, tax code with emergency/W1/M1/K flags, student-loan plan, pension auto-enrol
- **EMP-REG-US-01**: US employee fields — SSN (PII-masked), W-4 step 1c filing status, state withholding (10-state matrix + free-text fallback for v7.0)
- **EMP-REG-AE-01**: UAE employee fields — Emirates ID, visa type, WPS Establishment ID
- **EMP-REG-SA-01**: KSA employee fields — Iqama / National ID, GOSI registration, Saudization category contribution flag
- **AKTA-01**: 4-section personnel file (PL cz. A/B/C/D; equiv DE/UK/US) with per-section RBAC
- **AKTA-02**: Per-jurisdiction retention engine (PL 10/50 yr, DE 10/30 yr, UK 6/7 yr, US I-9 3-yr-post-hire)
- **AKTA-03**: RODO / GDPR erasure handler with statutory-retention exemption layer
- **AKTA-04**: Document classification at upload (A/B/C/D taxonomy + admin classify-step on ambiguity)
- **LEAVE-01**: Leave-balance engine per market (PL 20/26, DE BUrlG, UK 5.6-week, US per-state, UAE/SA per-MOL/MHRSD)
- **LEAVE-02**: Leave-request workflow on v1.0 approval-chain; per-org leave types; blackout periods
- **LEAVE-03**: Team calendar with capacity heatmap + overlap warnings
- **LEAVE-04**: PL e-ZLA pull via ZUS OAuth; auto-create sick-leave + payroll-integration push
- **LEAVE-05**: DE eAU pull from Krankenkasse via TI-Messenger / KIM (post-2023 mandatory digital)
- **TIME-EMP-01**: KP-grade time tracking distinct from v2.0 B2B time (overtime PL 50/100%, DE §3 ArbZG, UK WTR opt-out, night/weekend/holiday premiums)
- **TIME-EMP-02**: Per-jurisdiction working-time-limit alerts (PL 8h/48h, DE ArbZG, UK 48h opt-out, US FLSA OT)
- **TIME-EMP-03**: PL ewidencja czasu pracy report per KP §149 + 3-year audit-immutable archive
- **EMP-ON-01**: Per-market onboarding workflow templates (PL badania/PIT-2/PPK/świadectwo, DE Personalfragebogen/Steuer-ID/SV/bAV, UK P45-P46/RTI/pension, US W-4/I-9 E-Verify/state W-4/direct-deposit)
- **EMP-OFF-01**: Per-market offboarding workflow (PL świadectwo/ekwiwalent/ZUS ZWUA/PIT-11, DE Arbeitszeugnis/Abmeldung/Lohnsteuerbescheinigung, UK P45/final RTI/pension/P11D, US final-paycheck/COBRA/W-2/401(k))
- **EMP-OFF-02**: Composes with v6.0 F4 offboarding hardening (extends rather than duplicates)
- **PAYROLL-PL-01**: Symfonia Kadry i Płace export adapter (CSV + XML)
- **PAYROLL-PL-02**: Comarch ERP XL / Optima export adapter
- **PAYROLL-PL-03**: Enova365 export adapter
- **PAYROLL-DE-01**: DATEV Lohn und Gehalt export adapter (ASCII + DATEVconnect where subscribed)
- **PAYROLL-DE-02**: Sage HR / Personalwirtschaft export adapter
- **PAYROLL-UK-01**: Sage Payroll / BrightPay / Moneysoft export adapters (RTI-compatible FPS/EPS)
- **PAYROLL-UK-02**: HMRC RTI direct submission (deferred to v7.5 — complexity warrants separate slice)
- **PAYROLL-US-01**: Gusto / QuickBooks Payroll / ADP export adapters (CSV + native API where available)
- **HRIS-SYNC-01**: Personio adapter on v2.0 integration framework (OAuth, webhooks, health)
- **HRIS-SYNC-02**: Personio → Contractor Ops one-way pull (people/contracts/departments/custom attrs) hourly + on-demand
- **HRIS-SYNC-03**: Contractor Ops → Personio one-way push (invoice paid, payment status, classification outcome) on event
- **HRIS-SYNC-04**: BambooHR adapter (same shape as Personio)
- **HRIS-SYNC-05**: Conflict-resolution policy — HRIS source of truth for registry fields; Contractor Ops source of truth for invoice/payment/compliance fields; on conflict, registry updates from HRIS, financial/compliance fields lock against HRIS overwrite
- **HRIS-SYNC-06**: Per-org single-adapter choice (Personio OR BambooHR, not both — prevents three-way sync hell)
- **EMP-PORTAL-01**: Employee self-service portal extends v2.0 contractor portal (magic-link, subdomain routing, `/employee/*` routes)
- **EMP-PORTAL-02**: Employee dashboard — pay stubs (from payroll integration), leave balance, time-off request, document upload, personal akta view
- **EMP-PORTAL-03**: Manager dashboard — direct reports' leave requests, time entries to approve, document expiry flags
- **EMP-PORTAL-04**: Portal i18n parity — en/pl/de/ar/en-US (Arabic RTL from v4.0, formal-Sie from v5.0)
- **HR-DASH-01**: Headcount widget (total / dept / jurisdiction / employment-type / contract-end-date)
- **HR-DASH-02**: Vacation-utilization widget with under-utilization flag (>10 days unused at year-end)
- **HR-DASH-03**: Document-expiry widget (visa/work-permit/contract/medical/training) composes with v6.0 F1 compliance-document engine
- **HR-DASH-04**: Probation-end watchlist (14/7/0 days)
- **HR-DASH-05**: Saudization / Emiratisation rollup composes with v6.0 F3 Gulf operational polish

### v7.0 — Integration Marketplace (Public API + Webhooks + Zapier / n8n / Make)

Positioning: *Deepest multi-market compliance + widest integration reach — connect Contractor Ops to 9,000+ apps without engineering.* Theme C in [`milestones/v7.0-BACKLOG.md`](milestones/v7.0-BACKLOG.md). Strategic rationale: neutralises Rippling 600+ integrations threat via three marketplace listings (Zapier 7000+ / Make.com 1700+ / n8n 500+) on one backend implementation. API access tier-gated within base tier (Starter read-only / Pro read+write / Enterprise unlimited), NOT add-on. Reuses `apps/public-api` (Hono).

- **INTEG-API-01**: Extend `apps/public-api` (Hono) with read+write REST endpoints covering contractors / invoices / payments / payment_runs / workflows / workflow_tasks / classifications / compliance_documents / audit_log; Zod input validation; tenant-scoped via API key
- **INTEG-API-02**: OpenAPI 3.1 spec auto-generated from Zod schemas; published to Mintlify / Scalar developer portal
- **INTEG-API-03**: API versioning policy `/v1/*` base path; Sunset header per RFC 8594; major-version-bump only on breaking changes
- **INTEG-API-04**: Cursor-based pagination, standardized filter/sort syntax across all list endpoints
- **INTEG-API-05**: Auto-generated TypeScript + Python SDKs published to npm + PyPI as `@contractor-ops/sdk` and `contractor-ops-sdk`
- **INTEG-AUTH-01**: `ApiKey` Prisma model — org-scoped, named labels, rotation/revocation audit, bcrypt + per-key salt storage, `co_live_xxx` prefix display
- **INTEG-AUTH-02**: Per-key scopes (`contractors:read/write`, `invoices:read/write`, `payments:read/write`, `webhooks:manage`, `classifications:read`, `compliance:read`, `audit:read`); least-privilege default
- **INTEG-AUTH-03**: Settings → Developer page — key CRUD UI, last-used-at, source IP log, scope picker, rotation grace period
- **INTEG-AUTH-04**: Redis (Upstash) token-bucket rate limiting per key; per-tier limits (Starter 1k req/mc + 1 webhook sub, Pro 10k + 5, Enterprise unlimited)
- **INTEG-AUTH-05**: Every external mutation audit-logged with `apiKeyId` + `sourceIp` + `userAgent` (extends v3.0 `writeAuditLog`)
- **INTEG-WEBHOOK-01**: `WebhookSubscription` Prisma model — per-org, per-event-filter, target URL, HMAC secret, retry policy, last-success/failure timestamps
- **INTEG-WEBHOOK-02**: Event catalog initial: `contractor.{created,updated,offboarded,compliance_blocked}`, `invoice.{received,matched,approved,rejected,paid}`, `payment_run.{created,completed}`, `workflow.{task.completed,completed}`, `classification.outcome`, `compliance_doc.{expiring_soon,expired}` (composes with v6.0 F1 band-state-machine). Zod-typed discriminated-union payloads.
- **INTEG-WEBHOOK-03**: QStash-queued dispatcher (reuse v2.0 infra); exponential backoff (1m/5m/30m/2h/12h/24h); 6 max retries; DLQ to `webhook_failures`; admin alert on 5 failures in 1h
- **INTEG-WEBHOOK-04**: HMAC-SHA256 signature header (`X-CO-Signature` = `t={unix_ms},v1={hex_hmac}`) Stripe-convention; per-subscription secret
- **INTEG-WEBHOOK-05**: Replay protection — signed timestamp + 5-min acceptance window; sample verifier in TS/Python/Go/PHP
- **INTEG-WEBHOOK-06**: Webhook subscription mgmt API + UI Settings → Developer → Webhooks with test-fire button + last-100-deliveries log
- **INTEG-WEBHOOK-07**: PII redaction opt-in per subscription (`include_pii: false` default); strips PESEL/SSN/NI/Steuer-IdNr/Emirates ID/Iqama/email/phone unless flag set (RODO-defensible)
- **INTEG-SEC-01**: SSRF guard — pre-flight reject private IPs (RFC 1918, loopback, link-local, AWS metadata `169.254.169.254`, cloud equivalents); DNS-rebind protection (verify resolved IP at connect time)
- **INTEG-SEC-02**: HTTPS-only target URLs default; HTTP only via per-org admin override + warning banner
- **INTEG-SEC-03**: Per-org webhook dispatch rate limit (100 events/min per subscription) — anti-fanout-DDoS
- **INTEG-SEC-04**: OWASP API Security Top 10 review checklist as phase gate (BOLA/BFLA/SSRF/mass-assignment/security-misconfig/injection)
- **INTEG-SEC-05**: API key leak alarm — alert org admins if key shows usage from >3 distinct source IPs in 24h
- **INTEG-ZAPIER-01**: Zapier app — auth (API key or OAuth 2.0), 8+ triggers (event-catalog-mapped), 6+ actions (create contractor, create invoice, approve invoice, mark payment paid, create workflow task, lookup contractor by tax ID); Zapier sandbox bundle test
- **INTEG-ZAPIER-02**: Zapier public listing submission + 2–4 wk review cycle tracked as separate phase milestone
- **INTEG-N8N-01**: n8n community node package `@contractor-ops/n8n-nodes` published to npm; nodes mirror Zapier trigger/action surface; installable via n8n community-nodes UI
- **INTEG-N8N-02**: n8n docs page + example workflows (invoice-to-Slack, contractor-onboard-from-Personio, compliance-expiry-to-PagerDuty)
- **INTEG-MAKE-01**: Make.com app submission to Make App Directory; same trigger/action surface as Zapier; ~1–2 wk review
- **INTEG-MARKETPLACE-01**: Internal listing-status dashboard — track all three marketplace approval states, version pins, last review feedback
- **INTEG-DX-01**: Developer portal site (`developers.contractor-ops.{tld}`) — Mintlify or Scalar — OpenAPI reference, webhook event catalog, SDK install guides, sample apps (Zapier/n8n/Make recipes), changelog, deprecation notices
- **INTEG-DX-02**: Postman collection (auto-generated from OpenAPI) + Insomnia workspace download
- **INTEG-DX-03**: Public status page (`status.contractor-ops.{tld}`) — API + webhook dispatcher uptime + incident history (reuse v2.0 health-monitoring pattern)
- **INTEG-DX-04**: Sandbox environment + free-forever public-API tier (100 req/day, no real data writes — auto-seed fresh test org per developer signup)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---|---|
| OCR auto-extraction of expiry dates | High false-positive risk on multi-format docs; user-entered date is the auditable source of truth |
| Auto-generate compliance documents | EOR territory — we coordinate, we don't generate legal docs |
| Compliance score gamification | Behavioural-design risk in legal-adjacent surface |
| Block invoice intake on expired docs | Wrong gate point — block at payment, not intake (a contractor with an expired doc may still need to bill for completed work) |
| Full SCIM provisioning across all IdPs | We deprovision only — full identity lifecycle is IGA territory |
| Auto-detect orphaned IdP accounts | Out-of-scope discovery noise; v6.0 is targeted-revoke per known contractor |
| Delete-by-default deprovisioning (vs suspend) | Suspend preserves audit trail and recovery path; delete is irreversible operational risk |
| Mailbox auto-forward on deprovision | Privacy + legal risk; admin handles via standard org policy |
| Full UAE permitted-activity catalogue | 600–2000 codes per zone; we ship a 20-category curated list, admin enters detail in free-text |
| Auto-compute Saudization Nitaqat band | Legal liability + thresholds change quarterly; admin enters manually with quarterly reminder |
| Storing actual credentials (`Credential` model) | Blast radius and rotation nightmare; `CredentialReference` only |
| Auto-rotating API keys on offboarding | Out-of-scope PAM territory |
| Auto-generating IP-assignment language | Legal liability — we flag absence, admin owns wording |
| Block offboarding on KT incompleteness | Soft-warn only — KT is human-judgment work, not gate-able |
| AI-generated KT documentation | Confabulation risk; system tracks structure, humans author content |
| "Reactivate contractor" button | Returning contractors get fresh engagement + fresh provisioning |
| Mobile-native v6.0 surfaces | Web-first per existing constraint; mobile responsive only |

## Traceability

Which phases cover which requirements. Filled by roadmapper on 2026-04-26.

| Requirement | Phase | Status |
|---|---|---|
| FOUND6-01 | Phase 70 | Pending |
| FOUND6-02 | Phase 70 | Pending |
| FOUND6-03 | Phase 70 | Pending |
| FOUND6-04 | Phase 70 | Pending |
| FOUND6-05 | Phase 70 | Pending |
| FOUND6-06 | Phase 70 | Pending |
| COMPL-01 | Phase 73 | Complete |
| COMPL-02 | Phase 71 | Pending |
| COMPL-03 | Phase 72 | Complete |
| COMPL-04 | Phase 73 | Complete |
| COMPL-05 | Phase 72 | Complete |
| COMPL-06 | Phase 72 | Complete |
| COMPL-07 | Phase 72 | Complete |
| COMPL-08 | Phase 71 | Pending |
| COMPL-09 | Phase 71 | Pending |
| COMPL-10 | Phase 71 | Pending |
| COMPL-11 | Phase 73 | Complete |
| IDP-01 | Phase 77 | Complete |
| IDP-02 | Phase 76 | Complete |
| IDP-03 | Phase 77 | Complete |
| IDP-04 | Phase 77 | Complete |
| IDP-05 | Phase 78 | Complete |
| IDP-06 | Phase 78 | Complete |
| IDP-07 | Phase 78 | Complete |
| IDP-08 | Phase 76 | Complete |
| IDP-09 | Phase 76 | Complete |
| IDP-10 | Phase 76 | Complete |
| IDP-11 | Phase 76 | Complete |
| IDP-12 | Phase 77 | Complete |
| IDP-13 | Phase 76 | Complete |
| IDP-14 | Phase 76 | Complete |
| IDP-15 | Phase 76 | Complete |
| GULF-01 | Phase 79 | Complete |
| GULF-02 | Phase 79 | Complete |
| GULF-03 | Phase 79 | Complete |
| GULF-04 | Phase 79 | Complete |
| GULF-05 | Phase 79 | Complete |
| GULF-06 | Phase 79 | Complete |
| GULF-07 | Phase 79 | Complete |
| GULF-08 | Phase 79 | Pending |
| GULF-09 | Phase 79 | Complete |
| GULF-10 | Phase 79 | Pending |
| GULF-11 | Phase 79 | Complete |
| OFFB-01 | Phase 74 | Complete |
| OFFB-02 | Phase 74 | Complete |
| OFFB-03 | Phase 74 | Complete |
| OFFB-04 | Phase 75 | Pending |
| OFFB-05 | Phase 75 | Pending |
| OFFB-06 | Phase 75 | Pending |
| OFFB-07 | Phase 74 | Complete |
| OFFB-08 | Phase 75 | Pending |
| OFFB-09 | Phase 75 | Pending |
| OFFB-10 | Phase 74 | Complete |
| OFFB-11 | Phase 74 | Complete |

**Coverage:**
- v6.0 requirements: **54 total** (6 FOUND6 + 11 COMPL + 15 IDP + 11 GULF + 11 OFFB)
- Mapped to phases: **54 / 54** (100%)
- Unmapped: **0** ✓
- Phase distribution:
  - Phase 70 (Foundation): 6 requirements (FOUND6-01..06)
  - Phase 71 (F1 schema + policy): 4 requirements (COMPL-02, 08, 09, 10)
  - Phase 72 (F1 reminder + payment block): 4 requirements (COMPL-03, 05, 06, 07)
  - Phase 73 (F1 dashboard + portal + i18n): 3 requirements (COMPL-01, 04, 11)
  - Phase 74 (F4 workflow + KT + override): 6 requirements (OFFB-01, 02, 03, 07, 10, 11)
  - Phase 75 (F4 health check + IP verify + credentials): 5 requirements (OFFB-04, 05, 06, 08, 09)
  - Phase 76 (F2 capability + saga + cooldown): 8 requirements (IDP-02, 08, 09, 10, 11, 13, 14, 15)
  - Phase 77 (F2 GWS + Slack wedge): 4 requirements (IDP-01, 03, 04, 12)
  - Phase 78 (F2 Entra + Okta + GitHub differentiator): 3 requirements (IDP-05, 06, 07)
  - Phase 79 (F3 Gulf): 11 requirements (GULF-01..11)
  - Phase 80 (verification + UAT): 0 requirements (verification phase covers all v6.0 surfaces)

---
*Requirements defined: 2026-04-26*
*Traceability filled by roadmapper: 2026-04-26 — 54/54 mapped, 100% coverage*
