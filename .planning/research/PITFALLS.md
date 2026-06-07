# Pitfalls Research

**Domain:** v7.0 GTM Expansion — US cross-border tax+payments (Theme A), Workforce/employee management + HRIS sync (Theme B), public REST API + outbound webhook marketplace (Theme C) added to an existing multi-tenant, multi-region contractor-ops SaaS
**Researched:** 2026-06-07
**Confidence:** HIGH on architecture-grounded pitfalls (verified in-tree); HIGH on IRS FIRE→IRIS cutover and OWASP API 2023 (official + multiple sources); MEDIUM on Personio rate-limit/pagination exact numbers (community + changelog, not contract); MEDIUM on NACHA field-level rules (bank spec PDFs, not a single canonical lib)

> Scope discipline: these are mistakes specific to ADDING v7.0 to THIS system — the `withTenantScope` query-extension + `globalModels` allow-list (`packages/db/src/tenant.ts`), `SUPPORTED_REGIONS = ['EU','ME']` hardcode (`packages/db/src/region.ts`), the **inbound-only** webhook dispatcher (`packages/integrations/src/services/webhook-dispatcher.ts`), `apiKeyTenantProcedure` (`packages/api/src/middleware/api-key-auth.ts`) which today gates on `requireTier('ENTERPRISE')` and does NOT yet enforce per-scope, the HMAC-SHA256 (not bcrypt) `OrganizationApiKey` store (`packages/api/src/services/api-key-service.ts`), the `@contractor-ops/lint-guards` schema/scope/i18n-parity/logger guards, and the boot-time flag-signoff gate (`packages/feature-flags/src/registry.ts`). Generic "validate input" advice is omitted.

---

## Critical Pitfalls

### Pitfall 1: New region `us-east-1` not added to `SUPPORTED_REGIONS` → every US-org request throws at the DB boundary

**What goes wrong:**
`packages/db/src/region.ts` hardcodes `SUPPORTED_REGIONS = ['EU', 'ME']` and `getRegionalClient()` THROWS `Unsupported data region` for anything else. `api-key-auth.ts` and the staff tenant middleware bind the regional client from `organization.dataRegion`. Create a US org with `dataRegion='US'` (or `us-east-1`) and every staff/portal/public-API request for that org dies before the handler runs. Worse: a half-done rename (`US` in the schema enum, `us-east-1` in the env map) leaks a silent mismatch where `preWarmRegionalClients()`'s `try/catch` swallows the missing client and the failure only surfaces under load.

**Why it happens:**
Region routing was built for exactly two regions in v4.0; the union, `REGION_ENV_MAP`, the Prisma `DataRegion` enum, regional R2 bucket selection, and `preWarmRegionalClients()` are four separate places that must change atomically. A third region looks like a one-line change but is actually four.

**How to avoid:**
- Single source of truth: extend `SUPPORTED_REGIONS` + `REGION_ENV_MAP` + Prisma `DataRegion` enum + R2 bucket map in ONE phase (US-INFRA-01), with a test asserting the union and Prisma enum stay in lockstep.
- Add `DATABASE_URL_US` to `.env.example` AND the package env schema (CLAUDE.md monorepo rule); add a check that `preWarmRegionalClients()` does NOT silently skip US in production.
- New-org region-assignment rule must be explicit (US billing → `US`); never default-to-EU for US tax orgs (data-residency — Pitfall 9).

**Warning signs:**
Integration test for a US org returns `Unsupported data region`; `preWarmRegionalClients` log shows EU+ME only; US-org R2 archive writes land in the EU bucket.

**Phase to address:** US-INFRA-01 (region foundation) — must land before any US-FORM / US-PAY / EMP-REG-US phase that creates US-org data.

---

### Pitfall 2: New Worker/Employee/tax/HR tables omitted from tenant scope → cross-org data leakage (IDOR)

**What goes wrong:**
`withTenantScope` in `packages/db/src/tenant.ts` auto-injects `organizationId` on every model EXCEPT those in the `globalModels` allow-list. The invariant: a tenant-scoped model MUST have `organizationId` AND must NOT be in the allow-list. Two failure modes when adding v7.0 tables (`Employee`, `AktaSection`, `LeaveRequest`, `TaxForm`/`Form1099`, `WebhookSubscription`, payroll-sync state):
1. New model created WITHOUT `organizationId` → the extension tries to inject `where.organizationId`, Prisma throws (loud, good) OR a dev "fixes" it by adding the model to `globalModels` (silent cross-org leak — catastrophic).
2. A child table (e.g. `AktaDocument` under `AktaSection`, mirroring the existing `SigningRecipient`/`SigningEvent` carve-outs) is added to `globalModels` to dodge the no-org-column throw, but tenancy is then NOT enforced via a parent-relation filter at every call site → IDOR.

**Why it happens:**
The carve-out pattern (`SigningRecipient`, `SigningEvent`, `ExchangeRate`) is legitimate but seductive — adding a model to `globalModels` makes the error disappear. Theme B introduces the most new tables of any milestone in repo history; the discriminated-union `Worker` touches the busiest table.

