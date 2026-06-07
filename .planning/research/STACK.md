# Stack Research — v7.0 GTM Expansion

**Domain:** B2B contractor-ops platform; net-new surface = US cross-border tax/payments (Theme A), workforce/HRIS-sync (Theme B), public API + webhook marketplace (Theme C)
**Researched:** 2026-06-07
**Confidence:** HIGH on payment/HRIS/OpenAPI SDKs (Context7 + official docs + verified npm versions); MEDIUM on IRS IRIS/TIN-Matching build-vs-buy (gov't specs, no Node lib exists); HIGH on the "what NOT to add" calls.

> Scope discipline: this file covers ONLY what v7.0 adds. Existing infra (pluggable payment-export factory, integration framework with AES-256-GCM credential store + OAuth callback + webhook ingestion + health monitor, multi-region Neon routing, Unleash flags, QStash, `@contractor-ops/logger`, Hono `apps/public-api`, Better Auth `requireTier`, integer-grosze money, Prisma 7) is REUSED, not re-chosen. Each recommendation below states where it plugs in.

> 7-day-release-age policy (`minimumReleaseAge: 10080`): today = 2026-06-07. Any package published after 2026-05-31 is BLOCKED until it ages. Flagged inline as TOO FRESH with the safe-pin to use instead. Versions verified via `npm view <pkg> version time.modified`.

---

## Recommended Stack

### Core Technologies (new external surfaces)

| Technology | Version (verified) | Purpose | Why Recommended |
|------------|--------------------|---------|-----------------|
| `stripe` (Treasury) | 22.2.0 (TOO FRESH — pub 2026-06-03; pin **22.1.x** until 22.2.0 ages) | Theme A US-PAY-03: programmatic ACH/wire outbound payouts via `stripe.treasury.outboundPayments.create()` | Already a dependency (v3.0 billing). Treasury is the SAME SDK — no new vendor onboarding. Native `purpose:'payroll'` flag satisfies the NACHA originator-identification rule. Same-day ACH is gated (email approval). |
| `modern-treasury` | 4.15.0 (pub 2026-04-22 OK) | Theme A US-PAY-03 alt: bank-agnostic ACH/Fedwire orchestration for orgs that bring their own bank | Official Node SDK (Context7 `/websites/moderntreasury_platform_reference`, HIGH rep). Use when an org wants its own bank rather than Stripe holding funds. Wire BOTH behind one `UsPayoutProvider` adapter in the integration framework; org picks at connect time. |
| `plaid` | 42.2.0 (pub 2026-04-27 OK) | Theme A US-PAY-05: US bank-account link + Identity/Auth verification at onboarding (anti-fraud) | Official Node SDK (`/plaid/plaid-node`, HIGH rep). Plaid Auth returns routing+account for the NACHA file; Identity Match for fraud. Token store reuses existing AES-256-GCM credential pattern. |
| `@midlandsbank/node-nacha` | 2.1.1 (pub 2025-10-15 OK) | Theme A US-PAY-01: generate NACHA ACH files (PPD/CCD/CTX) | Most-maintained Node NACHA lib (others: `@ach/ach` ~10y stale; `nACH2`/`NACHAjs` low activity). Treat as a formatter helper INSIDE the existing payment-export factory, not a black box — NACHA is a documented fixed-width format, fully hand-buildable; validate output against your ODFI's spec. |
| `@hono/zod-openapi` | 1.4.0 (pub 2026-05-09 OK) | Theme C INTEG-API-02: OpenAPI 3.1 spec auto-gen from Zod on `apps/public-api` | Native Hono middleware. `app.getOpenAPI31Document()` / `app.doc31()` emits 3.1 directly. Zero new framework — `apps/public-api` is already Hono. Single source of truth: Zod schema → runtime validation + spec + (downstream) SDK. |
| `jose` | 6.2.3 (pub 2026-04-27 OK) | Theme A US-FORM-03: sign IRS e-Services TIN-Matching API JWT (JWKS/RS256); plus any RS256 need | IRS e-Services API auth = client publishes a JWKS (RS256 public key) and signs request assertions. `jose` is the standard, audited Node JWT/JWK lib. |

### Supporting Libraries

| Library | Version (verified) | Purpose | When to Use |
|---------|--------------------|---------|-------------|
| `request-filtering-agent` | 3.2.0 (pub 2025-12-15 OK) | Theme C INTEG-SEC-01: SSRF guard on outbound webhook dispatch | Blocks RFC-1918/loopback/link-local/`169.254.169.254` AND re-checks the **DNS-resolved IP at connect time** (defeats DNS-rebind — the requirement's hard part). Wrap the QStash-bound dispatch agent. Backstop with own CIDR denylist for cloud-metadata variants (GCP `metadata.google.internal`, Azure). Prefer over `ssrf-req-filter@1.1.1` (older, weaker rebind handling). |
| `@scalar/hono-api-reference` | 0.10.20 (TOO FRESH — pub 2026-06-02; pin prior aged **0.9.x** until it ages) | Theme C INTEG-DX-01: render the OpenAPI ref UI from `apps/public-api` | If self-hosting docs on the Hono app. MIT, code-first, mounts the 3.1 doc. Alternative = host on Mintlify (below). |
| `openapi-typescript` | 7.13.0 (pub 2026-02-11 OK) | Theme C: type-only TS surface from the spec (internal consumers / tests) | Lightweight types when a full client isn't needed. Complements (not replaces) the published SDK. |
| `@apidevtools/swagger-parser` | 12.1.0 (pub 2026-01-24 OK) | Theme C: validate/bundle the generated OpenAPI doc in CI before publishing SDK + portal | CI gate so a malformed spec never ships to npm/PyPI/Mintlify. |

### Build-vs-Buy / External services (no npm install — gated partner programs or spec-driven hand-build)

| Surface | Decision | Why |
|---------|----------|-----|
| **IRS IRIS A2A e-file** (US-FORM-05) | **HAND-BUILD XML against IRS XSDs (Pub 5717/5718/5719), OR BUY a transmitter** (1099Pro / Sovos / BoomTax). No Node lib exists. | IRIS A2A = SOAP-over-HTTPS, XML per IRS-published XSD, new IRIS-specific TCC (45-day application), strict pre-submission validation. **FIRE decommissions 2026-12-31** — TY2025 is the LAST FIRE year; TY2026 returns (filed early 2027) are IRIS-only. v7.0 must ship IRIS-primary. Recommend: model 1099-NEC/1042-S in Prisma, emit IRIS XML against the XSD (`xmlbuilder2`-style), validate in CI (`libxmljs2`/`xsd-schema-validator`). Keep a thin transmitter-adapter seam so a BUY (Sovos/1099Pro) can drop in for orgs that prefer it. |
| **IRS TIN-Matching API** (US-FORM-03) | **DIRECT API** (e-Services); auth via `jose` JWT (JWKS/RS256) | Interactive ≤25 TIN/Name per call (immediate); Bulk ≤100k via .txt (hours). Requires PAF enrollment + IRS API Client ID. 24h cache + admin-escalation-on-mismatch per requirement. |
| **USPS Addresses 3.0** (US-FIELD-03) | **DIRECT REST**, OAuth 2.0 client-credentials | v1/v2 retired 2026-01-25. v3 = OAuth (8h token), **60 req/hr, no batch** — design throttling + cache HARD (real constraint for bulk imports). CASS data ≤105 days. No SDK needed; thin Hono-side client + token cache. |
| **DATEV Lohn/Gehalt** (PAYROLL-DE-01) | **HAND-BUILD ASCII import file**; DATEVconnect REST only where org subscribes | DATEV "Lohnimportdatenservice" REST exists for *Lohn und Gehalt* (gated, per-org DATEVconnect). **LODAS has NO REST — ASCII import only.** Ship the ASCII Lohn-import generator as default; REST adapter behind `payroll-datev` flag for subscribed orgs. |
| **Symfonia / Comarch (XL/Optima) / Enova365** (PAYROLL-PL-01..03) | **HAND-BUILD CSV + their XML** | No official public Node SDKs — these are file-import integrations. Each = a `PayrollExportProfile` in the existing payment-export factory pattern (new format, same factory). |
| **Sage UK / BrightPay / Moneysoft** (PAYROLL-UK-01) | **HAND-BUILD RTI-compatible FPS/EPS XML** (export only; direct HMRC RTI submission DEFERRED to v7.5) | v7.0 produces the FPS/EPS XML the org imports into their payroll tool; it does NOT submit to HMRC (PAYROLL-UK-02 = v7.5). |
| **Gusto** (PAYROLL-US-01) | **DIRECT REST** (Gusto Embedded); official client libraries exist | Modern REST + OAuth; Gusto Embedded ships official SDKs/React components. For our push-data adapter, REST + OAuth via the integration framework is enough. We push pay-data; Gusto files taxes. |
| **QuickBooks Payroll** (PAYROLL-US-01) | **DIRECT REST** (Intuit OAuth 2.0) | Adapter in integration framework. |
| **ADP** (PAYROLL-US-01) | **DIRECT REST** — gated marketplace partner + OAuth 2.0 **+ client cert (mTLS)** | NO public Node SDK. Must apply as ADP Marketplace partner; OAuth uses client certificates in addition to client_id/secret. Workers v2 (read) + Pay Data Input v1 (write). Treat partner-onboarding lead-time as a phase risk. |
| **Personio** (HRIS-SYNC-01..03) | **DIRECT REST** (API v2); no official Node SDK | **Research-gate RESOLVED:** API v2 = **200 req/min per credential** (429 + `X-RateLimit-*` headers; Auth endpoint separately 150/min then 1/s). **Custom attributes: keys must be known in advance, company-specific; every field value wrapped `{value, type}` — must unwrap.** Client-ID/secret auth. Hourly-cron pull (HRIS-SYNC-02) MUST respect 200/min → batch + backoff. Adapter reuses integration-framework credential store + health monitor. |
| **BambooHR** (HRIS-SYNC-04) | **DIRECT REST**, **OAuth 2.0 (required for B2B SaaS)**; no official Node SDK | **Research-gate RESOLVED:** Official SDKs are PHP + Python only — **none for Node**. For multi-tenant SaaS connecting to customers' accounts, OAuth 2.0 is mandatory (Basic-auth API-key path is single-tenant/legacy and being deprecated). Employee list is UN-paginated (whole list in one response); time-off endpoints DO paginate (`page`/`per_page`). Same adapter shape as Personio. |
| **Zapier app** (INTEG-ZAPIER-01..02) | **Zapier Platform CLI** (Node/TS app) | Triggers map to the webhook event catalog; actions hit the public REST API with the user's API key. 2–4 wk review cycle. Code-first CLI (not the visual builder) for in-repo versioning. |
| **n8n community node** (INTEG-N8N-01) | **`n8n-nodes-*` package published to npm** (TypeScript) | Publish `@contractor-ops/n8n-nodes`; n8n's declarative/programmatic node TS interface. Mirrors Zapier trigger/action surface against the public API. |
| **Make.com app** (INTEG-MAKE-01) | **Make custom app** (Make app SDK / JSON-config blueprint) | Same trigger/action surface; ~1–2 wk review. No npm artifact. |
| **TS + Python SDK auto-gen** (INTEG-API-05) | **Speakeasy** (primary) — generate from the OpenAPI 3.1 doc | Best 2026 generator: Zod-backed runtime type safety, single TS runtime dep, OpenAPI as single source of truth (no proprietary DSL drift, unlike Stainless/Fern), ships as a standalone binary → fits CI + air-gapped + 7-day-age posture (no day-zero npm dep). Publishes `@contractor-ops/sdk` (npm) + `contractor-ops-sdk` (PyPI). Fallback: `openapi-generator` (free, but high maintenance — 4,500+ open issues). |
| **Developer portal** (INTEG-DX-01) | **Scalar self-host** (recommended) OR **Mintlify** (hosted) | Scalar = MIT, code-first, very accurate OpenAPI parsing, self-host beside `apps/public-api` → fits local-only/data-residency posture + zero vendor lock. Mintlify = best AI/LLM discoverability (llms.txt + MCP), MDX, custom subdomain, but weaker raw OpenAPI parsing + is a SaaS dependency. Choose Mintlify only if marketing wants the hosted polish + AI search. |

---

## Installation

```bash
# Theme A — US payments + IRS
pnpm add modern-treasury@4.15.0 plaid@42.2.0 @midlandsbank/node-nacha@2.1.1 jose@6.2.3
# stripe already present — bump to Treasury-capable line, pin BELOW 22.2.0 until it ages:
#   pnpm add stripe@22.1   (22.2.0 pub 2026-06-03 — violates 7-day age on 2026-06-07)

# Theme C — public API spec + SSRF guard (apps/public-api)
pnpm add @hono/zod-openapi@1.4.0 request-filtering-agent@3.2.0

# Theme C — docs UI (self-host). Pin previous Scalar line; 0.10.20 pub 2026-06-02 too fresh:
#   pnpm add @scalar/hono-api-reference@0.9   (confirm exact aged version at install time)

# Theme C — dev tooling (devDependencies)
pnpm add -D openapi-typescript@7.13.0 @apidevtools/swagger-parser@12.1.0
# Speakeasy SDK gen: standalone CLI (brew/curl in CI), NOT an npm dep — keeps supply-chain surface small

# IRIS XML build/validate (Theme A US-FORM-05) — confirm aged versions at install:
#   pnpm add xmlbuilder2 libxmljs2   (or xsd-schema-validator) — IRS XSD-validated 1099/1042-S XML

# After ANY add/upgrade (mandatory):
pnpm audit && pnpm security:scan
```

> No `apps/*` framework changes. Theme C lives in existing Hono `apps/public-api`; webhook dispatch reuses `apps/cron-worker` + QStash; payment formats slot into the existing payment-export factory; HRIS/payroll/Plaid/Stripe/MT adapters slot into the existing integration framework (credential store + OAuth callback + health monitor).

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `@midlandsbank/node-nacha` (helper) | Hand-roll NACHA fixed-width in the factory | If ODFI spec deviates from lib defaults (addenda/batch-balancing) — likely; keep the option open. NACHA is a documented fixed-width format; the lib is convenience, not a moat. |
| Stripe Treasury | Modern Treasury | MT when org brings its own bank / wants Fedwire orchestration without Stripe holding funds. Ship both behind one provider seam. |
| Speakeasy (SDK gen) | Stainless / Fern / openapi-generator | Stainless casts without runtime validation + proprietary DSL + cloud-only (and self-serve reportedly winding down — verify). Fern (Postman-acquired) uses a proprietary DSL. openapi-generator is free but a maintenance sink. Pick Speakeasy unless cost forbids, then openapi-generator. |
| Scalar (self-host docs) | Mintlify (hosted) | Mintlify when you want hosted AI-search/MCP + marketing polish and accept a SaaS dependency outside local-only posture. |
| `request-filtering-agent` | `ssrf-req-filter` / custom | Custom CIDR denylist still required as defense-in-depth for cloud-metadata hostnames; the agent handles the connect-time-resolved-IP rebind check that naive URL parsing misses. |
| Direct Personio/BambooHR REST | Unified HRIS aggregator (Merge/Finch/Kombo) | An aggregator collapses Personio+BambooHR to one API but adds a paid middleman, a third party touching PII (RODO), and breaks the own-credential-store reuse. Two direct adapters fits v7.0's locked 2-provider scope. Revisit only if v8.0 adds many HRIS. |

---

## What NOT to Use / NOT to Build

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **Own payroll calc engine** (PL/DE/UK/US) | Explicit OUT-OF-SCOPE (backlog). Symfonia/DATEV/Sage/Gusto have 10–25yr leads; solo-dev can't compete. | Export/push adapters only — we hand data off, they calculate + file taxes. |
| **`@ach/ach` npm** | ~10 years stale. | `@midlandsbank/node-nacha` or hand-roll. |
| **`ssrf-req-filter@1.1.1` as sole guard** | Older, weaker DNS-rebind handling; webhook SSRF is a named verification gate (hostile `169.254.169.254` must be rejected pre-dispatch). | `request-filtering-agent` + own CIDR denylist + connect-time IP recheck. |
| **IRS FIRE as the PRIMARY e-file path** | Decommissions **2026-12-31**, no grace period; FIRE TCC does NOT carry to IRIS. | IRIS A2A primary; FIRE only as a documented TY2025-and-earlier fallback. Apply for IRIS TCC early (45-day lead). |
| **USPS v1/v2 Web Tools XML API** | Retired 2026-01-25. | USPS Addresses 3.0 (OAuth 2.0) — design around 60 req/hr + no-batch. |
| **BambooHR Basic-auth API key for the SaaS connector** | Single-tenant/legacy; deprecating for B2B; won't scale to per-customer accounts. | OAuth 2.0 from day one. |
| **Stainless/Fern proprietary-DSL SDK gen** | DSL drifts from the OpenAPI source of truth; some are cloud-only / winding down. | Speakeasy (OpenAPI = source of truth) or openapi-generator. |
| **New app for Theme C** | Backlog says reuse `apps/public-api` (Hono). | Extend existing Hono app + cron-worker dispatcher. |
| **OAuth-provider mode / inbound user webhooks** | Explicit v8.0+ out-of-scope. | API-key auth + OUTBOUND-only dispatch in v7.0. |
| **Unified HRIS/payroll aggregator (Merge/Finch) as the default** | Adds a paid third party touching PII; breaks own-credential-store reuse; over-scoped for 2 locked providers. | Direct Personio + BambooHR adapters via existing integration framework. |
| **Day-zero npm pins** (`stripe@22.2.0`, `@scalar/*@0.10.20`, `orval@8.15.0` — all pub after 2026-05-31) | Violates `minimumReleaseAge: 10080`; supply-chain risk. | Pin the prior aged minor; let the fresh release age 7d, then bump. |

---

## Stack Patterns by Variant

**If org wants fully-automated US payouts:**
- Stripe Treasury (`outboundPayments`, `purpose:'payroll'`) OR Modern Treasury, behind one `UsPayoutProvider` adapter
- Because both ride the existing integration-framework credential store + health monitor; org picks at connect time.

**If org only wants a bank file (no programmatic payout):**
- `@midlandsbank/node-nacha` (or hand-roll) NACHA PPD/CCD/CTX + Fedwire export via the payment-export factory
- Because it mirrors the shipped BACS Standard 18 / SWIFT pain.001 / Elixir / SEPA pluggable-format pattern — new format, same factory.

**If org is on DATEV with a DATEVconnect subscription:**
- DATEVconnect REST (Lohnimportdatenservice) behind `payroll-datev` flag
- Else: ASCII Lohn-import file (default; LODAS is ASCII-only regardless).

**If marketing wants hosted AI-searchable docs:**
- Mintlify; else Scalar self-hosted on `apps/public-api` (default for local-only posture).

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `@hono/zod-openapi@1.4.0` | `hono@4.12.x`, `zod@3` or `zod@4` | Repo Hono is 4.12.23 OK. CONFIRM zod major: align with whatever `packages/api`/`public-api` already pin to avoid two zod copies (`@hono/zod-openapi` v1 supports zod v4). |
| `stripe@22.x` Treasury | existing Stripe billing (v3.0) | Same SDK already in tree — single Stripe dep covers billing + Treasury. Bump major carefully against v3.0 billing code. |
| `request-filtering-agent@3.2.0` | native `fetch`/`http(s)` agent, `node-fetch`, axios | Must override BOTH http+https agents or rebind bypass via cross-protocol redirect. |
| Speakeasy CLI | OpenAPI 3.1 doc from `@hono/zod-openapi` | 3.1 fully supported; CI: validate spec (`swagger-parser`) → Speakeasy gen → publish npm + PyPI. |
| `plaid@42.2.0` / `modern-treasury@4.15.0` | Node 18+ | Both official, OpenAPI-generated SDKs; stable. |

---

## Sources

- Context7 `/websites/moderntreasury_platform_reference` (156 snippets, HIGH) — Modern Treasury Node SDK
- Context7 `/plaid/plaid-node` (HIGH) + `/websites/plaid_api` — Plaid Node client, Identity/Auth
- npm registry (`npm view … version time.modified`, 2026-06-07) — all version + publish-date pins; HIGH
- IRS — FIRE→IRIS transition (sunset 2026-12-31; TY2026 IRIS-only; new TCC; 45-day app): irs.gov + Sovos / Ice Miller / 1099Pro corroboration — MEDIUM-HIGH
- IRS Pub 5717/5718/5719 (IRIS A2A SOAP/XML/XSD) + irs.gov "IRIS schemas and business rules" — HIGH (gov't primary)
- IRS TIN-Matching (e-Services; JWKS/RS256 JWT; PAF enrollment; 25 interactive / 100k bulk): irs.gov + IRM 3.42.8 — MEDIUM-HIGH
- USPS Addresses 3.0 (OAuth 2.0, 60 req/hr, no batch, v1/v2 retired 2026-01-25): developers.usps.com — HIGH
- Personio developer.personio.de — API v2 200 req/min/credential, custom-attr known-in-advance + `{value,type}` wrappers — HIGH (research-gate RESOLVED)
- BambooHR documentation.bamboohr.com/docs/sdks — official SDKs PHP+Python only, OAuth 2.0 for B2B, employee list unpaginated — HIGH (research-gate RESOLVED)
- Gusto dev.gusto.com / docs.gusto.com; Intuit QuickBooks; ADP developers.adp.com (gated partner + OAuth+client-cert, Workers v2 / Pay Data Input v1) — MEDIUM-HIGH
- DATEV developer.datev.de + DATEV-Community — LODAS ASCII-only, L&G has Lohnimportdatenservice REST — MEDIUM
- `@hono/zod-openapi` npm + hono.dev — `getOpenAPI31Document()`/`doc31()` for 3.1 — HIGH
- Speakeasy/Stainless/Fern comparison (speakeasy.com, stainless.com, buildwithfern.com, Feb 2026) — MEDIUM (vendor-authored, cross-checked)
- Mintlify vs Scalar (speakeasy.com docs-vendor, openalternative.co) — MEDIUM
- SSRF: OWASP Node SSRF Prevention + `request-filtering-agent` (azu) GitHub/npm 3.2.0 — HIGH
- Stripe Treasury OutboundPayment docs (docs.stripe.com, dated 2026-04-22) — HIGH
- Zapier CLI / n8n community node / Make app toolchains (n8n.io, platform docs) — MEDIUM

---
*Stack research for: v7.0 GTM Expansion (US cross-border + workforce + integration marketplace)*
*Researched: 2026-06-07*
