# Requirements: Contractor Ops — Milestone v7.0

**Defined:** 2026-06-07
**Milestone:** v7.0 GTM Expansion (US Cross-Border + Workforce Management + Integration Marketplace)
**Core Value:** The invoice-to-payment flow must work end-to-end: invoice arrives, gets matched to contract, routed through approval, and batched for payment — with full audit trail and zero manual tracking in spreadsheets.

Full strategic spec: [`milestones/v7.0-BACKLOG.md`](milestones/v7.0-BACKLOG.md). Domain research: [`research/SUMMARY.md`](research/SUMMARY.md) (+ STACK/FEATURES/ARCHITECTURE/PITFALLS).

## v7.0 Scope Decisions (locked at requirements time)

| Decision | Outcome | Source |
|---|---|---|
| Theme scope | All three themes A + B + C in v7.0 | User confirmation 2026-06-07 |
| Theme ordering | Parallel — Themes A/B/C concurrent; `WORKER-01` the ONLY hard serialization point (no B-side req starts before it); `INTEG-API-01` is Theme C foundation | Backlog locked-decision #2 / #9 |
| Pricing & packaging | `Workforce` + `US Cross-Border` add-on SKUs (org buys on top of base tier); Theme C tier-gated within base (Starter read-only / Pro read+write / Enterprise unlimited); new `requireAddOn` middleware alongside `requireTier` | Backlog locked-decision #1 |
| US payroll adapters | Exactly 3 — Gusto + QuickBooks Payroll + ADP (Workday/Paychex/Rippling-payroll deferred to v8.0) | Backlog locked-decision #4 |
| US state-withholding | 10 highest-population states + free-text fallback (full 50-state matrix deferred) | Backlog locked-decision #8 |
| **IRS e-file path** | **IRIS-PRIMARY (mandatory).** Research correction: IRS FIRE decommissions 2026-12-31 — TY2026 returns (filed early 2027, the year v7.0 ships year-end) MUST use IRIS XML A2A. FIRE is legacy/fallback only. A NEW IRIS TCC is required (~45-day lead; FIRE TCC does not carry over) — start enrollment in the foundation phase | Research SUMMARY (resolves backlog research-gate #5, which had FIRE/IRIS inverted) |
| **1099-NEC/MISC threshold** | **$2,000** for payments after 2025-12-31 (OBBBA) — stored as a config table keyed by tax year, NOT a constant. Backlog US-FORM-04 "$600" is stale | Research SUMMARY (FEATURES correction) |
| **1099-K threshold** | **$20,000 + 200 transactions** (OBBBA reverted the $600/$5K phase-in). Backlog US-CLASS-03 "$5K/$600" is stale | Research SUMMARY (FEATURES correction) |
| Same-Day ACH ceiling | $1M until 2027-09-17 → Fedwire (US-PAY-04) genuinely needed for high-value cross-border payouts | Research SUMMARY |
| Personio API | API v2, 200 req/min/credential, attribute-scoped, proprietary client-credentials bearer, offset/limit (max 200) pagination, no Node SDK → direct REST adapter on the v2.0 integration framework | Research SUMMARY (resolves backlog research-gate #7) |
| BambooHR API | No Node SDK (PHP/Python only), OAuth 2.0 mandatory → direct REST adapter; custom-attribute contract NOT yet verified — gate before `HRIS-SYNC-04` plan-phase | Research SUMMARY |
| API-key storage | HMAC-SHA256 (repo already uses this for high-entropy keys via `OrganizationApiKey`) — supersedes backlog INTEG-AUTH-01 "bcrypt" wording | Research SUMMARY / ARCHITECTURE |
| e-ZLA / eAU / HMRC RTI | LEAVE-04 (PL e-ZLA), LEAVE-05 (DE eAU), PAYROLL-UK-02 (HMRC RTI) deferred to v7.5; v7.0 ships manual entry / export-only | Backlog locked-decision #6 |
| Legal sign-off posture | LOCAL-ONLY deploy; legal sign-off DEFERRED. US tax-form copy, akta-osobowe/Personalakte retention text, per-market statutory paperwork ship working code with "needs jurisdiction legal/tax adviser verification" annotations | Standing Project Constraints |
| Quality > scope | If a sub-feature would cut corners on jurisdiction compliance, defer it to v7.5/v8.0 rather than ship half-done | Standing Project Constraints |

## v7.0 Requirements

Requirements for the v7.0 milestone. Each maps to exactly one phase (filled by roadmapper). Continues REQ-ID numbering with fresh v7.0 category prefixes.

### Foundation (cross-cutting — gates revenue + US data work)

- [x] **FOUND7-01**: Engineer has a `requireAddOn(addOn)` tRPC middleware that composes after `requireTier`, returns a structured `ADD_ON_REQUIRED` error (mirroring the existing `TIER_REQUIRED` shape) when an org lacks the add-on, and reads add-on entitlement from a defined store (`Subscription.addOns` or normalized `OrgAddOn`); gates `Workforce` (Theme B) and `US Cross-Border` (Theme A) surfaces
- [x] **FOUND7-02**: All v7.0 Unleash flags are registered PENDING in the signoff registry with boot-time gate — `us-expansion`, `workforce-employees`, `personio-sync`, `bamboohr-sync`, `ach-payouts`, `iris-efile`, `public-api`, `outbound-webhooks`, `integration-marketplace-{zapier,n8n,make}`, and per-adapter `payroll-{symfonia,comarch,enova,datev,sage-uk,gusto,quickbooks,adp}`
- [x] **FOUND7-03**: `us-east-1` is enabled as a third supported region across the stack — `SUPPORTED_REGIONS`, `DataRegion` enum, `DATABASE_URL_US` env (+ schema), and `feature-flag.ts` region coercion all accept `US` without runtime throw (the 4-place atomic change; precedes any US-data phase)

### Theme A — US Cross-Border: Tax-Form Intake (US-FORM)

- [x] **US-FORM-01**: US-resident contractor completes a W-9 collection wizard (TIN + entity type + backup-withholding flag), stored against `Contractor`/`Worker` with audit trail
- [x] **US-FORM-02**: Foreign contractor of a US client completes a W-8BEN / W-8BEN-E wizard (treaty country + treaty article picker, FTIN, certifications)
- [x] **US-FORM-03**: System integrates IRS TIN-Matching (e-Services) with 24h cache, retry, and admin escalation on mismatch
- [x] **US-FORM-04**: System generates 1099-NEC per recipient at year-end with a **tax-year-keyed threshold config table ($2,000 for TY2026 per OBBBA)**, CORRECTED-form support, recipient PDF copy, and audit-immutable archive
- [ ] **US-FORM-05**: System e-files year-end returns via **IRS IRIS (XML A2A, primary/mandatory path)** with TCC-enrollment workflow doc, automated file build, transmit, and acknowledgement parsing; FIRE retained only as a documented legacy fallback
- [ ] **US-FORM-06**: System generates 1042-S for US-source payments to foreign contractors (withholding rate sourced from the treaty table) with recipient PDF + IRS file
- [ ] **US-FORM-07**: System handles per-state 1099 filing for the states that require separate filing (Combined Federal/State Filing Program participation where eligible)

### Theme A — US Payment Rail (US-PAY)

- [ ] **US-PAY-01**: System generates an ACH NACHA file (PPD/CCD/CTX entry types) as a new format in the existing payment-export factory (same shape as BACS/SWIFT/Elixir/SEPA)
- [ ] **US-PAY-02**: USD is a first-class currency with per-org default, exchange-rate sourcing, and settlement-currency choice on cross-border payouts
- [ ] **US-PAY-03**: System initiates programmatic ACH payouts via a Modern Treasury / Stripe Treasury adapter (opt-in, on the v2.0 integration framework)
- [ ] **US-PAY-04**: System exports a Fedwire wire-transfer format for high-value cross-border payouts above the Same-Day ACH ceiling
- [ ] **US-PAY-05**: System verifies US contractor bank accounts at onboarding via Plaid Identity (anti-fraud; reuses the OAuth-credential-store pattern)

### Theme A — US Classification + State Nuance (US-CLASS)

- [ ] **US-CLASS-01**: Classification engine gains a US rule set (federal common-law / economic-realities test, CA ABC test / AB5, §530 safe-harbor flagger)
- [ ] **US-CLASS-02**: California AB5 watchlist flags CA-worker engagements and applies the stricter ABC test by default, with audit-logged admin override
- [ ] **US-CLASS-03**: 1099-K threshold tracker (informational) surfaces on the contractor profile as cumulative payouts approach the **$20,000 + 200-transaction** threshold
- [ ] **US-CLASS-04**: System generates a "Classification Determination Letter" PDF (mirrors the UK SDS generator from v5.0)

### Theme A — US Contractor Profile Fields (US-FIELD)

- [x] **US-FIELD-01**: EIN validator (XX-XXXXXXX format + IRS-published prefix table)
- [x] **US-FIELD-02**: SSN intake with PII-grade masking (last-4 default; full display behind RBAC `CONTRACTOR_PII:READ`)
- [x] **US-FIELD-03**: US address validation via USPS Addresses API (CASS-certified format)
- [x] **US-FIELD-04**: US contractor profile component dispatched from the existing `CountryComplianceSection` pattern

### Theme A — US Locale + Tax-Treaty Engine (US-LOC)

- [x] **US-LOC-01**: `en-US` locale at full key parity vs `en` (date/currency/measure formatting; American-English copy where it diverges from en-GB)
- [x] **US-LOC-02**: US tax-treaty rate table (PL/DE/UK/UAE/KSA/IE/NL) auto-applied when contractor + payer jurisdictions trigger a treaty (extends the v5.0 reverse-charge engine pattern)
- [x] **US-LOC-03**: W-8BEN treaty-article auto-populate based on contractor home jurisdiction + treaty table

### Theme A — US Region Infrastructure (US-INFRA)

- [x] **US-INFRA-01**: A new org with US billing is routed to the `us-east-1` database per the existing per-org region-routing pattern; cross-region read replicas remain off by default
- [x] **US-INFRA-02**: US-specific R2 storage bucket for tax-form archives (data-residency for US tax records)
- [x] **US-INFRA-03**: IRS-mandated retention enforced via soft-delete + scheduled archive (4-year 1099-NEC, 7-year backup-withholding records)

### Theme B — Worker Model Abstraction (WORKER) — foundation, ships first

- [x] **WORKER-01**: `Worker` discriminated-union (Contractor | Employee) on a dedicated `Worker` base table that `Contractor` and `Employee` link to, with `workerType` defaulting to `CONTRACTOR`. *(Amended 2026-06-18, Phase 89 discuss: the original "zero data migration / extend Contractor in place" phrasing is superseded — the chosen normalization requires a ONE-TIME, additive, idempotent, per-region, reversible backfill of a `Worker` row per existing v1–v6 contractor. No contractor row is destroyed or relinked lossily; contractor-path parity must be verified on a staging snapshot of the largest org before the backfill is accepted. See `89-CONTEXT.md` D-01.)* **DONE 2026-06-22 (Contractor side):** Migration A + backfill (1040 contractors → 1040 Workers, 1:1, verified, parity GREEN) + all `contractor.create` paths wired to create+link a Worker + Migration B (NOT NULL + FK) applied on the EU Neon DB. The Employee side of the union lands with Phase 90 (EMP-REG). Router split / RBAC / flag = WORKER-02..05 (89-04/05/06, not yet executed).
- [x] **WORKER-02**: tRPC namespace split — shared `workerRouter` + existing `contractorRouter` (route shapes preserved) + new `employeeRouter`
- [x] **WORKER-03**: RLS / tenant-isolation extension — `organizationId` invariant preserved on `Worker`; HR-only fields gated by per-type RBAC
- [x] **WORKER-04**: New roles `HR_ADMIN`, `HR_MANAGER`, `PAYROLL_OFFICER`, `LEAVE_APPROVER` (existing 8 roles unchanged)
- [x] **WORKER-05**: Feature flag `workforce-employees` gates all Theme B routes; flag-off = render-tree removal + tRPC FORBIDDEN (v5.0 classification flag-off pattern)

### Theme B — Employee Registry per Market (EMP-REG)

- [ ] **EMP-REG-PL-01**: PL employee fields — PESEL (mod-11 + dob check), urząd skarbowy ID, ZUS oddział ID, stanowisko, wymiar etatu (0.10–1.00), stawka brutto, ZUS title code, NFZ oddział
- [ ] **EMP-REG-DE-01**: DE employee fields — Steuer-IdNr (11-digit mod-11), Sozialversicherungsnummer (v5.0 validator), Krankenkasse ID, Lohnsteuerklasse (I–VI), Kinderfreibetrag, Kirchensteuer flag, ELStAM lookup hook
- [ ] **EMP-REG-UK-01**: UK employee fields — NI number (format + DWP exclusion ranges), PAYE reference, tax code (1257L pattern + emergency/W1/M1/K flags), student-loan plan, pension auto-enrol flag
- [ ] **EMP-REG-US-01**: US employee fields — SSN (PII-masked per US-FIELD-02), W-4 step-1c filing status, state withholding (10 highest-population states + free-text fallback)
- [ ] **EMP-REG-AE-01**: UAE employee fields — Emirates ID + visa type + WPS Establishment ID
- [ ] **EMP-REG-SA-01**: KSA employee fields — Iqama / National ID, GOSI registration number, Saudization category contribution flag

### Theme B — Akta Osobowe / Personnel File (AKTA)

- [ ] **AKTA-01**: 4-section personnel file (PL cz. A/B/C/D per KP §94; equivalent DE Personalakte, UK personnel file, US I-9 + file) with per-section RBAC
- [ ] **AKTA-02**: Per-jurisdiction retention engine — PL 10-yr (post-2019) / 50-yr legacy, DE 10-yr tax / 30-yr accident, UK 6-yr general / 7-yr financial, US I-9 3-yr-post-hire-or-1-yr-post-termination
- [ ] **AKTA-03**: GDPR / RODO erasure-request handler with statutory-retention exemption layer (honors erasure only past the retention window; flags blocked sections with statutory citation)
- [ ] **AKTA-04**: Document classification at upload — assigns section A/B/C/D via doc-type taxonomy; ambiguous docs trigger an admin classify-step

### Theme B — Leave Management (LEAVE)

- [x] **LEAVE-01**: Leave-balance engine per market — PL 20/26-day rule, DE BUrlG minimum + per-contract overrides, UK 5.6-week statutory, US per-state, UAE/SA per-MOL/MHRSD
- [x] **LEAVE-02**: Leave-request workflow on the v1.0 approval-chain engine — per-org leave types (vacation/sick/parental/bereavement/study/etc.), blackout periods, manual sick-leave entry (e-ZLA/eAU auto-pull deferred to v7.5)
- [x] **LEAVE-03**: Team calendar — month/quarter view, capacity heatmap, conflict warnings on overlapping same-team requests

### Theme B — KP-Grade Time Tracking (TIME-EMP)

- [x] **TIME-EMP-01**: Employee time tracking distinct from v2.0 B2B time — captures overtime (PL 50/100%, DE §3 ArbZG ceiling, UK WTR opt-out flag), night-shift premium, weekend/holiday work
- [x] **TIME-EMP-02**: Per-jurisdiction working-time-limit alerts (PL 8h/day 48h/week, DE ArbZG, UK 48h WTR opt-out, US FLSA OT >40h/week non-exempt)
- [x] **TIME-EMP-03**: PL "ewidencja czasu pracy" report per KP §149 with 3-year audit-immutable archive

### Theme B — Employee Onboarding / Offboarding (EMP-ON / EMP-OFF)

- [ ] **EMP-ON-01**: Per-market onboarding workflow templates — PL (badania wstępne, PIT-2, PPK auto-zapis, świadectwo, IKE/IKZE), DE (Personalfragebogen, Steuer-ID lookup, SV-Ausweis, bAV), UK (P45/P46, RTI flag, pension auto-enrol), US (W-4, I-9 + E-Verify hook, state W-4, direct-deposit)
- [ ] **EMP-OFF-01**: Per-market offboarding workflow — PL (świadectwo pracy, ekwiwalent za urlop, ZUS ZWUA, PIT-11), DE (Arbeitszeugnis qualified/simple, Abmeldung SV, Lohnsteuerbescheinigung), UK (P45, final RTI, pension, P11D), US (final paycheck per state, COBRA, W-2, 401(k))
- [ ] **EMP-OFF-02**: Employee offboarding composes with v6.0 F4 offboarding hardening (IP verification, KT templates, IdP deprovisioning) — extends rather than duplicates

### Theme B — Payroll Integration Adapters (PAYROLL — export/integration only, NOT own engine)

- [ ] **PAYROLL-PL-01**: Symfonia Kadry i Płace export adapter (CSV + XML)
- [ ] **PAYROLL-PL-02**: Comarch ERP XL / Optima export adapter
- [ ] **PAYROLL-PL-03**: Enova365 export adapter
- [ ] **PAYROLL-DE-01**: DATEV Lohn und Gehalt export adapter (ASCII import format + DATEVconnect REST where subscribed)
- [ ] **PAYROLL-DE-02**: Sage HR / Personalwirtschaft export adapter
- [ ] **PAYROLL-UK-01**: Sage Payroll / BrightPay / Moneysoft export adapters (RTI-compatible FPS/EPS XML)
- [ ] **PAYROLL-US-01**: Gusto + QuickBooks Payroll + ADP export adapters (CSV mappings + native API where available)

### Theme B — HRIS Two-Way Sync (HRIS-SYNC)

- [ ] **HRIS-SYNC-01**: Personio adapter on the v2.0 integration framework (proprietary client-credentials bearer, API v2, 200 req/min, offset pagination)
- [ ] **HRIS-SYNC-02**: Personio → Contractor Ops one-way pull (people, contracts, departments, custom attributes) on hourly cron + on-demand
- [ ] **HRIS-SYNC-03**: Contractor Ops → Personio one-way push (invoice-paid, payment status, classification outcome) on event
- [ ] **HRIS-SYNC-04**: BambooHR adapter (OAuth 2.0, REST; same shape as Personio)
- [ ] **HRIS-SYNC-05**: Conflict-resolution policy — HRIS is source of truth for registry fields (name/contact/position); Contractor Ops is source of truth for invoice/payment/compliance fields; on conflict, registry updates from HRIS while financial/compliance fields lock against HRIS overwrite
- [ ] **HRIS-SYNC-06**: Per-org single-adapter choice (Personio OR BambooHR, not both — prevents three-way sync hell)

### Theme B — Employee Self-Service Portal (EMP-PORTAL)

- [ ] **EMP-PORTAL-01**: Employee portal extends the v2.0 contractor portal (magic-link auth, subdomain routing, additional `/employee/*` routes)
- [ ] **EMP-PORTAL-02**: Employee dashboard — pay stubs (from payroll integration where available), leave balance, time-off request, document upload, personal akta view
- [ ] **EMP-PORTAL-03**: Manager dashboard — direct reports' leave requests, time entries to approve, document-expiry flags
- [ ] **EMP-PORTAL-04**: Portal i18n parity — en/pl/de/ar/en-US (Arabic RTL from v4.0, formal-Sie register from v5.0)

### Theme B — HR Dashboard (HR-DASH)

- [ ] **HR-DASH-01**: Headcount widget — total / by department / by jurisdiction / by employment-type / by contract-end date
- [ ] **HR-DASH-02**: Vacation-utilization widget — cumulative days taken vs entitled per worker; flags under-utilization (>10 days unused approaching year-end)
- [ ] **HR-DASH-03**: Document-expiry widget (visa, work-permit, contract renewal, medical-cert, training-cert) composing with the v6.0 F1 compliance-document engine
- [ ] **HR-DASH-04**: Probation-end watchlist — auto-surface workers within 14/7/0 days of probation end
- [ ] **HR-DASH-05**: Saudization / Emiratisation rollup composing with v6.0 F3 Gulf operational polish

### Theme C — Public REST API Surface (INTEG-API)

- [x] **INTEG-API-01**: `apps/public-api` (Hono) gains read+write endpoints for contractors / invoices / payments / payment_runs / workflows / workflow_tasks / classifications / compliance_documents / audit_log — Zod input validation on every endpoint, tenant-scoped via API key, `.strict()` DTOs to block mass-assignment of `organizationId`/`workerType`/money fields
- [x] **INTEG-API-02**: OpenAPI 3.1 spec auto-generated from Zod schemas (`@hono/zod-openapi`), published to a Scalar developer portal
- [x] **INTEG-API-03**: API versioning policy — `/v1/*` base path, `Sunset` header per RFC 8594, breaking changes only on major-version bump
- [x] **INTEG-API-04**: Cursor-based pagination + standardized `?filter[field]=` / `?sort=` conventions across all list endpoints
- [x] **INTEG-API-05**: Auto-generated TypeScript + Python SDKs (from OpenAPI) published to npm + PyPI as `@contractor-ops/sdk` / `contractor-ops-sdk`

### Theme C — API Key Management + Scopes (INTEG-AUTH)

- [ ] **INTEG-AUTH-01**: `ApiKey`/`OrganizationApiKey` model — org-scoped, named labels, creation/rotation/revocation audit, **HMAC-SHA256 hashed storage** (high-entropy keys; repo convention), `co_live_xxx` prefix display
- [ ] **INTEG-AUTH-02**: Per-key scopes (`contractors:read|write`, `invoices:read|write`, `payments:read|write`, `webhooks:manage`, `classifications:read`, `compliance:read`, `audit:read`) enforced **per-endpoint** (closes the current `apiKeyTenantProcedure` no-per-scope-check BFLA gap); least-privilege default; UI scope picker
- [ ] **INTEG-AUTH-03**: Settings → Developer page — key CRUD UI, last-used-at, source-IP log, scope visualization, rotation flow with grace period
- [ ] **INTEG-AUTH-04**: Per-key rate limiting via Redis (Upstash) token bucket; per-tier limits (Starter 1k req/mo + 1 webhook sub, Pro 10k + 5, Enterprise unlimited/custom)
- [ ] **INTEG-AUTH-05**: Every external mutation audit-logged with `apiKeyId` + `sourceIp` + `userAgent` (composes with v3.0 `writeAuditLog`)

### Theme C — Outbound Webhook Subscriptions (INTEG-WEBHOOK)

- [ ] **INTEG-WEBHOOK-01**: `WebhookSubscription` model — per-org, per-event-filter, target URL, HMAC secret, retry policy, enabled flag, last-success/failure timestamps
- [ ] **INTEG-WEBHOOK-02**: Event catalog — `contractor.{created,updated,offboarded,compliance_blocked}`, `invoice.{received,matched,approved,rejected,paid}`, `payment_run.{created,completed}`, `workflow.{task.completed,completed}`, `classification.outcome`, `compliance_doc.{expiring_soon,expired}` (composes with v6.0 F1 band-state-machine); Zod-typed discriminated-union payloads
- [ ] **INTEG-WEBHOOK-03**: Greenfield outbound dispatcher on the existing `OutboxEvent` transactional outbox + QStash — exponential backoff (1m/5m/30m/2h/12h/24h), max 6 retries, DLQ to `webhook_failures`, admin alert at 5 failures/1h (distinct from the inbound `webhook-dispatcher.ts`)
- [ ] **INTEG-WEBHOOK-04**: HMAC-SHA256 signature header `X-CO-Signature = t={unix_ms},v1={hex_hmac}` (Stripe convention), per-subscription secret
- [ ] **INTEG-WEBHOOK-05**: Replay protection — signed timestamp + 5-minute acceptance window; sample verifier in TS/Python/Go/PHP in docs
- [ ] **INTEG-WEBHOOK-06**: Subscription management API + UI (Settings → Developer → Webhooks) with test-fire button + last-100-deliveries log
- [ ] **INTEG-WEBHOOK-07**: Per-subscription PII redaction opt-in (`include_pii: false` default) — strips PESEL/SSN/NI/Steuer-IdNr/Emirates ID/Iqama/email/phone unless set (RODO-defensible)

### Theme C — Integration Security (INTEG-SEC)

- [ ] **INTEG-SEC-01**: SSRF guard on outbound webhook target URLs — reject private ranges (RFC 1918, loopback, link-local, AWS metadata `169.254.169.254`, cloud equivalents) at BOTH subscribe time AND dispatch time, with DNS-rebind protection (re-resolve + IP-pin immediately before connect; redirects disabled) via `request-filtering-agent`
- [ ] **INTEG-SEC-02**: HTTPS-only target URLs by default (HTTP only via per-org admin override + warning banner)
- [ ] **INTEG-SEC-03**: Per-org webhook dispatch rate limit (100 events/min per subscription) — anti-fanout-DDoS
- [ ] **INTEG-SEC-04**: OWASP API Security Top 10 review checklist as a phase gate (BOLA, BFLA, SSRF, mass-assignment, security-misconfig, injection)
- [ ] **INTEG-SEC-05**: API-key leak alarm — alert org admins if a key shows usage from >3 distinct source IPs in 24h

### Theme C — Marketplace Listings (INTEG-ZAPIER / N8N / MAKE / MARKETPLACE)

- [ ] **INTEG-ZAPIER-01**: Zapier app — auth (API key or OAuth 2.0), 8+ triggers (event-catalog-mapped), 6+ actions (create contractor/invoice, approve invoice, mark payment paid, create workflow task, lookup contractor by tax ID); Zapier-sandbox bundle test
- [ ] **INTEG-ZAPIER-02**: Zapier public-listing submission + review iteration (2–4 week cycle tracked as a separate milestone)
- [ ] **INTEG-N8N-01**: n8n community node package `@contractor-ops/n8n-nodes` published to npm; nodes mirror the Zapier trigger/action surface; installable via n8n community-nodes UI
- [ ] **INTEG-N8N-02**: n8n docs page + example workflows (invoice→Slack, contractor-onboard-from-Personio, compliance-expiry→PagerDuty)
- [ ] **INTEG-MAKE-01**: Make.com app submission to the Make App Directory (same trigger/action surface as Zapier)
- [ ] **INTEG-MARKETPLACE-01**: Internal listing-status dashboard — track all three marketplace approval states, version pins, last review feedback

### Theme C — Developer Experience (INTEG-DX)

- [ ] **INTEG-DX-01**: Developer portal (`developers.contractor-ops.{tld}`, Scalar) — OpenAPI reference, webhook event catalog, SDK install guides, sample apps (Zapier/n8n/Make recipes), changelog, deprecation notices
- [ ] **INTEG-DX-02**: Postman collection (auto-generated from OpenAPI) + downloadable Insomnia workspace
- [ ] **INTEG-DX-03**: Public status page (`status.contractor-ops.{tld}`) — API + webhook-dispatcher uptime + incident history (reuse v2.0 health-monitoring pattern)
- [ ] **INTEG-DX-04**: Sandbox environment + free-forever public-API tier (100 req/day, no real data writes — auto-seed fresh test org per developer signup)

## Future Requirements (deferred — v7.5 / v8.0)

Acknowledged but explicitly NOT in the v7.0 roadmap (per backlog locked decisions). v7.0 ships manual entry / export-only / curated-subset for each, so functional coverage is not gated on these.

### v7.5

- **LEAVE-04**: PL ZUS e-ZLA auto-pull (sick-leave + payroll-integration push) — requires per-org Profil Zaufany / certyfikat kwalifikowany agreement. v7.0 ships manual sick-leave entry (LEAVE-02).
- **LEAVE-05**: DE Krankenkasse eAU digital sick-note pull via TI-Messenger / KIM — requires KIM-Adresse per Arztpraxis. v7.0 ships manual entry (LEAVE-02).
- **PAYROLL-UK-02**: HMRC RTI direct submission (Government Gateway OAuth) — FPS/EPS/year-end/P11D/P60 complexity warrants its own slice. v7.0 ships export-only (PAYROLL-UK-01).
- **EMP-REG-US-01 expansion**: Full 50-state US withholding matrix — v7.0 ships 10 states + free-text fallback.

### v8.0+

- **PAYROLL-US extension**: Workday / Paychex / Rippling-payroll adapters — on customer pull. v7.0 ships Gusto + QuickBooks + ADP only.
- Own payroll engine (PL/DE/UK/US) — only if integration friction proves dispositive.
- OAuth 2.0 provider mode (Contractor Ops as OAuth provider) — if marketplace partners require it.
- Inbound user-defined webhook ingestion — Theme C is outbound-only; inbound reserved for vetted partners (KSeF, InPost, Storecove).

## Out of Scope

Explicitly excluded for v7.0. Documented to prevent scope creep.

| Feature | Reason |
|---|---|
| Own payroll engine (PL/DE/UK/US) | Commodity territory — Symfonia/DATEV/Sage/Gusto have 10–25 yr leads. Adapters only. |
| US head-on Bill.com competitor (US-domestic AP automation) | Wrong battle — v7.0 is explicitly cross-border-first. |
| EOR / AOR in any market | Out of charter — Deel/Remote territory; local contractors only. |
| ATS / recruiting pipeline | Personio territory; out of charter. |
| Performance reviews / OKR / 1:1s | Lattice/15Five/Personio territory. |
| Benefits enrollment (Multisport/Medicover/Multikafeteria) | Adapter only in v8.0+ if customer ask; never own marketplace. |
| Mobile-native app | Web-first; responsive only. |
| Bi-directional Personio/BambooHR field-level merge | Source-of-truth split per HRIS-SYNC-05; arbitrary merge drains scope. |
| US payroll tax filing (940/941 + state) | Gusto/QuickBooks territory — we push data, they file. |
| State-level US sales-tax nexus for platform fees | Org's accountant handles on platform-fee invoice basis. |
| HMRC RTI direct submission | Deferred to v7.5. |
| PL ZUS e-ZLA / DE eAU auto-pull | Deferred to v7.5 (per-org cert / KIM-Adresse friction). |
| Full 50-state US withholding matrix | v7.0 = 10 states + free-text; rest deferred. |
| Workday / Paychex / Rippling-payroll adapters | v7.0 = Gusto + QuickBooks + ADP; rest deferred to v8.0+. |
| Long-tail per-app native adapters | Served via Theme C marketplace listings (~9,000 apps); no new bespoke native adapters unless customer-paid. |
| Inbound user-defined webhook ingestion | Theme C is outbound-only; inbound → v8.0+ (vetted partners only today). |
| OAuth 2.0 server (we as OAuth provider) | API-key auth only in v7.0; provider mode → v8.0+. |

## Traceability

Which phases cover which requirements. Phase numbering continues from v6.0 (ended at Phase 81); v7.0 spans Phases 82–101.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND7-01 | Phase 82 | Complete |
| FOUND7-02 | Phase 82 | Complete |
| FOUND7-03 | Phase 82 | Complete |
| US-INFRA-01 | Phase 83 | Complete |
| US-INFRA-02 | Phase 83 | Complete |
| US-INFRA-03 | Phase 83 | Complete |
| US-FIELD-01 | Phase 84 | Complete |
| US-FIELD-02 | Phase 84 | Complete |
| US-FIELD-03 | Phase 84 | Complete |
| US-FIELD-04 | Phase 84 | Complete |
| US-LOC-01 | Phase 84 | Complete |
| US-FORM-01 | Phase 85 | Complete |
| US-FORM-02 | Phase 85 | Complete |
| US-LOC-02 | Phase 85 | Complete |
| US-LOC-03 | Phase 85 | Complete |
| US-FORM-03 | Phase 86 | Complete |
| US-FORM-04 | Phase 86 | Complete |
| US-FORM-05 | Phase 86 | Pending |
| US-FORM-07 | Phase 86 | Pending |
| US-FORM-06 | Phase 87 | Pending |
| US-CLASS-01 | Phase 87 | Pending |
| US-CLASS-02 | Phase 87 | Pending |
| US-CLASS-03 | Phase 87 | Pending |
| US-CLASS-04 | Phase 87 | Pending |
| US-PAY-01 | Phase 88 | Pending |
| US-PAY-02 | Phase 88 | Pending |
| US-PAY-03 | Phase 88 | Pending |
| US-PAY-04 | Phase 88 | Pending |
| US-PAY-05 | Phase 88 | Pending |
| WORKER-01 | Phase 89 | Complete |
| WORKER-02 | Phase 89 | Complete |
| WORKER-03 | Phase 89 | Complete |
| WORKER-04 | Phase 89 | Complete |
| WORKER-05 | Phase 89 | Complete |
| EMP-REG-PL-01 | Phase 90 | Pending |
| EMP-REG-DE-01 | Phase 90 | Pending |
| EMP-REG-UK-01 | Phase 90 | Pending |
| EMP-REG-US-01 | Phase 90 | Pending |
| EMP-REG-AE-01 | Phase 90 | Pending |
| EMP-REG-SA-01 | Phase 90 | Pending |
| AKTA-01 | Phase 91 | Pending |
| AKTA-02 | Phase 91 | Pending |
| AKTA-03 | Phase 91 | Pending |
| AKTA-04 | Phase 91 | Pending |
| LEAVE-01 | Phase 92 | Complete |
| LEAVE-02 | Phase 92 | Complete |
| LEAVE-03 | Phase 92 | Complete |
| TIME-EMP-01 | Phase 92 | Complete |
| TIME-EMP-02 | Phase 92 | Complete |
| TIME-EMP-03 | Phase 92 | Complete |
| EMP-ON-01 | Phase 93 | Pending |
| EMP-OFF-01 | Phase 93 | Pending |
| EMP-OFF-02 | Phase 93 | Pending |
| PAYROLL-PL-01 | Phase 94 | Pending |
| PAYROLL-PL-02 | Phase 94 | Pending |
| PAYROLL-PL-03 | Phase 94 | Pending |
| PAYROLL-DE-01 | Phase 94 | Pending |
| PAYROLL-DE-02 | Phase 94 | Pending |
| PAYROLL-UK-01 | Phase 94 | Pending |
| PAYROLL-US-01 | Phase 94 | Pending |
| HRIS-SYNC-01 | Phase 95 | Pending |
| HRIS-SYNC-02 | Phase 95 | Pending |
| HRIS-SYNC-03 | Phase 95 | Pending |
| HRIS-SYNC-04 | Phase 95 | Pending |
| HRIS-SYNC-05 | Phase 95 | Pending |
| HRIS-SYNC-06 | Phase 95 | Pending |
| EMP-PORTAL-01 | Phase 96 | Pending |
| EMP-PORTAL-02 | Phase 96 | Pending |
| EMP-PORTAL-03 | Phase 96 | Pending |
| EMP-PORTAL-04 | Phase 96 | Pending |
| HR-DASH-01 | Phase 97 | Pending |
| HR-DASH-02 | Phase 97 | Pending |
| HR-DASH-03 | Phase 97 | Pending |
| HR-DASH-04 | Phase 97 | Pending |
| HR-DASH-05 | Phase 97 | Pending |
| INTEG-API-01 | Phase 98 | Complete |
| INTEG-API-02 | Phase 98 | Complete |
| INTEG-API-03 | Phase 98 | Complete |
| INTEG-API-04 | Phase 98 | Complete |
| INTEG-API-05 | Phase 98 | Complete |
| INTEG-AUTH-01 | Phase 99 | Pending |
| INTEG-AUTH-02 | Phase 99 | Pending |
| INTEG-AUTH-03 | Phase 99 | Pending |
| INTEG-AUTH-04 | Phase 99 | Pending |
| INTEG-AUTH-05 | Phase 99 | Pending |
| INTEG-WEBHOOK-01 | Phase 100 | Pending |
| INTEG-WEBHOOK-02 | Phase 100 | Pending |
| INTEG-WEBHOOK-03 | Phase 100 | Pending |
| INTEG-WEBHOOK-04 | Phase 100 | Pending |
| INTEG-WEBHOOK-05 | Phase 100 | Pending |
| INTEG-WEBHOOK-06 | Phase 100 | Pending |
| INTEG-WEBHOOK-07 | Phase 100 | Pending |
| INTEG-SEC-01 | Phase 100 | Pending |
| INTEG-SEC-02 | Phase 100 | Pending |
| INTEG-SEC-03 | Phase 100 | Pending |
| INTEG-SEC-04 | Phase 100 | Pending |
| INTEG-SEC-05 | Phase 100 | Pending |
| INTEG-ZAPIER-01 | Phase 101 | Pending |
| INTEG-ZAPIER-02 | Phase 101 | Pending |
| INTEG-N8N-01 | Phase 101 | Pending |
| INTEG-N8N-02 | Phase 101 | Pending |
| INTEG-MAKE-01 | Phase 101 | Pending |
| INTEG-MARKETPLACE-01 | Phase 101 | Pending |
| INTEG-DX-01 | Phase 101 | Pending |
| INTEG-DX-02 | Phase 101 | Pending |
| INTEG-DX-03 | Phase 101 | Pending |
| INTEG-DX-04 | Phase 101 | Pending |

**Coverage:**
- v7.0 requirements: **107 total** (3 FOUND7 + Theme A 26 + Theme B 46 + Theme C 32)
  - Theme A: US-FORM 7 + US-PAY 5 + US-CLASS 4 + US-FIELD 4 + US-LOC 3 + US-INFRA 3 = 26
  - Theme B: WORKER 5 + EMP-REG 6 + AKTA 4 + LEAVE 3 + TIME-EMP 3 + EMP-ON/OFF 3 + PAYROLL 7 + HRIS-SYNC 6 + EMP-PORTAL 4 + HR-DASH 5 = 46
  - Theme C: INTEG-API 5 + INTEG-AUTH 5 + INTEG-WEBHOOK 7 + INTEG-SEC 5 + marketplace 6 + INTEG-DX 4 = 32
- Mapped to phases: **107** ✓ (all v7.0 requirements assigned to exactly one phase across Phases 82–101)
- Unmapped: **0** ✓

**Per-phase requirement counts (verification):**
- Phase 82 (3) + 83 (3) + 84 (5) + 85 (4) + 86 (4) + 87 (5) + 88 (5) = 29 → FOUND7 (3) + Theme A (26) ✓
- Phase 89 (5) + 90 (6) + 91 (4) + 92 (6) + 93 (3) + 94 (7) + 95 (6) + 96 (4) + 97 (5) = 46 → Theme B ✓
- Phase 98 (5) + 99 (5) + 100 (12) + 101 (10) = 32 → Theme C ✓
- Total: 29 + 46 + 32 = **107** ✓

---
*Requirements defined: 2026-06-07*
*Last updated: 2026-06-07 — roadmapper mapped all 107 requirements to Phases 82–101 (v7.0 roadmap created)*
