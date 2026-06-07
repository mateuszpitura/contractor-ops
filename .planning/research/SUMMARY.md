# Project Research Summary

**Project:** contractor-ops v7.0 GTM Expansion
**Domain:** B2B contractor/workforce ops — US cross-border tax+payments (Theme A), workforce management/HRIS sync (Theme B), public REST API + webhook marketplace (Theme C)
**Researched:** 2026-06-07
**Confidence:** HIGH (architecture seams verified in-tree; IRS regulatory findings corroborated by multiple independent sources; HRIS API facts verified against official developer docs)

## Executive Summary

v7.0 is a net-new surface expansion on a mature, GA-quality platform. The strategic bet is three simultaneous wedges: owning the cross-border corridor that Deel prices out of reach and Bill.com ignores (EU/Gulf compliance); becoming "one tool for your whole workforce" by landing an employee-management layer that keeps Contractor Ops from being sidelined as "the invoice tool next to Personio"; and flipping the integration-reach narrative by reaching ~9,000 apps via three marketplace listings on one backend. All three gaps block credible GA positioning.

The recommended approach exploits the platform's existing abstractions instead of reinventing them. Theme A ACH NACHA is a new format in the payment-export factory (not a new module). Personio/BambooHR/Gusto/ADP are new BaseAdapters in the integration framework's existing credential store + OAuth + health-monitor stack. Outbound webhooks are a new dispatcher consuming the existing transactional OutboxEvent outbox. The Worker/Employee discriminated union is an additive `workerType` column on the existing Contractor table. The public REST API write surface extends the existing Hono `apps/public-api`. This reuse posture keeps the implementation surface small enough for solo-dev-with-AI throughput.

Three research findings overturn backlog assumptions and are load-bearing for correctness. First, IRS FIRE decommissions 2026-12-31 with no grace period — the backlog's "FIRE primary, IRIS fallback" framing in US-FORM-05 is inverted; IRIS XML must be primary for TY2026 and the IRIS-specific TCC application (45-day lead) must begin in the foundation phase. Second, the 1099-NEC/MISC threshold is $2,000 for payments after 2025-12-31 per OBBBA — the backlog's "$600" constant in US-FORM-04 is stale and must become a config table (not a hardcoded constant) carrying the $2,000 TY2026 amount, legacy $600 for pre-2026 corrections, and the indexed update mechanism. Third, the 1099-K threshold reverted to $20,000 + 200 transactions — the backlog's "$5K for 2026, then $600" tracker in US-CLASS-03 is stale. These three corrections must flow into requirements and every affected phase plan before work begins.

## Key Findings

### Recommended Stack

v7.0 adds no new framework or app. Every new surface slots into an existing host. The public API lives in `apps/public-api` (Hono); webhook dispatch in `apps/cron-worker` via QStash + OutboxEvent; adapters in `packages/integrations`; IRS gov-api in a `packages/gov-api`-style framework; UI in `apps/web-vite` under the Page→Container→Hook→Component contract.

**Core new libraries (all passing 7-day release-age as of 2026-06-07):**
- `modern-treasury@4.15.0` — programmatic ACH/wire orchestration for orgs with own bank (alt to Stripe Treasury behind a shared `UsPayoutProvider` adapter)
- `plaid@42.2.0` — US bank-account link + Identity verification at contractor onboarding (anti-fraud; AES-256-GCM token store reuses existing pattern)
- `@midlandsbank/node-nacha@2.1.1` — NACHA ACH file formatter inside payment-export factory; treat as helper, not a black box (ODFI spec may require hand-rolling specific fields)
- `jose@6.2.3` — RS256 JWT signing for IRS e-Services TIN-Matching API (JWKS client-credentials)
- `@hono/zod-openapi@1.4.0` — OpenAPI 3.1 spec auto-generation from Zod on existing `apps/public-api`; `app.doc31()` emits 3.1 directly; zero new framework
- `request-filtering-agent@3.2.0` — SSRF guard: blocks RFC-1918 + loopback + link-local + cloud-metadata AND re-validates the DNS-resolved IP at connect time (DNS-rebind defense — the part naive URL checking misses)
- `stripe` already present — pin below `22.2.0` (published 2026-06-03, violates 7-day rule on 2026-06-07); use `22.1.x` until 22.2.0 ages