**How to avoid:**
- Every new tenant-owning table gets `organizationId`, and the schema-guard tenant-scope check (`packages/lint-guards/src/schema-guard`) must FAIL CI on a new model lacking it. Extend the guard's expectations for v7.0 models; do NOT add to `global-lookup-allowlist` without documented parent-relation enforcement.
- For genuine child tables, enforce tenancy via the parent relation in EVERY query (the `SigningEnvelope.organizationId` pattern) and test that a cross-org `findUnique` by child id returns null.
- Per new model: seed org A + org B, run in org A's context, assert org B rows invisible for read AND unwritable for update/delete.

**Warning signs:**
A v7.0 model appears in `globalModels`; schema-guard passes but the model has no `organizationId`; a list endpoint returns rows across orgs in a two-org seed test.

**Phase to address:** WORKER-01 (foundation — sets the precedent); enforced continuously by schema-guard in every B/A/C schema phase.

---

### Pitfall 3: Contractor→Worker discriminated-union migration breaks v1–v6 route shapes and contractor invariants

**What goes wrong:**
WORKER-01 extends the existing `Contractor` model with a `workerType` enum (default `CONTRACTOR`). Risks:
- Existing `contractorRouter` `findMany`s now also return employees once `Employee`/`Worker` rows share the table/view → corrupted contractor lists, dashboards, payment runs, classification scans that assumed "every row is a contractor."
- Output-shape drift: HR-only fields added to the shared model leak into existing contractor tRPC outputs AND the public-API contractor list (Pitfall 12), changing the wire contract for v1–v6 clients and the marketplace SDK.
- `compliance-payment-gate` / `assertContractorPaymentEligibility` and economic-dependency scans iterate "contractors"; if they silently pick up employees, payment-blocking and §530/AB5 logic misfire.

**Why it happens:**
"Non-breaking, zero data migration" is true for the row default but NOT automatically for every read path. Discriminated unions are easy in TypeScript and treacherous across a 50-namespace router where dozens of queries implicitly assumed a single type.

**How to avoid:**
- Every existing contractor read path adds an explicit `workerType:'CONTRACTOR'` filter (or queries a contractor-only view) BEFORE any `Employee` rows can exist. Make this a WORKER-02 checklist; semble/grep-audit all `contractor.findMany`/`findFirst` call sites.
- Lock existing contractor tRPC output shapes with snapshot/type tests so HR fields can't leak.
- Keep employment-specific fields on a separate `Employee` relation/table joined to `Worker`, not flattened onto the shared row — so contractor outputs are structurally incapable of carrying HR fields.
- Run the WORKER-01 migration against a staging snapshot of the largest org (already a v7.0 gate) and diff contractor list/dashboard/payment-run output before vs after.

**Warning signs:**
Contractor list count jumps after first employee created; an existing contractor E2E snapshot changes; payment-run selection shows employees; a classification scan flags an employee.

**Phase to address:** WORKER-01 + WORKER-02; regression-gated by the v7.0 "no v6.0 regression" audit criterion.

---

### Pitfall 4: HR-only / PII fields leak through RBAC field-gating holes (akta sections, SSN, salary)

**What goes wrong:**
`workerType` + new roles (`HR_ADMIN`, `HR_MANAGER`, `PAYROLL_OFFICER`, `LEAVE_APPROVER`), per-section akta-osobowe RBAC (cz. A/B/C/D), and PII fields (SSN, PESEL, salary/stawka brutto, Lohnsteuerklasse) create many field-level authorization surfaces. Failure: an existing role (e.g. a generic `manager`) or a non-HR path returns full SSN/salary/health-section docs because gating was applied at the route level but not the field/section level. This is OWASP API3:2023 (Broken Object Property Level Authorization) inside the first-party app.

**Why it happens:**
Object-level RBAC ("can you see this worker?") is easy; property-level RBAC ("can you see THIS FIELD?") is what gets skipped. Akta §94 cz. C/D hold disciplinary/health-adjacent docs needing stricter access than cz. A.

**How to avoid:**
- Default-deny field/section masking: PII + HR-only fields stripped from outputs unless the caller holds the specific permission — mirror US-FIELD-02's last-4 SSN default + full-display behind `CONTRACTOR_PII:READ`.
- Per-akta-section permission map enforced in the query/serialization layer, not the UI. UI hiding is not authorization.
- Test matrix: each new role × each akta section × SSN/salary field → assert masked/absent when unauthorized. Include the public-API path AND webhook payloads (Pitfall 12).

**Warning signs:**
A non-HR role's worker-detail response contains `ssn`/`stawkaBrutto`/cz.C-D doc URLs; one permission gates a whole worker object rather than per-section; the akta UI hides a field the API still returns.

**Phase to address:** WORKER-03/04 (RBAC + HR roles), AKTA-01 (per-section RBAC); verified in EMP-REG-* and EMP-PORTAL.

---

### Pitfall 5: `workforce-employees` flag-off is incomplete — render-tree removed but tRPC still answers (or vice-versa)

**What goes wrong:**
WORKER-05 requires flag-off to be BOTH render-tree removal AND tRPC `FORBIDDEN`, identical to the v5.0 classification pattern. Common half-done state: SPA hides employee nav/components, but `employeeRouter`/`workerRouter` procedures still execute for direct callers (or via the public API) → an org without the Workforce add-on reads/writes employee data. The inverse (procedures forbidden, components still render) produces broken error states everywhere.

