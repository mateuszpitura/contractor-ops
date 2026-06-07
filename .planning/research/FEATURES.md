# Feature Research

**Domain:** v7.0 GTM Expansion — US cross-border tax/payments/classification + Workforce (employee-lite) management + Integration Marketplace (public API + webhooks)
**Researched:** 2026-06-07
**Confidence:** HIGH on US tax/payment/marketplace facts (verified vs IRS / NACHA / Personio dev docs, June 2026); MEDIUM on per-market HR statutory detail (training-data + LOCAL-ONLY legal-deferred posture; flagged per-jurisdiction).

> Scope note: v7.0 is a **subsequent milestone** on a mature platform. This file categorizes the NEW v7.0 surface only and ties each cluster to the shipped v1–v6 capability it composes with. Existing features (contractor lifecycle, RBAC, contracts, workflow engine, invoices, approvals, payment-export factory, classification engine, e-invoicing, multi-currency, integration framework, portal, audit log, feature-flags, lint-guards) are NOT re-specified — only referenced as dependencies.

> **Backlog-correcting findings (load-bearing — must reach roadmap):**
> 1. **1099-NEC/MISC threshold is $2,000, not $600, for payments after 2025-12-31** (OBBBA, signed Jul 2025; inflation-indexed from 2027). Backlog `US-FORM-04` text "($600 USD-equivalent)" is stale. Ship a **config-driven threshold** ($2,000 TY2026, $600 legacy for pre-2026 corrections, indexed table going forward) — never a hard-coded constant.
> 2. **IRS FIRE permanently decommissions 2026-12-31.** TY2025 is the last FIRE year; **all TY2026 returns (filed early 2027) MUST use IRIS** (XML, new IRIS-specific TCC, ~45-day enrollment). Backlog `US-FORM-05` framing of "FIRE primary / IRIS fallback, decommission ~2027–2028" is **inverted** — for the TY in which v7.0 ships year-end, **IRIS is mandatory, FIRE is dead**. Closes the "IRIS vs FIRE cutover" research gate (decision #5 / checklist line 312).
> 3. **1099-K threshold reverted to $20,000 + 200 transactions** (OBBBA, retroactive to 2025). Backlog `US-CLASS-03` "$5K for 2026, then $600" is stale; informational tracker should watch $20,000 AND >200 transactions.
> 4. **Same-Day ACH per-payment cap = $1,000,000** today; rises to $10M only on 2027-09-17. So the Fedwire-wire branch (`US-PAY-04`) is genuinely needed for any cross-border payout > $1M until then — keep it in scope.
> 5. **Personio API research gate closed** (checklist line 313 / decision #7): v2 = **200 req/min per credential**, attribute-scoped credentials (unpermitted fields silently omitted — not an error), proprietary client-credentials bearer (NOT RFC-6749 — standard OAuth libs need modification), v1 Attendances/Projects deprecate 2026-07-31. Build the adapter against **API v2** with its own token client, not a generic OAuth2 client.

## Feature Landscape

### Table Stakes (Users Expect These)

Practitioners in each theme assume these exist; absence = product reads as a toy.

| Feature | Why Expected | Complexity | Notes / Dependency |
|---------|--------------|------------|-------------------|
| **W-9 collection wizard** (US-FORM-01) — TIN + entity type (SP/C/S/Partnership/LLC-classification/Trust) + backup-withholding flag, signed, audit-stamped | Any US payer must hold a W-9 before first payment or apply 24% backup withholding | MEDIUM | New wizard on existing `Contractor`; reuse v2.0 e-sign + audit log |
| **W-8BEN / W-8BEN-E collection** (US-FORM-02) — treaty country, treaty article, FTIN, Ch.3/Ch.4 status, certifications, 3-yr validity expiry | Foreign payee of US-source income; without it 30% statutory withholding applies | MEDIUM | Treaty-article auto-populate (US-LOC-03) is the differentiating layer; base form is table stakes |
| **TIN matching against IRS** (US-FORM-03) — name/TIN pair check, mismatch escalation, B-notice path | Filing a 1099 with a bad TIN triggers CP2100/972CG penalties; everyone validates pre-file | MEDIUM | IRS TIN Matching (interactive/bulk) via e-Services; 24h cache + admin escalation. Note: requires IRS e-Services account enrollment per org/agent |
| **1099-NEC year-end generation + corrections** (US-FORM-04) — per-recipient, **$2,000 config threshold**, CORRECTED flow, recipient copy by Jan 31, immutable archive | Statutory year-end obligation; corrections are routine | HIGH | Threshold must be config table, not constant (finding #1). Reuse PDF/archive + audit-immutable patterns from v5.0 SDS/DRV bundles |
| **IRIS e-file submit + ack loop** (US-FORM-05) — XML build, IRIS TCC, transmit, real-time validation, ack/error parse, targeted record correction | TY2026+ e-file is mandatory at 10+ aggregate returns; manual paper is not credible | HIGH | **IRIS-first** (finding #2). Mirror v4.0 gov-API framework (cert/token auth, retry, rate-limit, audit). FIRE only as read-path for pre-2026 legacy corrections |
| **1042-S for US-source pay to foreign contractors** (US-FORM-06) — treaty/Ch.3 withholding rate, recipient copy, IRIS file | Complement to W-8; the foreign-payee side of year-end | HIGH | Treaty-rate table (US-LOC-02) feeds this; same IRIS transmit path |
| **ACH NACHA file (PPD/CCD/CTX)** (US-PAY-01) — correct SEC code per payee type, balanced file, addenda for CTX/CCD | Standard US payout rail; banks reject malformed NACHA | MEDIUM | PPD = pay to an individual's personal account; CCD = to a business account; CTX = business + structured addenda (remittance). Reuse v4.0/v5.0 payment-export factory (BACS/SWIFT) — same shape, new format |
| **USD as first-class settlement currency** (US-PAY-02) — per-org default, rate sourcing, settlement-currency choice on cross-border | US org expects USD-native, not "EUR with a converter" | LOW–MEDIUM | Multi-currency engine exists since v4.0; this is config + UX, not new core |
| **Fedwire wire export** (US-PAY-04) — for payouts above Same-Day ACH cap or when same-day settlement required | $1M Same-Day ACH cap until 2027-09-17 (finding #4); high-value cross-border needs wire | MEDIUM | Export-format only (LOCAL-ONLY posture — we generate the instruction, bank executes) |
| **US contractor profile fields** (US-FIELD-01..04) — EIN validator, SSN PII-masked (last-4, full behind RBAC), USPS address format, dispatched component | Parity with existing PL/UK/DE/Gulf field packs | LOW–MEDIUM | Reuse `CountryComplianceSection` dispatch (v5.0) + RBAC PII gate pattern |
| **`en-US` locale full parity** (US-LOC-01) | A US buyer seeing en-GB date/£ formatting reads as wrong-market | LOW | Extends i18n; parity check via lint-guards i18n-parity guard |
| **Worker discriminated union (Contractor\|Employee)** (WORKER-01..05) — non-breaking `workerType` enum default CONTRACTOR, router split, RLS preserved, new HR roles, flag-gated | Foundation; everything in Theme B sits on it. Zero-migration for v1–v6 orgs is the table-stakes bar | HIGH | **Sole hard serialization point.** Reuse v5.0 classification flag-off pattern (render-tree removal + tRPC FORBIDDEN) for `workforce-employees` |
| **Per-market employee field packs** (EMP-REG-PL/DE/UK/US/AE/SA-01) — PESEL+ZUS / Steuer-IdNr+Lohnsteuerklasse+ELStAM / NI+PAYE+tax-code+student-loan / SSN+W-4+state-withholding / Emirates-ID+WPS / Iqama+GOSI | An HR registry that can't hold the legally-required identifiers is unusable in-market | MEDIUM (×6) | PL/DE/UK validators partly exist (SV-Nummer, USt-IdNr, NI). Gulf composes with v6.0 F3. US state withholding = 10 states + free-text (locked) |
| **Akta osobowe / personnel file A/B/C/D + DE Personalakte + UK file + US I-9** (AKTA-01..04) — per-section RBAC, doc-classification-at-upload | PL KP §94 mandates the 4-part structure; equivalent expected per market | MEDIUM | Reuse v6.0 F1 compliance-document engine for storage/expiry; add section taxonomy + per-section ACL |
| **Per-jurisdiction retention engine** (AKTA-02) + RODO erasure with statutory-exemption layer (AKTA-03) | PL 10yr (post-2019) / 50yr legacy; DE 10yr tax + up to 30yr accident; UK 6yr (7 financial); US I-9 3yr-post-hire-or-1yr-post-term | MEDIUM | Reuse v6.0 expiry-cascade + soft-delete; erasure must honor statutory holds and cite the statute on blocked sections. **Legal-deferred annotation required** |
| **Leave-balance engine + request workflow + team calendar** (LEAVE-01..03) — PL 20/26-day (tenure), DE BUrlG min, UK 5.6 weeks, US per-state (no federal min), Gulf MOL/MHRSD | Leave is the #1 thing employees self-serve in any HRIS | MEDIUM | Request workflow REUSES v1.0 approval-chain engine. **e-ZLA/eAU auto-pull deferred to v7.5 — manual sick entry only in v7.0** |
| **KP-grade employee time tracking** (TIME-EMP-01..03) — overtime (PL 50/100%, DE §3 ArbZG ceiling, UK WTR opt-out, US FLSA >40h), night/weekend premium, working-time alerts, PL ewidencja §149 report (3-yr retain) | Employment time tracking ≠ B2B billing time tracking (v2.0); statutory ewidencja is mandatory in PL | MEDIUM–HIGH | Differentiated from v2.0 Clockify/Jira B2B tracking; alerts are the compliance hook |
| **Per-market on/offboarding statutory paperwork** (EMP-ON-01, EMP-OFF-01) — PL (badania/PIT-2/PPK/świadectwo, ZUS ZWUA, PIT-11) / DE (Personalfragebogen, Sozialversicherungsausweis, Arbeitszeugnis, Lohnsteuerbescheinigung) / UK (P45/P46, pension auto-enrol, P11D) / US (W-4, I-9+E-Verify hook, final paycheck per state, COBRA, W-2 by Jan 31) | The statutory checklist is the reason HR buys the tool over a spreadsheet | HIGH | Reuse v1.0 workflow templates; **EMP-OFF-01 composes with v6.0 F4 offboarding hardening — extend, don't duplicate** (decision: EMP-OFF-02). Legal-deferred annotations |
| **Payroll integration adapters — export shape (we push, they file)** (PAYROLL-PL/DE/UK/US-01) — Symfonia/Comarch/Enova / DATEV+Sage / Sage+BrightPay+Moneysoft / Gusto+QuickBooks+ADP | Customers already run a payroll engine; the table-stakes ask is "feed my existing one," not "replace it" | MEDIUM (per adapter) | **Export adapters only — NOT a payroll engine (anti-feature).** DATEV = ASCII import (LODAS/Lohn) + DATEVconnect where org subscribed; UK = RTI-compatible FPS/EPS XML shape. US locked to exactly 3 adapters |
| **HRIS two-way sync — source-of-truth split** (HRIS-SYNC-01..06) — Personio + BambooHR, registry fields owned by HRIS, financial/compliance owned by Contractor Ops, single-HRIS-per-org | ~50–80% of EU SMBs already keep their directory in Personio; sync is the wedge | HIGH | Reuse v2.0 integration framework. **Personio = API v2, 200 req/min, attribute-scoped, proprietary bearer** (finding #5). One HRIS per org prevents 3-way merge hell (HRIS-SYNC-06) |
| **Employee + manager self-service portal** (EMP-PORTAL-01..04) — pay stubs (from payroll integ), leave balance/request, doc upload, akta personal view; manager: reports' leave/time approvals, expiry flags | Self-service is the per-seat value story; managers won't email-approve leave | MEDIUM | Extends v2.0 portal (magic-link, subdomain). Portal i18n adds en-US to existing en/pl/de/ar-RTL |
| **HR dashboard widgets** (HR-DASH-01..05) — headcount cuts, vacation-utilization, doc-expiry, probation-end watchlist, Saudization/Emiratisation rollup | An HR landing page is expected; widgets compose existing engines | LOW–MEDIUM | HR-DASH-03 reuses v6.0 F1; HR-DASH-05 reuses v6.0 F3 |
| **Public REST API over core entities** (INTEG-API-01..04) — Zod-validated, tenant-scoped via API key, **cursor pagination**, standardized filter/sort, OpenAPI 3.1, `/v1/` base, `Sunset` header (RFC 8594) | A credible API product = predictable list semantics + machine-readable spec + a versioning promise | MEDIUM–HIGH | Reuse `apps/public-api` (Hono). Cursor (not offset) pagination is the practitioner expectation for stable iteration |
| **API key mgmt + scopes + rate limits** (INTEG-AUTH-01..05) — hashed storage, prefix display (`co_live_…`), per-scope least-privilege, Redis token-bucket per tier, audit `apiKeyId`+`sourceIp`+`UA` | Table stakes for any key-based API; scopes are non-negotiable for B2B trust | MEDIUM | Reuse v3.0 `writeAuditLog`; Upstash Redis already in stack. Hash with strong KDF, never store raw |
| **Outbound webhooks — event catalog + HMAC + idempotency + retry/DLQ + replay protection** (INTEG-WEBHOOK-01..06) — typed event catalog, `X-CO-Signature t=,v1=` (Stripe-style), QStash backoff, DLQ table, 5-min replay window | This is THE comparison checklist reviewers run; missing any one item = "not production-grade" | HIGH | Reuse v2.0 QStash. Event payloads = Zod-generated discriminated union. `compliance_doc.*` events compose with v6.0 F1 band state machine |
| **SSRF guard + HTTPS-only + dispatch rate cap** (INTEG-SEC-01..03) — RFC1918/loopback/link-local/metadata block, **DNS-rebind protection (resolve-then-verify-at-connect)**, per-sub fanout cap | Any outbound-webhook product that lets users set a URL MUST block internal targets; this is a known CVE class | MEDIUM | Resolve hostname at dispatch AND re-verify resolved IP immediately before connect — the DNS-rebind step is the part naive implementations miss |
| **Zapier / n8n / Make listings** (INTEG-ZAPIER/N8N/MAKE) — trigger surface (instant via webhooks + polling fallback w/ dedup), action surface, search/lookup, marketplace review | "Does it connect to my tools?" is a bake-off question; 3 listings ≈ 9,000 apps on one backend | MEDIUM (×3) + review latency | Zapier review checks homepage/ToS/privacy + sandbox bundle test; expect 2–4wk Zapier, ~1–2wk Make. **Instant triggers need our outbound webhooks (INTEG-WEBHOOK) live first** |
| **Developer portal + SDKs + status page** (INTEG-DX-01..04) — OpenAPI reference site, TS+Python SDKs, Postman/Insomnia, public status, sandbox/free-tier | A public API without docs+SDK+status reads as abandonware | MEDIUM | SDKs auto-generated from OpenAPI; status page reuses v2.0 health-monitoring |

### Differentiators (Competitive Advantage)

Where v7.0 wins the bake-off. Aligns with PROJECT.md core value ("deepest compliance depth + widest integration reach") and the "Bill.com-for-cross-border-without-Deel-EOR-markup" thesis.

| Feature | Value Proposition | Complexity | Notes / Dependency |
|---------|-------------------|------------|-------------------|
| **Cross-border tax-treaty engine** (US-LOC-02/03) — auto rate + W-8BEN treaty-article auto-populate from contractor home jurisdiction (PL/DE/UK/UAE/KSA/IE/NL) | Nobody else combines US 1042-S withholding logic WITH KSeF/ZATCA/Peppol/XRechnung/IR35/Scheinselbständigkeit in one tool. This is the wedge | HIGH | Extends v5.0 reverse-charge engine pattern; feeds US-FORM-06 |
| **US classification across federal + CA-ABC + §530** (US-CLASS-01..04) — federal common-law / economic-realities, **CA ABC (AB5) as stricter default for CA workers**, §530 safe-harbor flagger, Determination Letter PDF | UK IR35 + DE Scheinselbständigkeit already shipped (v5.0); adding US makes "one classification engine, three+ jurisdictions" a real moat vs single-market tools | HIGH | Extends v5.0 `packages/api/src/classification/`. CA AB5 watchlist (US-CLASS-02) auto-applies stricter test + logged admin override. Determination Letter mirrors v5.0 SDS (Phase 59). Likely needs `/gsd:ai-integration-phase` |
| **CA AB5 watchlist auto-flag** (US-CLASS-02) — engagement touches a CA worker → stricter ABC test applied by default, override requires logged reason | Misclassification in CA carries the steepest penalties; pre-empting it is a sales line | MEDIUM | Composes with classification engine; reuses v5.0 economic-dependency-alert scan pattern |
| **One Worker model across contractors AND employees** (Theme B foundation) | "Run your whole workforce in one tool, payroll stays with your accountant" — flips framing from "invoice tool next to Personio" to the workforce platform | HIGH | The strategic differentiator; everything B-side depends on WORKER-01 |
| **9,000 apps via 3 listings on one backend** (Theme C) | Neutralizes Rippling's "600+ integrations" without per-app adapter buildout a solo-dev can't scale | HIGH (cumulative) | One public-API+webhook backend → Zapier(7000+)/Make(1700+)/n8n(500+). Tier-gated drives upsell (Starter read-only / Pro read+write / Enterprise unlimited) |
| **Per-subscription PII redaction (default-on)** (INTEG-WEBHOOK-07) — strip PESEL/SSN/NI/Steuer-IdNr/Emirates-ID/Iqama/email/phone unless `include_pii` opt-in | RODO/GDPR-defensible webhooks are rare in the SMB API space; a compliance-positioned product gets credit for it | MEDIUM | Reuse v6.0 default-redact logger philosophy at the dispatch boundary |
| **API-key leak alarm** (INTEG-SEC-05) — alert if a key shows >3 distinct source IPs in 24h | Proactive supply-chain/credential-leak posture beyond table stakes | LOW–MEDIUM | Composes with the `sourceIp` audit field (INTEG-AUTH-05) |
| **Modern Treasury / Stripe Treasury programmatic ACH** (US-PAY-03) — opt-in fully-automated payout for orgs that want it | Moves from "export a file" to "press pay" — premium tier hook | MEDIUM | Opt-in via v2.0 integration framework; LOCAL-ONLY orgs keep file-export path |
| **Plaid identity at onboarding** (US-PAY-05) — bank-account verification anti-fraud | Reduces misdirected-payout risk on cross-border; trust signal | MEDIUM | Reuse v2.0 OAuth credential-store pattern |

### Anti-Features (Commonly Requested, Often Problematic)

These are the **explicit v7.0 out-of-scope items** from the backlog. Documented here so the roadmap respects them and the team has the ready answer when asked.

| Feature | Why Requested | Why Problematic | Alternative (what we do) |
|---------|---------------|-----------------|--------------------------|
| **Own payroll engine (PL/DE/UK/US)** | "Just calculate the net pay for me" | 10–25yr incumbents (Symfonia/DATEV/Sage/Gusto); per-market tax-calc liability is bottomless for a solo dev | **Export adapters only** — we push structured data, the engine files. Revisit v8.0 only if adapter friction proves dispositive |
| **EOR / AOR (employer of record)** | "Hire in a country where I have no entity" | Deel/Remote territory; legal-entity + employment-liability business, not software | Out per v1.0 charter; local workers only |
| **US-domestic Bill.com clone (AP automation)** | "Do my US vendor payments too" | Market already won; head-on fight against entrenched incumbent | **Cross-border-first** — the narrow space Bill.com/Deel each miss |
| **ATS / recruiting / performance reviews / OKRs** | "It's HR-adjacent" | Personio/Lattice/15Five territory; unbounded scope | Out per charter; workforce-ops only, not talent-management |
| **Full 50-state US withholding matrix** | "I have a worker in Wyoming" | 50× statutory upkeep for a feature most orgs touch in <10 states | **10 highest-pop states + free-text fallback** (locked); full matrix → v7.5/v8.0 on geography |
| **Inbound user-defined webhook ingestion** | "Let me POST events INTO Contractor Ops" | Arbitrary-source ingestion = injection/auth surface; integration-suite complexity | **Outbound-only** in v7.0. Inbound reserved for vetted partners (KSeF/InPost/Storecove). User-defined inbound → v8.0+ |
| **OAuth 2.0 provider mode (us as IdP for 3rd parties)** | "Let users log into my app with Contractor Ops" | Full OAuth-server surface + token lifecycle; not needed for key-based API | **API-key auth only** in v7.0; OAuth-provider mode → v8.0 if marketplace partners require |
| **Arbitrary field-level HRIS merge / 3-way sync** | "Sync everything both ways" | Conflict-resolution hell; corrupts financial/compliance source-of-truth | **Source-of-truth split** (HRIS-SYNC-05) + **one HRIS per org** (HRIS-SYNC-06) |
| **HMRC RTI direct submission** | "File PAYE for me from here" | RTI (FPS/EPS, year-end, P11D, P60) warrants its own slice | **Deferred to v7.5** (PAYROLL-UK-02); v7.0 emits RTI-compatible FPS/EPS XML for the org's own payroll tool |
| **PL e-ZLA / DE eAU sick-note auto-pull** | "Pull the sick note automatically" | Per-org cert (Profil Zaufany / certyfikat) / per-practice KIM-Adresse — operational friction not per-SaaS | **Deferred to v7.5** (LEAVE-04/05); v7.0 ships manual sick-leave entry |
| **US payroll tax filing (940/941 + state)** | "File my payroll taxes" | Gusto/QuickBooks territory; tax-filing liability | We push data, they file |
| **Workday / Paychex / Rippling-payroll adapters** | "I use Workday" | Long tail; 3 US adapters cover the SMB target | **3 adapters locked** (Gusto+QuickBooks+ADP); rest v8.0+ on customer pull |
| **More bespoke native per-app adapters** | "Add a native X integration" | Solo-dev can't scale per-app adapters vs Rippling | **Theme C marketplace listings** serve the long tail (~9,000 apps) |

## Feature Dependencies

```
[Existing v1–v6 platform: Contractor model, RBAC, workflow engine, approval chains,
 payment-export factory, classification engine, e-invoicing, multi-currency, integration
 framework, portal, audit log, feature-flags, lint-guards, v6.0 F1 compliance-doc /
 F3 Gulf / F4 offboarding]
        │
   ┌────┴───────────────────────────────────────────────────────────────┐
   │                          │                                          │
 THEME A (parallel)         THEME B                                    THEME C (parallel)
 uses existing Contractor   ┌─ WORKER-01 (hard serialization) ─┐       ┌─ INTEG-API-01 (foundation) ─┐
                            │                                  │       │                              │
 US-FORM-01 (W-9) ─┐        ├─→ EMP-REG-{PL,DE,UK,US,AE,SA}-01  │       ├─→ INTEG-AUTH-01..05
 US-FORM-02 (W-8) ─┤        │     └─→ AKTA-01..04               │       │     (keys+scopes+ratelimit)
   ├─→ US-FORM-03 (TIN match)│           ├─→ LEAVE-01..03        │      ├─→ INTEG-WEBHOOK-01..07
   ├─→ US-FORM-04 (1099-NEC) │           ├─→ TIME-EMP-01..03     │      │     (needs INTEG-AUTH + QStash v2.0)
   │     └─→ US-FORM-05 (IRIS efile)     ├─→ EMP-ON/OFF-01       │      ├─→ INTEG-SEC-01..05
   │           └─→ US-FORM-07 (state)    │     (EMP-OFF composes  │      │     (SSRF; gates webhooks)
   ├─→ US-FORM-06 (1042-S)               │      v6.0 F4)          │      ├─→ INTEG-ZAPIER/N8N/MAKE
   │     ↑ needs US-LOC-02 treaty table  │           └─→ PAYROLL-{PL,DE,UK,US}-*  │  (instant triggers
 US-PAY-01 (NACHA) ←uses payment-export  │           └─→ HRIS-SYNC-01..06         │   need INTEG-WEBHOOK)
   ├─→ US-PAY-02 (USD) ←multi-currency    │                 ↑ Personio API v2     └─→ INTEG-DX-01..04
   ├─→ US-PAY-03 (Modern Treasury)         │           └─→ EMP-PORTAL-01..04            (portal+SDK+status)
   ├─→ US-PAY-04 (Fedwire)                 │                 ↑ extends v2.0 portal
   └─→ US-PAY-05 (Plaid)                   │           └─→ HR-DASH-01..05
 US-CLASS-01..04 ←extends v5.0 engine      │                 ↑ HR-DASH-03→v6.0 F1; -05→v6.0 F3
 US-FIELD-01..04 ←CountryComplianceSection └─ EMP-REG-{AE,SA} compose v6.0 F3
 US-LOC / US-INFRA (us-east-1)
```

### Dependency Notes

- **All Theme B requires WORKER-01:** the discriminated-union model is the only hard serialization point in v7.0. Nothing employee-side starts before it. Must be a zero-data-migration extension of `Contractor` (`workerType` default CONTRACTOR) — verified on staging snapshot of largest org per the audit gate.
- **US-FORM-05 (IRIS) requires US-FORM-04 (1099-NEC build):** you must generate the return before transmitting it. IRIS is **mandatory for TY2026** — sequence the IRIS path as primary, not a FIRE fallback (finding #2).
- **US-FORM-06 (1042-S) + US-LOC-02 (treaty table) are coupled:** the withholding rate on a 1042-S comes from the treaty table; build the table before/with 1042-S.
- **US-PAY-01 (NACHA) enhances the existing payment-export factory:** same factory shape as BACS (v5.0) / SWIFT pain.001 (v4.0) — new format, not new abstraction. Reuse the Phase 51 export abstraction.
- **US-CLASS-* extends the shipped v5.0 classification engine** rather than a new engine — UK IR35 + DE Scheinselbständigkeit + US (federal/CA-ABC/§530) under one `classification/` package.
- **INTEG-WEBHOOK requires INTEG-AUTH + INTEG-SEC:** webhooks dispatch under API-key scopes (`webhooks:manage`) and must pass the SSRF guard before any outbound connect. Build auth + SSRF before turning on dispatch.
- **Zapier/Make instant triggers require INTEG-WEBHOOK live:** instant (push) triggers ARE our outbound webhooks; polling triggers are the fallback. Marketplace listings depend on the webhook layer + the public API both being stable.
- **EMP-OFF-01 composes with — does not duplicate — v6.0 F4** (IP verification, KT templates, IdP deprovisioning). EMP-REG-{AE,SA} + HR-DASH-05 compose with v6.0 F3 Gulf polish. HR-DASH-03 + AKTA storage compose with v6.0 F1 compliance-doc engine.
- **HRIS-SYNC depends on v2.0 integration framework AND on the per-market registry fields (EMP-REG-*)** existing to map into. Personio adapter targets **API v2** (finding #5).

## MVP Definition

> "MVP" here = the minimum coherent slice per theme that satisfies the v7.0 pre-prod audit gate. v7.0 is not itself an MVP product — it is net-new surface on a GA platform.

### Launch With (the v7.0 audit-gate floor)

- [ ] **WORKER-01..05** — foundation; zero-downtime migration verified on largest-org snapshot. Without it, no Theme B.
- [ ] **US-FORM-01..06 + US-FORM-03 TIN match** — full intake→TIN→generate→**IRIS** file→ack→recipient-PDF loop (audit gate requires E2E). $2,000 config threshold.
- [ ] **US-PAY-01 (NACHA) + US-PAY-02 (USD)** — at minimum the file-export rail; US-PAY-04 Fedwire for >$1M.
- [ ] **US-CLASS-01..04** — federal/CA-ABC/§530 + Determination Letter (the differentiator that justifies the US add-on).
- [ ] **EMP-REG (all 6 markets) + AKTA-01..03 + LEAVE-01..03 (manual sick) + EMP-ON/OFF-01** — happy-path per market is an explicit gate criterion.
- [ ] **≥1 payroll adapter per market** + **HRIS-SYNC Personio AND BambooHR two-way (conflict tests pass)** — gate requires both adapters.
- [ ] **INTEG-API-01..04 + INTEG-AUTH-01..05 + INTEG-WEBHOOK-01..07 + INTEG-SEC-01..05** — the full public-API + webhook + SSRF E2E is a gate criterion.
- [ ] **All 3 marketplace listings reachable end-to-end** (Zapier listed, n8n npm-installable, Make approved) + **dev portal (OpenAPI, TS+Python SDK, Postman, status page)**.

### Add After Validation (v7.5)

- [ ] **PAYROLL-UK-02** — HMRC RTI direct submission (own slice).
- [ ] **LEAVE-04 / LEAVE-05** — PL e-ZLA / DE eAU auto-pull (cert/KIM-provisioning friction resolved).
- [ ] **Full 50-state US withholding matrix** — expand from 10 states + free-text on US customer geography.

### Future Consideration (v8.0+)

- [ ] **Own payroll engine** — only if adapter friction proves dispositive.
- [ ] **Workday / Paychex / Rippling-payroll adapters** — on customer pull.
- [ ] **OAuth-provider mode + inbound user-defined webhooks** — if marketplace partners require end-user flows.

## Feature Prioritization Matrix

| Feature cluster | User Value | Implementation Cost | Priority |
|-----------------|------------|---------------------|----------|
| WORKER-01..05 (Theme B foundation) | HIGH | HIGH | P1 |
| INTEG-API-01 (Theme C foundation) | HIGH | MEDIUM | P1 |
| US-FORM intake→IRIS→ack loop | HIGH | HIGH | P1 |
| US-PAY NACHA + USD | HIGH | MEDIUM | P1 |
| US-CLASS (fed/CA-ABC/§530 + letter) | HIGH | HIGH | P1 (US differentiator) |
| EMP-REG ×6 + AKTA + LEAVE + on/offboarding | HIGH | HIGH | P1 |
| INTEG-AUTH + WEBHOOK + SEC | HIGH | HIGH | P1 |
| HRIS-SYNC Personio + BambooHR | HIGH | HIGH | P1 (workforce wedge) |
| Marketplace listings + dev portal/SDK | HIGH | MEDIUM (+review latency) | P1 (audit gate) |
| Payroll adapters (≥1/market) | MEDIUM-HIGH | MEDIUM (×N) | P1 floor / P2 breadth |
| Treaty engine + 1042-S | HIGH | HIGH | P1 (cross-border wedge) |
| US-PAY-03 Modern Treasury / US-PAY-05 Plaid | MEDIUM | MEDIUM | P2 (opt-in premium) |
| EMP-PORTAL + HR-DASH | MEDIUM-HIGH | MEDIUM | P1-P2 |
| TIME-EMP (KP-grade) | MEDIUM | MEDIUM-HIGH | P2 |
| US-FORM-07 per-state 1099 (CF/SF) | MEDIUM | MEDIUM | P2 |
| PII-redaction / key-leak alarm | MEDIUM | LOW-MEDIUM | P1 (compliance posture, cheap) |

**Priority key:** P1 = required for v7.0 audit gate / launch. P2 = ships within v7.0 but later phase / can degrade gracefully. P3 = v7.5+.

## Competitor Feature Analysis

| Feature | Deel | Bill.com | Personio / BambooHR | Rippling | Our Approach |
|---------|------|----------|---------------------|----------|--------------|
| Cross-border contractor pay | yes (EOR markup $29–49/contractor) | no — US-domestic | no | partial | Cross-border-first, no EOR markup |
| Multi-market e-invoice compliance (KSeF/ZATCA/Peppol/XRechnung) | shallow | no | no | no | **Deepest depth** (shipped v4–v6) |
| US 1099/1042-S + IRIS e-file | yes | yes (US-domestic) | no | yes | IRIS-first, treaty-aware |
| Multi-jurisdiction classification (IR35/Scheinselbst./AB5) | partial | no | no | partial | **One engine, 3+ jurisdictions** |
| Employee registry + akta/Personalakte + leave | no (EOR-only) | no | yes (their core) | yes | Employee-lite + payroll-integration (not engine) |
| Payroll | yes (EOR) | no | yes (some markets) | yes | **Adapters only — push, don't file** |
| Integration count | moderate | moderate | moderate | **600+** | **~9,000 via 3 marketplace listings** |
| Public API + webhooks | yes | yes | yes | yes | Tier-gated, PII-redacted, SSRF-hardened |

## Sources

- IRS / OBBBA 1099 thresholds (verified June 2026): [Calibre CPA — 2026 Reporting Changes](https://calibrecpa.com/tax-regulation-reporting/2026-reporting-changes-for-1099-forms/), [OnPay — OBBBA 1099 threshold](https://onpay.com/insights/1099-reporting-threshold-updates/), [Littler — Tax Bill Changes 1099 Thresholds](https://www.littler.com/news-analysis/asap/tax-bill-changes-1099-reporting-thresholds), [IRS Pub 1099 (2026)](https://www.irs.gov/publications/p1099)
- IRS FIRE → IRIS transition (FIRE decommissions 2026-12-31; TY2026 IRIS-mandatory): [Sovos — FIRE Sunset / IRIS Transition](https://sovos.com/blog/trr/irs-fire-system-iris-transition/), [Ice Miller — Retirement of FIRE, Mandatory IRIS](https://www.icemiller.com/thought-leadership/retirement-of-irs-fire-system-and-mandatory-transition-to-iris), [IRS FIRE page](https://www.irs.gov/e-file-providers/filing-information-returns-electronically-fire)
- 1099-K threshold reverted to $20,000 + 200 transactions: [IRS FAQ — 1099-K threshold reverts to $20,000](https://www.irs.gov/newsroom/irs-issues-faqs-on-form-1099-k-threshold-under-the-one-big-beautiful-bill-dollar-limit-reverts-to-20000), [1099online — Form 1099-K Threshold 2026](https://www.1099online.com/blog/form-1099-k-threshold/)
- Same-Day ACH limit ($1M now → $10M 2027-09-17): [Nacha — Same Day ACH limit to $10M](https://www.nacha.org/news/same-day-ach-payment-limit-increase-10-million), [Nacha — Same Day ACH](https://www.nacha.org/same-day-ach)
- Zapier partner program / trigger model: [Zapier Partner Program](https://zapier.com/developer-platform/partner-program), [Zapier — deduplication](https://docs.zapier.com/platform/build/deduplication), [Zapier — How triggers work](https://help.zapier.com/hc/en-us/articles/8496244568589-How-Zap-triggers-work)
- Personio API v2 (200 req/min, attribute-scoped, proprietary bearer, v1 deprecation 2026-07-31): [Personio Developer — Getting Started](https://developer.personio.de/docs/getting-started-with-the-personio-api), [Personio Developer — Authentication](https://developer.personio.de/reference/authentication), [Stitchflow — Personio API Guide](https://www.stitchflow.com/user-management/personio/api)
- Internal authoritative inputs: `.planning/milestones/v7.0-BACKLOG.md` (locked decisions, dependency graph, out-of-scope), `.planning/PROJECT.md` (positioning, shipped v1–v6 capability ledger)

---
*Feature research for: v7.0 GTM Expansion (US cross-border + Workforce management + Integration Marketplace)*
*Researched: 2026-06-07*