**Critical build-not-buy decisions:**
- **IRS IRIS A2A**: no Node lib exists; hand-build XML against IRS XSDs (Pub 5717/5718/5719) with `xmlbuilder2` + XSD-validate in CI; keep a transmitter-adapter seam so Sovos/1099Pro can slot in; FIRE is dead for TY2026
- **Personio adapter**: REST v2 directly; no Node SDK; proprietary client-credentials bearer (NOT RFC-6749 — do not use a generic OAuth2 client); 200 req/min per credential; attribute-scoped credentials (unpermitted fields silently omitted, not errors); offset/limit pagination max 200
- **BambooHR adapter**: REST + OAuth 2.0 mandatory for B2B multi-tenant; no Node SDK (PHP/Python only); employee list un-paginated; time-off endpoints paginate (`page`/`per_page`)
- **DATEV**: ASCII Lohn-import file default (LODAS has NO REST); DATEVconnect REST only behind `payroll-datev` flag for orgs with DATEVconnect subscriptions
- **SDK generation**: Speakeasy from OpenAPI 3.1 spec; standalone binary (no day-zero npm dep); publishes `@contractor-ops/sdk` (npm) + `contractor-ops-sdk` (PyPI)
- **Developer portal**: Scalar self-hosted on `apps/public-api` (fits local-only posture, MIT); Mintlify only if marketing chooses hosted AI-search; pin `@scalar/hono-api-reference` to `0.9.x` (0.10.20 published 2026-06-02, too fresh)

**What NOT to add:** `@ach/ach` (10yr stale), USPS v1/v2 XML API (retired 2026-01-25), BambooHR Basic-auth API key for SaaS connector (deprecated for B2B), any HRIS aggregator (Merge/Finch/Kombo — paid third party + PII egress + breaks own-credential-store reuse), Stainless/Fern DSL SDK gen, any npm pin published after 2026-05-31, new app for Theme C, OAuth-provider mode, inbound user-defined webhooks.

### Expected Features

**Must have — table stakes (v7.0 audit gate floor):**
- W-9 and W-8BEN/W-8BEN-E collection wizards (US-FORM-01/02)
- IRS TIN-matching interactive/bulk (US-FORM-03); B-notice + backup-withholding workflow on mismatch, not a hard block; PAF enrollment per org is a prerequisite
- 1099-NEC year-end generation + corrections (US-FORM-04); threshold $2,000 TY2026 as config table (backlog "$600" stale); legacy $600 for pre-2026 corrections
- IRIS e-file transmit + ack loop (US-FORM-05); IRIS-primary; FIRE legacy-only for TY2025-and-earlier corrections; new IRIS TCC required (45-day lead)
- 1042-S for foreign contractors of US payers (US-FORM-06); 30% statutory withholding default without a complete W-8 chain; treaty rate requires valid W-8 + article + FTIN
- ACH NACHA file generator PPD/CCD/CTX (US-PAY-01); new format in existing factory; balanced file + valid effective-entry-date + return-code handling required
- USD first-class currency (US-PAY-02); multi-currency engine already ships, this is config + UX
- Fedwire wire export (US-PAY-04); genuinely in scope: Same-Day ACH cap $1M until 2027-09-17
- US contractor profile fields with USPS Addresses 3.0 (OAuth 2.0; 60 req/hr no-batch — design throttling + cache) (US-FIELD-01..04)
- WORKER-01..05: additive `workerType` discriminator on existing Contractor; zero data migration for v1–v6; sole hard serialization point in Theme B
- Per-market employee registry ×6 (PL/DE/UK/US/AE/SA) with all statutory identifiers (EMP-REG-*)
- Akta osobowe / personnel file structure (AKTA-01..04); per-jurisdiction retention; RODO erasure honoring statutory holds with statutory citation on blocked sections
- Leave-balance engine + request workflow + team calendar (LEAVE-01..03); manual sick entry only; e-ZLA/eAU deferred v7.5
- KP-grade employee time tracking + PL ewidencja report (TIME-EMP-01..03)
- Per-market on/offboarding workflows (EMP-ON-01, EMP-OFF-01 composing v6.0 F4 — extend, do not duplicate)
- Payroll export adapters ≥1 per market (PL: Symfonia/Comarch/Enova; DE: DATEV+Sage; UK: Sage+BrightPay+Moneysoft; US: Gusto+QuickBooks+ADP)
- Personio + BambooHR two-way HRIS sync with source-of-truth split; both adapters pass conflict tests; one HRIS per org enforced via DB unique constraint
- Employee + manager self-service portal (EMP-PORTAL-01..04)
- HR dashboard widgets (HR-DASH-01..05)
- Public REST API with write endpoints + cursor pagination + OpenAPI 3.1 (INTEG-API-01..04)
- API key management + per-scope enforcement + per-tier rate limits (INTEG-AUTH-01..05); note: backlog INTEG-AUTH-01 says "bcrypt" but repo uses HMAC-SHA256 — reconcile the spec to match implementation, not the reverse
- Outbound webhooks: event catalog + HMAC-SHA256 signing + QStash backoff + DLQ + replay protection + PII-redaction-default-on (INTEG-WEBHOOK-01..07)
- SSRF guard with DNS-rebind protection (INTEG-SEC-01..03); must gate all outbound webhook dispatch; existing `webhook-dispatcher.ts` is inbound-only — outbound is greenfield
- All three marketplace listings (Zapier + n8n npm + Make.com) reachable E2E
- Developer portal + TS/Python SDKs + status page (INTEG-DX-01..04)