**Why it happens:**
Multiple enforcement points — client render + server procedure + this milestone's `requireAddOn` SKU gate + the public-API scope. Easy to wire one or two and call it done. The boot-time flag-signoff gate (`packages/feature-flags/src/registry.ts`) catches a MISSING registry entry, NOT incomplete runtime enforcement.

**How to avoid:**
- Reuse the v5.0 classification flag-off pattern exactly: a single server-side guard on every B-side procedure that throws `FORBIDDEN` when flag-off OR add-on absent, plus `<Feature>`-gated render-tree removal.
- Every new flag (`workforce-employees`, `us-expansion`, `personio-sync`, `bamboohr-sync`, `ach-payouts`, `irs-fire-efile`, `iris-efile`, `public-api`, `outbound-webhooks`, per-payroll `payroll-*`) gets a signoff-registry entry — the boot gate `process.exit(1)`s otherwise (LOCAL-ONLY bypass `FLAG_SIGNOFF_BYPASS=local`).
- Completeness test: enumerate every B-side procedure; assert each FORBIDDEN with the flag off, and the same for add-on absence.

**Warning signs:**
A direct tRPC/public-API call to an employee procedure succeeds with the flag off; boot succeeds but a new flag has no signoff entry (its namespace prefix isn't in `signoff-registry-flags.ts` gated-prefix list); an add-on-less org `requireTier`-passes into Workforce.

**Phase to address:** WORKER-05 + the `requireAddOn` foundation phase; enforced in every B-side phase.

---

### Pitfall 6: `requireAddOn` middleware bolted on after the fact, not designed in the foundation phase

**What goes wrong:**
v7.0 introduces two add-on SKUs (`Workforce`, `US Cross-Border`) ON TOP of `requireTier` (Starter/Pro/Enterprise). If `requireAddOn` is invented per-phase instead of once, gating goes inconsistent — some procedures check tier, some add-on, some both in different orders — and a paying-but-no-add-on org gets partial access. Theme C is tier-gated (NOT add-on), so the two mechanisms must compose cleanly.

**Why it happens:**
The backlog explicitly says "design `requireAddOn` in foundation phase." Skipping that under parallel-theme pressure spreads gate logic across A and B independently.

**How to avoid:**
- Build `requireAddOn` once, alongside `requireTier`, with a documented composition order (`tier → addOn → flag → scope/RBAC`). Both A and B import it.
- Subscription/add-on state read from server session, never client.
- Test the cross-product {tier} × {add-on present/absent} × {flag on/off} for a representative A and B procedure; verify the billing webhook updates add-on entitlement, not just tier.

**Warning signs:**
Two different add-on-check helpers exist; a procedure checks add-on but not flag; billing webhook updates tier but not add-on entitlement.

**Phase to address:** Foundation phase (the `requireAddOn` design phase named in the backlog), before first A or B revenue-gated phase.

---

### Pitfall 7: SSRF on outbound webhook target URLs — the highest-risk net-new surface in v7.0

**What goes wrong:**
Theme C dispatches HTTP POSTs to user-supplied URLs. Without a guard, a tenant can register `http://169.254.169.254/latest/meta-data/` (cloud metadata / IAM creds), `http://127.0.0.1:port` (loopback to internal services), `http://10.x`/`192.168.x`/`172.16.x` (RFC1918), `169.254.x` / `fe80::` (link-local), `::1` / `fc00::/7` (IPv6 loopback/ULA) and exfiltrate internal data or pivot. **The existing `webhook-dispatcher.ts` is INBOUND-only (verifies Slack/Jira signatures) — there is NO outbound SSRF guard in the repo today.** This is greenfield, contradicting any "reuse v2.0 webhook infra" assumption.

**Why it happens:**
"Reuse the webhook pipeline" framing hides that inbound verification and outbound egress control are opposite problems. A naive "no private IPs" allowlist at SUBSCRIBE time is bypassed by DNS rebinding: the hostname resolves to a public IP at validation, then to `169.254.169.254` at dispatch.

**How to avoid (INTEG-SEC-01, must be explicit and tested):**
- Reject at SUBSCRIBE time AND re-resolve + re-check at DISPATCH time (DNS-rebind defense). Resolve the hostname, verify EVERY resolved A/AAAA record is outside private/loopback/link-local/ULA/metadata ranges, then connect to the validated IP (pin the resolved IP for the socket, or re-validate immediately before connect).
- Block: RFC1918 (`10/8`,`172.16/12`,`192.168/16`), loopback (`127/8`,`::1`), link-local (`169.254/16`,`fe80::/10`), IPv6 ULA (`fc00::/7`), and `169.254.169.254` + GCP/Azure metadata equivalents explicitly.
- HTTPS-only by default (INTEG-SEC-02); HTTP only via per-org admin override + warning.
- Disable HTTP redirects on the dispatcher client (a 30x to `http://169.254.169.254` defeats URL-time validation).
- Audit every rejection.

**Warning signs:**
Dispatcher uses a plain `fetch`/axios with `followRedirect:true`; validation runs only on subscription create; no IP-pinning between resolve and connect; the v7.0 SSRF gate (hostile URL → `169.254.169.254`/`127.0.0.1`/`10.0.0.1`/DNS-rebind, all rejected) has no test.

**Phase to address:** INTEG-SEC-01 (dedicated SSRF phase) — gate the entire outbound-webhook feature on it; do NOT ship INTEG-WEBHOOK before INTEG-SEC lands.

---

### Pitfall 8: Public-API write endpoints expose BOLA / BFLA / mass-assignment (OWASP API 2023 #1, #5, #3)

**What goes wrong:**
Today `apps/public-api` is READ-only (contractors/invoices/contracts/documents GET) and `apiKeyTenantProcedure` chains `apiKeyAuth → requireTier('ENTERPRISE') → demoReadOnly`. INTEG-API-01 adds WRITE endpoints. Three OWASP-2023 risks specific to this stack:
- **BOLA (API1, ~40% of API attacks):** a write endpoint trusting an `id` in path/body without re-checking org ownership lets a key for org A mutate org B's row. `withTenantScope` protects Prisma reads/writes IF the tenant context is set — but a `findUnique({where:{id}})` then a manual `update` outside the scoped path, or a relation-`connect` by id, can bypass it.
- **BFLA (API5):** **`apiKeyTenantProcedure` does NOT currently enforce per-scope** — the key carries `apiKeyScopes` but the procedure only checks `requireTier`. A read-only/`contractors:read`-only key could call write procedures if per-endpoint scope enforcement isn't added.
- **Mass assignment / BOPLA (API3):** Zod schemas that pass-through unknown keys, or accept `organizationId`/`status`/`workerType`/financial fields from the body, let a caller set fields they shouldn't (tenant/privilege/financial escalation).

**Why it happens:**
The read-only surface never needed scope enforcement or write-body hardening; adding writes inherits a procedure that was "secure enough for reads."

**How to avoid:**
- Add explicit per-endpoint scope enforcement to the write path (`contractors:write`, `invoices:write`, …), not just `requireTier`. Least-privilege default.
- Every write Zod schema is a strict allowlist (`.strict()`), NEVER accepts `organizationId`/tenant/`workerType`/`status`/money fields from the body; tenant comes from the API-key-resolved org only.
- BOLA test: org-A key GET/PUT/DELETE on an org-B object id → 404/403, for every write endpoint. BFLA test: read-scope key calling a write endpoint → 403. Make INTEG-SEC-04 (OWASP checklist) real tests, not prose.

**Warning signs:**
Write endpoints land before scope enforcement; a write Zod schema lacks `.strict()`; `organizationId` appears in a request DTO; INTEG-SEC-04 is a markdown file with no tests.

**Phase to address:** INTEG-AUTH-02 (scopes) must precede INTEG-API-01 write endpoints; INTEG-SEC-04 gates the write surface.

---

### Pitfall 9: US tax-record data residency vs EU GDPR — wrong-region storage / cross-region replica leak

**What goes wrong:**
US tax records (1099-NEC 4-year, backup-withholding 7-year per US-INFRA-03) carry SSN/EIN and a US data-residency expectation; EU employee/contractor PII carries GDPR/RODO obligations. Mistakes: (a) a US org's tax-form R2 archive written to the EU bucket; (b) enabling cross-region read replicas "for the dashboard" so an EU admin's aggregate pulls US SSNs into the EU region (or vice-versa); (c) a cross-org/cross-region cron aggregate (the `prismaRaw` non-scoped client, legitimately cron-only) co-mingling US and EU PII.

**Why it happens:**
The backlog says "cross-region read replicas remain off by default" (US-INFRA-01) — "off by default" invites someone to turn them on for a feature. The `prismaRaw` escape hatch (explicitly for cron cross-org aggregation, re-exported from `tenant.ts`) is a tempting tool for an HR/tax dashboard.

**How to avoid:**
- Tax-form archive bucket selection keyed off org region, asserted in test (US org → US bucket).
- Keep cross-region replicas OFF; any cross-region aggregate (global HR headcount) aggregates counts per-region and merges totals — never moves row-level PII across regions.
- `prismaRaw` stays cron-only; lint/review guard that it never appears in request handlers (the `raw.ts` rationale comment already warns — make it enforceable).
- Annotate retention/residency paths `Needs verification by jurisdiction-specific legal/tax adviser before production deploy` (Standing Constraint) rather than asserting compliance.

**Warning signs:**
A dashboard query spans regions; US tax PDFs in the EU R2 bucket; `prismaRaw` imported into a router; HR-DASH-01 "by jurisdiction" rollup reads row-level data cross-region.

**Phase to address:** US-INFRA-02/03 (residency + retention); HR-DASH-01 (cross-region aggregation pattern); cross-cutting review gate.

---

### Pitfall 10: HRIS two-way sync corrupts financial/compliance fields and loops

**What goes wrong:**
HRIS-SYNC-05 splits source-of-truth (Personio/BambooHR own registry fields: name/contact/position; Contractor Ops owns invoice/payment/compliance). Failure modes:
- **Field-overwrite corruption:** a pull from Personio overwrites a Contractor-Ops-owned financial/compliance field because the mapper isn't strictly partitioned → payment amounts, classification outcomes, or compliance status silently change from HR data.
- **Sync loop:** a push to Personio fires a Personio webhook → a pull → a push (echo storm), especially without an "originated-by-sync" marker and dedup.
- **Three-way-sync hell:** an org connects BOTH Personio and BambooHR → two HRIS sources fight over the same registry fields. HRIS-SYNC-06 mandates ONE adapter per org; if not enforced at the DB/connection level, an admin enables both.
- **Webhook replay/dup:** inbound HRIS webhooks without idempotency double-apply.

**Why it happens:**
"Two-way sync" is the single most underestimated integration. The source-of-truth split is correct on paper but requires a hard field partition in code, loop detection, and single-source enforcement — three separate things.

**How to avoid:**
- Encode the field partition as data: a per-field `owner: HRIS | CONTRACTOR_OPS` map; the pull mapper PHYSICALLY cannot write CO-owned fields, the push mapper cannot send HRIS-owned ones. Test that the pull payload's writable key-set ∩ CO-owned set is empty.
- Loop break: tag sync-originated writes; skip emitting an outbound event for a write that originated from inbound sync; dedup inbound webhooks (reuse the QStash `deduplicationId` pattern in `queueWebhookProcessing`).
- Enforce single HRIS connection per org via a unique constraint on (org + integration-category), not just UI.

**Warning signs:**
A financial field's `updatedBy` is an HRIS sync; outbound event volume spikes after enabling sync; an org has two active HRIS connections; the same Personio webhook id processed twice.

**Phase to address:** HRIS-SYNC-05 (conflict policy) + HRIS-SYNC-06 (single-adapter enforcement); dedup reuses QStash.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Add new v7.0 model to `globalModels` to silence the org-id throw | Migration "just works" | Silent cross-org leak — the exact IDOR the extension exists to prevent | **Never** for tenant-owning data; child tables only with parent-relation enforcement + test |
| Flatten Employee HR fields onto the shared `Worker`/`Contractor` row | One table, simpler joins | Contractor outputs + public-API + webhooks structurally able to leak HR/PII; v1–v6 shape drift (Pitfall 3,4) | Never — keep `Employee` as a separate relation |
| Reuse `requireTier('ENTERPRISE')` as the only public-API write gate | Ships writes fast | BFLA: read-only keys can write (Pitfall 8) | Never — add per-scope before writes |
| Validate SSRF only at webhook-subscribe time | Simple synchronous check | DNS-rebind bypass → metadata/internal pivot (Pitfall 7) | Never — re-resolve + re-check at dispatch |
| Ship US tax forms / akta retention "done" without legal annotation | Phase closes | Implies compliance the solo dev can't warrant; StBerG/RDG/IRS liability | Never — annotate `Needs verification by jurisdiction-specific legal/tax adviser` per Standing Constraint |
| Two-way HRIS sync with last-write-wins | Quick to build | Financial-field corruption + echo loops (Pitfall 10) | Never — physical field-owner partition required |
| 1099 threshold check in floating-point dollars | Fast | Money precision bug at the $600 boundary | Never — integer-cents (repo grosze pattern) for USD-equiv too |
| `console.*` / ad-hoc `fetch` in new public-api/webhook code | Quick debug | Violates logger + SSRF rules; PII in logs | Never — `@contractor-ops/logger` + guarded client |
| Ship half a jurisdiction (simplified state-withholding / BUrlG) labelled done | Theme closes faster | Customer relies on wrong compliance math | Never — defer to v7.5/v8.0 with free-text fallback (backlog Standing Constraint) |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| IRS e-file (US-FORM-05) | Assuming FIRE is a stable fallback through v7.0 | **FIRE decommissions Dec 31, 2026**; TY2026 returns (filed early 2027) MUST use IRIS (XML). The existing FIRE TCC does NOT work in IRIS — a NEW IRIS-specific TCC is required (~45-day application). Ship IRIS-primary; treat FIRE as legacy only for TY2025-and-earlier corrections, not the v7.0 production rail. Start the IRIS TCC enrollment doc EARLY (research-gated task in backlog). |
| IRS TIN Matching (US-FORM-03) | Treating any "mismatch" as a hard fail / false positive blocking payment | TIN-match returns codes (match / name-TIN mismatch / not-issued etc.). A mismatch → B-notice + backup-withholding workflow, not an outright block. Cache 24h (per backlog), admin-escalate; never auto-suspend a contractor on a single mismatch. |
| Backup withholding (US-FORM-01) | Collecting the W-9 backup-withholding flag but never APPLYING 24% withholding on payout | Wire the W-9 flag (and TIN-mismatch B-notice state) into the ACH/payout amount calc; missing this is IRS liability, not a UI gap. 7-year record retention (US-INFRA-03). |
| 1042-S (US-FORM-06) | Applying treaty rate without a valid W-8BEN/article + FTIN; defaulting 30% wrongly or under-withholding | Withholding rate = f(treaty table, valid W-8 article, FTIN present). No valid W-8 → 30% default. Treaty rate only when the W-8 chain is complete; annotate for tax-adviser verification. |
| Per-state 1099 (US-FORM-07) | Assuming federal e-file covers state filing | Only CF/SF-program states are covered by the combined program; the separate-filing states need their own handler. Don't claim "filed" when only federal transmitted. |
| ACH NACHA (US-PAY-01) | Unbalanced file / wrong effective-entry-date / malformed addenda → bank rejects whole file | Build balanced files (offset/settlement entry in-file) unless the bank accepts unbalanced; effective-entry-date a valid future banking day; correct SEC code (PPD consumer vs CCD/CTX corporate); fixed-width record discipline (1/5/6/7/8/9 records, blocking factor 10). Reuse the v4/v5 payment-export FACTORY shape — but the FORMAT is new; don't copy BACS field logic. |
| ACH returns (US-PAY-01) | No return-handling → "paid" payouts that bounced (R01 NSF, R02 closed, R03 no account) stay marked paid | Ingest return files / Modern Treasury return webhooks; map return codes to reversal/retry/notify; reconcile against payment-run status. |
| Modern Treasury / Stripe Treasury / Plaid (US-PAY-03/05) | Shared credential / wide blast radius; no idempotency on payout initiation | Per-provider, per-org encrypted credential (repo AES-256-GCM per-provider pattern); idempotency key on every payout-initiate so a retry/double-click doesn't double-pay; least-privilege Plaid scopes. |
| Personio (HRIS-SYNC-01/02) | Assuming a generous flat rate limit + cursor pagination | Endpoint-specific limits (≈300/min GET employees, burst ~15/s; auth ~60/min w/ 60s cooldown; documents ~60/min; ~2000/min IP-wide). Pagination is **offset/limit, max 200 per page** — NOT cursor. Honor `X-RateLimit-*` + 429 `Retry-After`; incremental updated-since sync; back off on 429. (MEDIUM — verify against current contract before HRIS-SYNC-01 plan.) |
| Payroll adapters (PAYROLL-*) | Treating CSV / DATEV-ASCII / RTI-FPS as interchangeable | Each format is strict + version-specific (DATEV ASCII import vs DATEVconnect REST; Sage/BrightPay RTI FPS/EPS XML; Gusto/QuickBooks/ADP native vs CSV). Per-adapter golden-file tests; 7-day-release-age on any new format lib. |
| Outbound webhooks (INTEG-WEBHOOK) | PII in payloads by default; no replay protection; DLQ poisoning | `include_pii:false` default — strip PESEL/SSN/NI/Steuer-IdNr/Emirates ID/Iqama/email/phone unless opted in. HMAC-SHA256 `t=...,v1=...` + 5-min replay window. DLQ poison messages after max retries; cap per-sub dispatch (≤100/min) to prevent fanout DDoS; one bad subscriber's retries must not starve the queue. |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Personio full re-pull every cron tick | 429s, hour-long syncs | Incremental (updated-since), offset-paginate, respect per-endpoint limits | Org with >200 people on hourly cron |
| Webhook fanout: one event → N subscriptions → unbounded dispatch | Queue backlog, downstream DDoS, retry storms | Per-sub rate cap (≤100/min), per-org dispatch cap, backoff `1m/5m/30m/2h/12h/24h` max 6 then DLQ | Org with many subs or a flapping subscriber |
| `lastUsedAt` write on every public-API request | Write storm on api-key table | Already debounced 5-min in `api-key-service.ts` — keep it; don't add per-request writes on new endpoints | High-traffic Enterprise key |
| Worker table scan after employees added | Slow contractor lists/dashboards | Index `(organizationId, workerType)`; partial indexes for contractor-only hot paths | Org mixing many contractors + employees |
| OpenAPI/SDK regen pulling full schema each build | Slow CI | Generate from Zod once, cache; version `/v1` | As endpoint count grows |
| Cross-region aggregate dashboards | Latency + residency leak | Aggregate per-region, merge counts (Pitfall 9) | Multi-region org reporting |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| SSRF validated only at subscribe time | Cloud-metadata creds, internal pivot | Re-resolve + re-check at dispatch; pin IP; no redirects (Pitfall 7) |
| Public-API writes without per-scope check | BFLA — read key writes data | Enforce `*:write` scope per endpoint, not just `requireTier` (Pitfall 8) |
| Write DTO accepts `organizationId`/`status`/money/`workerType` | Mass assignment / tenant escalation | `.strict()` Zod allowlists; tenant from key only (Pitfall 8) |
| SSN/EIN/PESEL full-display without specific permission | PII over-exposure; GDPR/RODO + US tax exposure | Last-4 default; full behind explicit perm; mask in logs (default-redact logger), API, webhooks (Pitfall 4) |
| API key stored reversibly / no leak detection | Key theft → full org data | Repo already HMAC-SHA256 hashes keys (NOT bcrypt — backlog INTEG-AUTH-01 says bcrypt; HMAC is correct for high-entropy keys, but reconcile the doc). Add INTEG-SEC-05 leak alarm: >3 distinct source IPs / 24h |
| Webhook payload with no HMAC / no timestamp | Replay, forgery | HMAC-SHA256 signed timestamp, 5-min window, documented Stripe-style verifier |
| `prismaRaw` (non-scoped) used in a request handler | Cross-org/cross-region leak | Keep cron-only; enforceable guard (Pitfall 9) |
| HTTP redirects enabled on dispatcher fetch | SSRF guard bypass via 30x | Disable redirects on outbound webhook client |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| TIN mismatch hard-blocks the contractor | Legit contractor can't be paid on a name-formatting mismatch | Surface as warning + B-notice/backup-withholding workflow; admin escalate (US-FORM-03) |
| GDPR/RODO erasure silently fails on statutory-retained akta sections | User thinks data erased; it isn't | AKTA-03: honor erasure ONLY past retention window; clearly show blocked sections + statutory citation; never claim full erasure |
| en-US locale parity gaps | US users see EU date/number/copy | en-US full key parity vs en (US-LOC-01); i18n-parity lint guard catches drift across en/de/pl/ar/en-US |
| Webhook test-fire with real PII to a wrong URL | Accidental PII disclosure | `include_pii:false` default; test-fire uses redacted sample payload |
| Add-on-less org sees Workforce nav then 403s | Confusing dead UI | Render-tree removal (flag-off) not just disabled buttons (Pitfall 5) |

## "Looks Done But Isn't" Checklist

- [ ] **US-INFRA region:** US org request actually resolves a US DB client — `SUPPORTED_REGIONS` + `REGION_ENV_MAP` + Prisma enum + R2 bucket all updated, `preWarmRegionalClients` doesn't silently skip US (Pitfall 1)
- [ ] **New v7.0 tables:** every tenant-owning model has `organizationId` + passes schema-guard; none in `globalModels` without parent-relation enforcement + cross-org test (Pitfall 2)
- [ ] **Worker migration:** every existing contractor read path filters `workerType='CONTRACTOR'`; contractor tRPC output shapes snapshot-locked; staging-snapshot migration diff clean (Pitfall 3)
- [ ] **HR/PII field gating:** role × akta-section × SSN/salary matrix test passes incl. public-API + webhook paths (Pitfall 4)
- [ ] **Flag-off:** every B-side procedure FORBIDDEN with `workforce-employees` off AND add-on absent; new flags have signoff-registry entries (boot gate green) (Pitfall 5)
- [ ] **SSRF:** dispatch-time re-resolution + IP pin + no-redirect; hostile-URL test (metadata/loopback/RFC1918/DNS-rebind) all rejected + audited (Pitfall 7)
- [ ] **Public-API writes:** per-scope enforcement wired; write DTOs `.strict()` with no tenant/status/money fields; BOLA + BFLA tests green; OWASP-2023 checklist is tests not prose (Pitfall 8)
- [ ] **Backup withholding:** W-9 flag + TIN B-notice actually reduce payout by 24%, not just stored (Integration Gotchas)
- [ ] **ACH:** file balanced (or bank-correct), effective-entry-date a valid banking day, return-code handling exists, payout-initiate idempotent (Integration Gotchas)
- [ ] **1042-S:** treaty rate gated on complete W-8/article/FTIN; 30% default otherwise (Integration Gotchas)
- [ ] **HRIS sync:** field-owner partition test (pull can't write CO-owned fields); single HRIS per org enforced; inbound dedup (Pitfall 10)
- [ ] **Erasure vs retention:** AKTA-03 honors erasure only past retention window, blocks rest with citation (UX Pitfalls)
- [ ] **Legal annotations:** US tax-form copy, akta/Personalakte retention, onboarding/offboarding statutory paperwork carry `Needs verification by jurisdiction-specific legal/tax adviser` (Standing Constraint)
- [ ] **i18n parity:** en/de/pl/ar/en-US pass i18n-parity lint guard; no hardcoded strings (lint-guards)
- [ ] **Deps:** NACHA/IRS-XSD/DATEV/Personio/BambooHR/SDK libs respect 7-day release age; `pnpm audit` + `security:scan` run; typosquat-checked

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Cross-org leak via `globalModels` (Pitfall 2) | HIGH | Incident: audit all access to the model, remove from allow-list, add org-id + backfill, breach assessment (GDPR 72h), add regression test |
| Worker migration broke contractor shapes (Pitfall 3) | MEDIUM | Roll forward: add `workerType` filters + restore output shape; partition data if employees exist; re-run staging diff |
| SSRF exploited (Pitfall 7) | HIGH | Rotate cloud creds/metadata-derived secrets, disable outbound webhooks org-wide, add dispatch-time guard, audit dispatch logs for internal targets |
| Public-API mass-assignment / BFLA (Pitfall 8) | HIGH | Revoke affected keys, audit mutations by `apiKeyId`, fix scope/`.strict()`, replay-correct corrupted rows from audit log |
| HRIS overwrote financial fields (Pitfall 10) | MEDIUM-HIGH | Restore financial fields from audit log/payment records, install field-owner partition, re-sync registry-only |
| FIRE assumed for TY2026 (Integration Gotchas) | MEDIUM | Pivot to IRIS XML build + new TCC enrollment (~45 days lead) — start TCC process early; can't be fixed at the filing deadline |
| Wrong-region US tax PDF storage (Pitfall 9) | MEDIUM | Migrate archives to correct regional bucket, purge wrong-region copies, document residency remediation |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase / Theme | Verification |
|---------|--------------------------|--------------|
| 1 — region union not extended | US-INFRA-01 (Theme A) | US-org integration test resolves US client; enum/union lockstep test |
| 2 — new tables not tenant-scoped | WORKER-01 + every schema phase (B/A/C) | schema-guard CI fails on missing org-id; two-org cross-leak test per model |
| 3 — Worker migration breaks contractor shapes | WORKER-01/02 (Theme B) | staging-snapshot migration diff; contractor output snapshot tests; v6.0-no-regression gate |
| 4 — HR/PII field-gating leak | WORKER-03/04, AKTA-01 (Theme B) | role × section × field masking matrix incl. API + webhook |
| 5 — flag-off incomplete | WORKER-05 + requireAddOn foundation | every B procedure FORBIDDEN flag-off + add-on-absent test; boot signoff gate green |
| 6 — requireAddOn ad-hoc | Foundation phase (pre-A/B revenue gates) | tier × add-on × flag cross-product test; single helper |
| 7 — SSRF outbound webhooks | INTEG-SEC-01 (Theme C) — gate WEBHOOK on it | hostile-URL + DNS-rebind rejection test + audit |
| 8 — BOLA/BFLA/mass-assignment | INTEG-AUTH-02 (scopes) before INTEG-API-01 writes; INTEG-SEC-04 | per-endpoint scope test; `.strict()` DTOs; OWASP-2023 checklist as tests |
| 9 — data residency / cross-region leak | US-INFRA-02/03; HR-DASH-01; cross-cutting review | region-bucket test; replicas-off assertion; `prismaRaw` request-handler guard |
| 10 — HRIS sync corruption/loops | HRIS-SYNC-05/06 (Theme B) | field-owner partition test; single-HRIS unique constraint; inbound dedup |
| Backup withholding not applied | US-FORM-01 / US-PAY-01 (Theme A) | E2E: W-9 flag → 24% reduced payout |
| FIRE→IRIS assumption | US-FORM-05 (research-gated task in backlog) | IRIS TCC enrollment started; IRIS XML build path primary |
| NACHA file invalid | US-PAY-01 (Theme A) | balanced-file + effective-date + return-handling golden tests |
| 1042-S treaty error | US-FORM-06 + US-LOC-02 (Theme A) | treaty rate gated on complete W-8 chain; 30% default test |
| i18n en-US drift | US-LOC-01 + cross-cutting | i18n-parity lint guard across 5 locales |
| Legal corner-cutting | Every A/B statutory phase | `Needs verification...` annotation present; defer-to-v7.5/v8.0 not half-ship |

## Sources

- IRS FIRE → IRIS transition (FIRE decommission Dec 31, 2026; TY2026 filed early 2027 on IRIS; new IRIS TCC required, ~45-day app; IRIS = XML) — HIGH (multiple independent + IRS-roadmap-citing): [Sovos](https://sovos.com/blog/trr/irs-fire-system-iris-transition/), [Ice Miller](https://www.icemiller.com/thought-leadership/retirement-of-irs-fire-system-and-mandatory-transition-to-iris), [TaxBandits](https://blog.taxbandits.com/fire-to-iris-transition-what-to-know-before-the-irs-retires-the-legacy-system-in-2027/)
- NACHA ACH file format (record types, balanced file/offset, effective-entry-date, addenda, return codes) — MEDIUM (Nacha dev guide + bank spec PDFs): [Nacha ACH Developer Guide](https://achdevguide.nacha.org/ach-file-overview), [Nacha ACH File Details](https://achdevguide.nacha.org/ach-file-details), [Common NACHA file errors (ACHgenie)](https://achgenie.com/nacha-file-format/common-errors-in-nacha-files/)
- OWASP API Security Top 10 2023 (BOLA API1 ~40% of attacks, BFLA API5, mass-assignment merged into API3 BOPLA, API4 Unrestricted Resource Consumption) — HIGH: [OWASP API1:2023 BOLA](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/), [OWASP API3:2023 BOPLA](https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/)
- Personio API rate limits + offset pagination (≈300/min GET employees, burst ~15/s; auth ~60/min/60s cooldown; documents ~60/min; ~2000/min IP-wide; offset/limit max 200; 429 + `X-RateLimit-*`) — MEDIUM (developer changelog + community; verify against current contract before HRIS-SYNC-01): [Personio IP rate limiting](https://developer.personio.de/changelog/ip-address-based-rate-limiting-v1-endpoints), [Rate limits GET Employees](https://developer.personio.de/changelog/rate-limits-on-get-employees-endpoint-may-6-2024)
- In-tree architecture grounding (HIGH — read directly): `packages/db/src/tenant.ts` (`withTenantScope` + `globalModels` allow-list), `packages/db/src/region.ts` (`SUPPORTED_REGIONS=['EU','ME']`, throws on unknown), `packages/integrations/src/services/webhook-dispatcher.ts` (inbound-only, no SSRF guard), `apps/public-api/src/app.ts` (read-only routes today), `packages/api/src/middleware/api-key-auth.ts` (`apiKeyTenantProcedure` = auth → `requireTier('ENTERPRISE')` → demoReadOnly; scopes carried but not per-endpoint-enforced), `packages/api/src/services/api-key-service.ts` (HMAC-SHA256 key hashing, NOT bcrypt), `packages/feature-flags/src/registry.ts` + `signoff-registry-flags.ts` (boot-time flag signoff gate), `packages/lint-guards/src/{schema-guard,scopes-guard,i18n-parity,logs-guard}`
- v7.0 backlog Standing Project Constraints + verification gates: `.planning/milestones/v7.0-BACKLOG.md`; LOCAL-ONLY + deferred legal sign-off: `.planning/PROJECT.md`

---
*Pitfalls research for: v7.0 GTM Expansion (US cross-border + Workforce + Integration Marketplace) added to contractor-ops multi-tenant/multi-region SaaS*
*Researched: 2026-06-07*