**Should have — differentiators:**
- US tax-treaty engine (US-LOC-02/03): auto rate + W-8BEN treaty-article populate from contractor home jurisdiction — the cross-border wedge no competitor combines with multi-market e-invoice compliance
- US classification extension — federal common-law + CA AB5 (stricter default for CA workers with logged admin override) + §530 safe harbor + Determination Letter PDF (US-CLASS-01..04)
- 1099-K threshold tracker at $20,000 + 200 transactions (US-CLASS-03 corrected; backlog "$5K/$600" stale)
- Modern Treasury / Stripe Treasury programmatic ACH opt-in (US-PAY-03) — premium tier, moves from file-export to press-pay
- Plaid identity verification at contractor onboarding (US-PAY-05) — anti-fraud trust signal
- Per-subscription PII redaction default-on (INTEG-WEBHOOK-07) — RODO-defensible, rare in SMB API space
- API-key leak alarm (INTEG-SEC-05) — alert on >3 distinct source IPs / 24h

**Defer (locked decisions):**
- HMRC RTI direct submission → v7.5
- PL e-ZLA auto-pull, DE eAU auto-pull → v7.5
- Full 50-state US withholding matrix (10 states + free-text ships v7.0) → v7.5/v8.0
- Workday/Paychex/Rippling-payroll adapters → v8.0+ on customer pull
- Own payroll engine → v8.0+ only if adapter friction proves dispositive
- OAuth provider mode, inbound user-defined webhooks → v8.0+
- EOR/AOR, ATS, performance reviews → out of charter

### Architecture Approach

v7.0 extends the existing five-layer architecture (clients / apps / packages/api / packages/integrations / packages/db) without adding new apps or frameworks. Seven reusable patterns govern all net-new code verified in the live tree. The key structural principle: every component a v7.0 feature needs already exists and is confirmed at specific file paths.

**Major components (new or modified):**
1. `packages/api/src/middleware/add-on.ts` (NEW) — `requireAddOn(addOnKey)` middleware; composes `tier → add-on → flag`; designed once in foundation phase, consumed by both Theme A and B; Theme C stays tier-gated only
2. `packages/db/prisma/schema/contractor.prisma` (MODIFIED additive) — `workerType WorkerType @default(CONTRACTOR)` + `@@index([organizationId, workerType])`; zero data migration for v1–v6
3. `packages/integrations/src/services/outbound-webhook-dispatcher.ts` (NEW) — HMAC sign + SSRF guard (`request-filtering-agent`) + QStash enqueue; sibling to existing inbound `webhook-dispatcher.ts`; consumes existing `OutboxEvent` outbox drain
4. `packages/api/src/routers/us/` (NEW domain folder) — `usFormRouter`, `usPayRouter`, `usClassRouter`, `usFieldRouter`; registers in `root.ts` like classification routers; gated by `us-expansion` flag + `US Cross-Border` add-on
5. `packages/api/src/routers/workforce/` (NEW domain folder) — `workerRouter`, `employeeRouter`, `leaveRouter`, `timeEmpRouter`, `aktaRouter`, `hrDashboardRouter`; gated by `workforce-employees` flag + `Workforce` add-on
6. `packages/integrations/src/adapters/` (NEW adapters) — Personio (API v2, proprietary bearer), BambooHR (OAuth 2.0), Gusto, QuickBooks Payroll, ADP (partner + mTLS), Modern Treasury, Plaid; all via `registerAdapter` in the existing framework
7. `apps/public-api` (MODIFIED) — write endpoints; `@hono/zod-openapi` for OpenAPI 3.1; per-tier rate-limit buckets in existing `rate-limiter.ts`; `WebhookSubscription` CRUD routes
8. `packages/db/src/region.ts` (MODIFIED — 4-place atomic change) — `SUPPORTED_REGIONS` + `REGION_ENV_MAP` + `DataRegion` Prisma enum + R2 bucket map + `buildLazyBag` region coercion all gain `US`/`us-east-1` atomically with a lockstep test

**Key invariants verified in-tree:**
- `OrganizationApiKey.scopes String[]` already exists; `permissionToScopes` in `rbac.ts` already bridges keys to RBAC — no new auth primitive needed for Theme C, only per-endpoint scope declarations and the `payments`/`workflows`/`webhooks:manage` scope additions
- `OutboxEvent` transactional outbox already exists (`schema/outbox.prisma`); outbound webhook dispatch consumes it — the inbound `webhook-dispatcher.ts` is a separate concern and must not be overloaded
- `apiKeyTenantProcedure` today only enforces `requireTier('ENTERPRISE')` + `demoReadOnly`; per-scope enforcement on write endpoints is the genuinely new piece

### Critical Pitfalls

1. **US region is a 4-place atomic change** — `SUPPORTED_REGIONS=['EU','ME']` throws `Unsupported data region` for any US-org request before the handler runs; `preWarmRegionalClients()` silently skips missing clients; `buildLazyBag` in the feature-flag evaluator warn-coerces unknown regions to EU, silently degrading US-jurisdiction flags. All four locations must change atomically in US-INFRA-01 with a test asserting `SUPPORTED_REGIONS` and `DataRegion` enum stay in lockstep. Must land before any US data creation.

2. **`globalModels` allow-list is the IDOR landmine** — `withTenantScope` in `packages/db/src/tenant.ts` auto-injects `organizationId` on every model not in `globalModels`. Adding any v7.0 model to `globalModels` to silence an org-id throw produces silent cross-org data leakage. Rule: never add to `globalModels` for tenant-owning data; child tables only with parent-relation enforcement + a two-org cross-leak test per new model. Schema-guard CI must fail on missing `organizationId`. Theme B introduces more new Prisma models than any prior milestone.

3. **Outbound webhook SSRF is greenfield — existing dispatcher is inbound-only** — `webhook-dispatcher.ts` verifies incoming provider signatures; there is no outbound egress control in the repo. A naive URL-time check is bypassed by DNS rebinding. Fix: reject at subscribe time AND re-resolve + verify resolved IP immediately before connect (pin the resolved IP; disable redirects on the dispatcher HTTP client). Use `request-filtering-agent@3.2.0`. Gate all INTEG-WEBHOOK dispatch on INTEG-SEC-01 landing first.

4. **`apiKeyTenantProcedure` does not enforce per-scope — BFLA/OWASP-API5** — chains `apiKeyAuth → requireTier('ENTERPRISE') → demoReadOnly`. Adding write endpoints without per-endpoint scope enforcement means a `contractors:read` key can call write procedures. Every write endpoint must explicitly declare its required scope. Write DTOs must be `.strict()` Zod schemas rejecting `organizationId`, `workerType`, `status`, and money fields from the body (mass-assignment/OWASP-API3). INTEG-AUTH-02 scopes must precede any write endpoint shipping.

5. **WORKER-01 breaks all existing contractor read paths unless pre-filtered** — after employees exist, every `contractor.findMany` without `workerType:'CONTRACTOR'` returns employees in contractor lists, dashboards, payment runs, and classification scans. Must audit all ~50-namespace `findMany`/`findFirst` call sites. Lock existing contractor tRPC output shapes with snapshot tests. Run migration on staging snapshot of largest org and diff outputs before/after.

6. **IRS FIRE decommissions 2026-12-31 with no grace period; FIRE TCC does not carry to IRIS** — the backlog's "FIRE primary / IRIS fallback" framing is inverted. TY2026 returns (filed early 2027) are IRIS-only. New IRIS-specific TCC requires ~45-day application. Begin TCC enrollment document in Phase 0. Ship IRIS as the primary transmit path; FIRE only for TY2025-and-earlier legacy corrections.

7. **HRIS two-way sync without a hard field-owner partition silently corrupts financial data** — a Personio pull that overwrites a Contractor-Ops-owned field or a push that triggers an echo pull creates silent data corruption and sync loops. Encode the field partition as a per-field `owner: HRIS | CONTRACTOR_OPS` map in the pull mapper; the pull mapper must be physically incapable of writing CO-owned fields. Enforce one HRIS per org via DB unique constraint on `(organizationId, integration-category)`. Dedup inbound HRIS webhooks via the QStash `deduplicationId` pattern.

## Implications for Roadmap

### Phase 0: Foundation — shared billing infrastructure + IRIS enrollment
**Rationale:** `requireAddOn` middleware must exist before any Theme A or B revenue-gated procedure is written; building it per-theme produces inconsistent gating. Declare all v7.0 flags in the signoff registry (boot gate exits if missing). Teach `buildLazyBag` about `US`. Begin IRIS TCC enrollment document immediately.
**Delivers:** `add-on.ts` + `OrgAddOn` entitlement decision; all v7.0 flag registry entries with signoff; `buildLazyBag` US region coercion; IRIS TCC application started.
**Addresses:** requireAddOn (Pitfall 6); flag-signoff boot gate (Pitfall 5); IRIS enrollment lead-time.
**Avoids:** Ad-hoc per-theme add-on checks; US flag silent degradation (Pitfall 1).
**Research flag:** Standard — mirrors existing `requireTier` + flag-registry patterns; no /gsd:plan-phase research needed.

### Phase 1 (Theme A): US region infrastructure
**Rationale:** US-INFRA-01/02/03 must precede any US data creation. The 4-place atomic change in `region.ts` + Prisma enum + R2 bucket map + `buildLazyBag` must land with a lockstep test.
**Delivers:** US-org requests resolve a US Prisma client + US R2 bucket; IRS 4-yr/7-yr retention enforcement scaffolded; cross-region replicas remain off; `DATABASE_URL_US` in `.env.example` + package env schema.
**Avoids:** Silent DB throw for US orgs (Pitfall 1); wrong-region tax-PDF storage (Pitfall 9).
**Research flag:** Standard — architecture verified in-tree; change surface is fully identified.

### Phase 2 (Theme B serial gate): WORKER-01 — discriminated union migration
**Rationale:** Sole hard serialization point in Theme B. Nothing employee-side starts before it. Staging-snapshot migration diff is a v7.0 gate criterion.
**Delivers:** Additive `workerType` migration; `@@index([organizationId, workerType])`; all existing contractor `findMany`/`findFirst` call sites audited and filtered; contractor output shapes snapshot-locked; zero v1–v6 data migration.
**Avoids:** Contractor list corruption + classification scan misfires (Pitfall 3); IDOR via missing tenant scope (Pitfall 2).
**Research flag:** Standard — locked pattern verified in-tree.

### Phases 3–5 (Theme C): INTEG-API-01 → INTEG-AUTH (scopes) → INTEG-SEC (SSRF) → INTEG-WEBHOOK
**Rationale:** Internal gate chain: API foundation → scope enforcement → SSRF guard → webhooks → marketplace listings. INTEG-AUTH-02 must precede write endpoints; INTEG-SEC-01 must gate INTEG-WEBHOOK dispatch; marketplace listings need stable API + webhooks.
**Delivers:** Public REST API read+write; OpenAPI 3.1 via `@hono/zod-openapi`; per-scope enforcement on every write endpoint with `.strict()` Zod DTOs; SSRF guard with DNS-rebind protection via `request-filtering-agent`; `WebhookSubscription` model + outbound dispatcher on existing outbox; HMAC signatures; DLQ; PII redaction default-on; Zapier + n8n + Make listings; OpenAPI-generated SDKs; Scalar dev portal; status page.
**Avoids:** BFLA/mass-assignment (Pitfall 8); SSRF cloud-metadata pivot (Pitfall 7); cross-org leak (Pitfall 2).
**Research flag:** INTEG-SEC-04 OWASP checklist must be real automated tests at the audit gate, not prose — flag for plan-phase rigor. Marketplace review timelines (Zapier 2–4wk, Make 1–2wk) are external; submit early, do not block GA announcement on them.

### Phases 3–5 (Theme A, parallel): US forms → US payments → US classification
**Rationale:** Within Theme A: US-INFRA first, then profile fields + en-US locale (parallel, low-risk), then W-9/W-8 intake → TIN-match → 1099-NEC build → IRIS transmit (serial sub-chain), then ACH NACHA parallel to forms, then treaty table → 1042-S (treaty table must precede 1042-S), then classification extension.
**Delivers:** Full US tax-form intake-to-IRIS loop; 1099 threshold at $2,000 as config table; NACHA ACH file via payment-export factory (balanced + return-code handling); treaty-aware 1042-S; CA AB5 watchlist + Determination Letter.
**Key correctness requirements:** backup-withholding W-9 flag actually reduces payout by 24% (not just stored); IRIS primary (not FIRE); 1099-K tracker at $20,000 + 200 transactions; treaty rate gated on complete W-8 chain; ACH files balanced with valid effective-entry-date.
**Research flag:** IRS TIN-Matching PAF enrollment is a per-org operational prerequisite — flag as a prerequisite checklist item in the plan. US-CLASS-04 Determination Letter generation likely needs `/gsd:ai-integration-phase`. USPS Addresses 3.0 60 req/hr no-batch constraint requires throttling + caching design.

### Phases 3–N (Theme B fan-out, parallel after WORKER-01): EMP-REG → AKTA → LEAVE/TIME → on/offboarding → payroll adapters → HRIS sync → employee portal → HR dash
**Rationale:** All fan-out work is unblocked after WORKER-01 and can largely run in parallel subject to solo-dev throughput. Key ordering within the fan-out: EMP-REG before AKTA (need registry fields to classify docs); LEAVE after EMP-REG (balance rules are market-specific); payroll adapters after on/offboarding context exists; HRIS sync after EMP-REG (Personio pull maps to registry fields).
**Delivers:** Full per-market workforce management; ≥1 payroll export adapter per market (ADP lead-time risk — see gaps); Personio + BambooHR two-way sync with field-owner partition hard-coded in the pull mapper; single-HRIS-per-org DB unique constraint; employee self-service portal; HR dashboard.
**Key correctness requirements:** ADP requires ADP Marketplace partner program approval + mTLS client cert (treat as potentially v7.1 if approval delays); AKTA erasure honors statutory holds with citation, never claims full erasure; legal annotations required on all statutory form copies (Standing Constraint); BambooHR custom-attribute contract must be verified before HRIS-SYNC-04 plan-phase (explicit gate).
**Research flag:** BambooHR custom attributes (HRIS-SYNC-04 gate — use `/gsd:plan-phase --research-phase`). Personio rate limits: verify exact endpoint-level limits against current contract before HRIS-SYNC-01 plan-phase (community data is MEDIUM confidence). ADP partner program: determine timeline early; if blocked, QuickBooks + Gusto are the must-have US adapters for v7.0 audit gate.

### Phase Ordering Rationale

- Foundation (Phase 0) before any revenue-gated work — prevents duplicate `requireAddOn` helpers and undefined flag entries.
- US-INFRA (Phase 1 Theme A) before US data creation — prevents the silent `Unsupported data region` throw and wrong-region storage.
- WORKER-01 (Phase 2 Theme B) before any employee rows — the only strict serialization point in Theme B.
- INTEG-AUTH scopes before INTEG-API writes — prevents BFLA from landing in production.
- INTEG-SEC SSRF before INTEG-WEBHOOK dispatch — prevents cloud-metadata pivot.
- Themes A (post-INFRA), B (post-WORKER-01), and C (post-INTEG-API-01) otherwise concurrent.
- Marketplace submissions early — review timelines are external and non-deterministic.

### Research Flags

Phases needing deeper research during planning:
- **HRIS-SYNC-04 (BambooHR custom attributes):** Explicit research gate in backlog — custom-attribute contract not verified. Use `/gsd:plan-phase --research-phase` before planning this phase.
- **HRIS-SYNC-01/02 (Personio rate limits):** Community changelog data only (MEDIUM confidence). Verify endpoint-level limits against current Personio contract before plan-phase.
- **US-CLASS-04 (Determination Letter):** AI-generation component likely needs `/gsd:ai-integration-phase` per backlog checklist.
- **US-FORM-03 (TIN Matching PAF enrollment):** Per-org operational prerequisite; confirm enrollment process and lead-time; flag as plan-phase prerequisite checklist item.
- **PAYROLL-US ADP:** ADP Marketplace partner program + mTLS cert are external dependencies with unknown lead times. Assess early; have contingency (QuickBooks + Gusto as v7.0 floor, ADP as v7.1).
- **INTEG-SEC-04 (OWASP review):** Must be automated tests at the audit gate — flag explicitly in the Theme C plan-phase.

Phases with standard patterns (skip research-phase):
- **Phase 0 Foundation:** `requireAddOn` mirrors `requireTier`; flag registry is a documented boot-gate procedure; both verified in-tree.
- **US-INFRA-01:** 4-place change is fully identified in-tree; a lockstep test is the key deliverable.
- **WORKER-01:** Additive discriminated union is a locked, verified pattern; contractor `findMany` audit + snapshot test checklist is known.
- **INTEG-API-01 / INTEG-AUTH-01..05:** Public-API Hono host, `OrganizationApiKey.scopes`, per-tier rate-limiter all already exist in the tree.
- **US-PAY-01 (NACHA):** Payment-export factory extension shape verified; balanced-file + return-code handling checklist is known; `@midlandsbank/node-nacha` is a formatter helper.
- **Payroll export adapters (PL/DE/UK):** Each is a new `PayrollExportProfile` in the existing factory; adapter pattern is standard.
- **EMP-PORTAL:** Extends existing v2.0 portal magic-link + subdomain; new `/employee/*` shell pages under the same auth model.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All npm versions verified against registry on 2026-06-07; 7-day-age violations identified; IRS IRIS/FIRE transition corroborated by Sovos, Ice Miller, TaxBandits, IRS.gov; Personio/BambooHR SDK absence confirmed from official developer docs |
| Features | HIGH | IRS regulatory facts (OBBBA 1099 thresholds, FIRE decommission, 1099-K revert, Same-Day ACH cap) verified against IRS.gov + multiple independent secondary sources; three backlog corrections are load-bearing |
| Architecture | HIGH | All seams verified in-tree against actual file paths and code signatures; read directly from `tenant.ts`, `region.ts`, `webhook-dispatcher.ts`, `api-key-auth.ts`, `root.ts`, `portal-root.ts`, `payment-export.ts`, `registry.ts`, `outbox.prisma`, `public-api/app.ts`, `rate-limiter.ts`, `api-key-service.ts` |
| Pitfalls | HIGH (architecture-grounded) / MEDIUM (Personio rate-limit specifics) | SSRF, IDOR, discriminated-union, BFLA pitfalls verified against live code; Personio exact endpoint-level rate limits from community changelog only — flagged as MEDIUM and gated |

**Overall confidence:** HIGH on all load-bearing decisions; MEDIUM on two named research gates (BambooHR custom attributes; Personio exact rate-limit contract) which are explicitly gated in the backlog and flagged above.

### Gaps to Address

- **Personio custom-attribute field contract:** Community docs confirm attributes must be known in advance and are company-specific, but the exact contract for a new SaaS tenant's attribute mapping is unverified. Gate HRIS-SYNC-04 plan on direct verification. If custom attributes cannot be reliably mapped, HRIS-SYNC-02/03 scope narrows to standard fields only.
- **BambooHR custom-attribute support:** Explicitly unverified (backlog research gate). Block HRIS-SYNC-04 plan-phase.
- **IRS IRIS TCC enrollment:** 45-day lead; begin application in Phase 0. If TCC not approved before US-FORM-05 plan-phase, fall back to commercial transmitter (Sovos/1099Pro) behind the transmitter-adapter seam.
- **ADP Marketplace partner program:** External gating; no published timeline. Treat ADP as potentially v7.1; QuickBooks + Gusto as v7.0 must-have US payroll adapters.
- **`requireAddOn` entitlement source:** Decide `Subscription.addOns String[]` vs normalized `OrgAddOn` table in Phase 0. `OrgAddOn` table is cleaner for audit + per-add-on period tracking.
- **INTEG-AUTH-01 "bcrypt" vs repo HMAC-SHA256:** Backlog spec says "bcrypt + per-key salt"; `api-key-service.ts` uses HMAC-SHA256. HMAC is correct for high-entropy random keys. Reconcile the requirements doc to match the implementation — do not change the implementation.
- **Zapier/Make marketplace review timelines:** 2–4 weeks and 1–2 weeks are estimates; reviews can run longer. Submit both in parallel as early as the public API + webhooks are stable. Do not gate the GA announcement on approvals — `n8n` (self-serve npm publish) is the launch-day integration story if reviews pend.

## Sources

### Primary (HIGH confidence)

- IRS.gov — FIRE decommission 2026-12-31, IRIS A2A Pub 5717/5718/5719, TIN-Matching e-Services, 1099-K threshold FAQ (IRS newsroom)
- Sovos, Ice Miller, TaxBandits — FIRE→IRIS transition corroboration (multiple independent sources)
- Calibre CPA, OnPay, Littler, IRS Pub 1099 (2026) — OBBBA 1099-NEC $2,000 threshold confirmation
- Nacha.org — Same-Day ACH cap $1M now, $10M from 2027-09-17
- developer.personio.de — API v2, 200 req/min/credential, attribute-scoped, proprietary bearer, v1 deprecation 2026-07-31
- documentation.bamboohr.com/docs/sdks — official SDKs PHP+Python only; OAuth 2.0 required for B2B
- npm registry (2026-06-07) — all package versions + publish dates; 7-day-age violations identified
- In-tree source reads: `packages/db/src/{tenant.ts,region.ts}`, `packages/api/src/services/{payment-export.ts,regional-storage.ts,api-key-service.ts}`, `packages/api/src/middleware/{tier.ts,feature-flag.ts,rbac.ts,api-key-auth.ts}`, `packages/integrations/src/services/webhook-dispatcher.ts`, `apps/public-api/src/{app.ts,lib/rate-limiter.ts}`, `packages/db/prisma/schema/{contractor.prisma,api-key.prisma,integration.prisma,outbox.prisma,billing.prisma,payment.prisma}`
- OWASP API Security Top 10 2023 — BOLA (API1), BFLA (API5), BOPLA (API3)

### Secondary (MEDIUM confidence)

- Personio developer changelog — IP rate limiting + GET employees endpoint rate limits (community changelog, not contract SLA)
- Speakeasy vs Stainless vs Fern comparison — vendor-authored, cross-checked
- Mintlify vs Scalar — developer tooling community comparisons
- DATEV developer.datev.de + DATEV-Community — LODAS ASCII-only; L&G Lohnimportdatenservice REST
- dev.gusto.com, Intuit QuickBooks docs, ADP developers.adp.com — REST + OAuth + mTLS (partner-gated)

### Tertiary (LOW confidence)

- Zapier / n8n / Make review timelines (2–4wk / self-serve / 1–2wk) — platform community, non-contractual

---
*Research completed: 2026-06-07*
*Ready for roadmap: yes*
