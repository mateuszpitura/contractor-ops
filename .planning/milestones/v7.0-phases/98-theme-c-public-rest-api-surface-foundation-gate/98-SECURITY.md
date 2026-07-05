---
phase: 98-theme-c-public-rest-api-surface-foundation-gate
status: secured
asvs_level: 2
block_on: high
threats_total: 43
threats_closed: 37
threats_accepted: 6
threats_open: 0
audited: 2026-07-06
---

# SECURITY.md — Phase 98: Theme C Public REST API Surface (Foundation Gate)

**Audit type:** Retroactive threat-mitigation verification (register authored at plan time).
**ASVS level:** 2 · **block_on:** high
**Register source:** `98-01-PLAN.md … 98-12-PLAN.md` `<threat_model>` blocks (43 STRIDE entries).
**Method:** Each declared mitigation grep-verified in shipped code, not accepted on documentation/intent.

**Result:** 37 CLOSED · 6 ACCEPTED-AS-RISK (0 HIGH / 0 BLOCKER · 2 MEDIUM · 4 LOW/not-implemented) → **threats_open: 0**.
No high-severity finding. The 6 non-blocking items were reviewed and **accepted** (2026-07-06): a
documented, security-gated write-visibility supersession (T-98-10-01/T-98-11-01) plus undelivered
follow-on scope (SDK pipeline + wiki). The write un-hide's precondition — the `owasp-api-gate` suite —
was **verified GREEN (7/7)** this session (`pnpm --filter @contractor-ops/api test owasp-api-gate`),
closing AR-98-01's core concern. See Accepted-Risk Log and the Security Audit trail.

---

## Headline finding (read first)

Phase 98's register declares the public **write surface** must be **double-dark**: (1) a runtime
per-org `module.public-api` flag gate (404 when off) **and** (2) `hide: true` on every write
`createRoute` so writes are absent from the derived OpenAPI 3.1 doc / Scalar portal / SDK
(T-98-10-01, T-98-11-01).

**As shipped, layer (2) is absent.** No `hide: true` exists anywhere under
`apps/public-api/src/routes/`. The 11 write routes register via `.openapi()` and therefore appear
in `buildOpenApiDocument(app)`, which is served **unauthenticated** at `GET /v1/openapi.json` and
rendered at `GET /v1/docs` (`apps/public-api/src/app.ts:136,139`). The write API shape is publicly
discoverable.

This is a **deliberate, documented supersession**, not an accidental hole:
- `.planning/MEMORY.md:209,230` records the un-hide as a **Phase-100** action gated on the
  `owasp-api-gate` suite (BOLA/BFLA/SSRF/mass-assignment/misconfig/injection) passing.
- `write-routes-dark.test.ts` + `openapi-doc.test.ts` were rewritten to assert writes ARE present
  ("post-OWASP-gate flip") while still asserting the runtime 404-when-flag-off.

**Access control is fully intact.** Every write still requires: valid Enterprise API key (else 401),
`module.public-api` granted per-org (else 404 dark), and the mandatory `resource:action` scope
(else 403). No unauthorized write is reachable. The residual exposure is **information disclosure**
of an already-gated surface — MEDIUM, not HIGH.

**Two residual defects on top of the supersession:**
1. Stale/false docstrings still claim writes are hidden: `apps/public-api/src/lib/build-openapi-doc.ts:6-11`
   and `apps/public-api/src/lib/openapi-route.ts:62-65`. Misleading in security-relevant code.
2. The un-hide's stated precondition (`owasp-api-gate` GREEN) is asserted only in MEMORY + test
   comments; the gate artifact is a Phase-100 concern **outside this Phase-98 audit's evidence** —
   flagged, not verified.

---

## Threat Verification (43 entries)

### CLOSED (37)

| Threat ID | Category | Component | Disp. | Evidence (file:line) |
|-----------|----------|-----------|-------|----------------------|
| T-98-01-SC | Tampering | New deps supply chain | mitigate | `apps/public-api/package.json:24-25` exact pins `@hono/zod-openapi@1.4.0` + `@scalar/hono-api-reference@0.11.6` (≥7-day); no Speakeasy npm dep; 98-01-SUMMARY audit/scan clean |
| T-98-02-01 | EoP | Write reachable w/o scope | mitigate | `public-api-write-scope.security.test.ts:265` live BFLA 403 matrix |
| T-98-02-02 | Info disclosure | Surface reachable when dark | mitigate | `public-api-flag.security.test.ts` + `require-public-api-flag.ts:31-41` |
| T-98-02-03 | Tampering | RED scaffold false-pass | mitigate | Scaffolds now assert concrete vectors (write-scope/flag/tenant tests live-green) |
| T-98-02-SC | Tampering | npm installs | accept | No installs in plan |
| T-98-03-01 | EoP | Scope singular/plural drift | mitigate | `scope-utils.ts:41-63` granular strings == `permissionToScopes`; `rbac.ts:30` |
| T-98-03-02 | EoP | classification/audit read-gate wrong resource | mitigate | `classification.ts:29`/`audit.ts:23` `requirePermission({classification/auditLog:['read']})`; off named roles (98-03-SUMMARY) |
| T-98-03-SC | Tampering | npm installs | accept | No installs |
| T-98-04-01 | Info disclosure | API reachable for org without module | mitigate | `require-public-api-flag.ts:24-42` NOT_FOUND; wired `api-key-auth.ts:100-127` |
| T-98-04-02 | EoP | Dark writes reachable pre-99 | mitigate | Writes inherit `apiKeyTenantProcedure` (flag gate in chain) — runtime 404 intact; `write-routes-dark.test.ts:109-119` |
| T-98-04-SC | Tampering | npm installs | accept | No installs |
| T-98-05-01 | Tampering | Forged/garbage cursor | mitigate | `openapi-cursor.ts:29-45` tamper → BAD_REQUEST |
| T-98-05-02 | DoS | Deep pagination / huge limit | mitigate | `validators/public-api/index.ts:61-66` limit `.max(100)`; cursor keyset, no COUNT |
| T-98-05-03 | Tampering | Unknown filter injection | mitigate | `.strict()` filter allowlists (validators:84-244); `parse-list-query.parseBracketedQuery` before validation |
| T-98-05-SC | Tampering | npm installs | accept | No installs |
| T-98-06-01 | Tampering | CDN+SRI docs script | mitigate | `app.ts:2,139` Scalar from vendored npm dep; CDN/SRI/ENABLE_API_DOCS removed |
| T-98-06-02 | Info disclosure | Two OpenAPI sources drift | mitigate | `openapi.ts` deleted (absent); single `build-openapi-doc.ts` derived doc |
| T-98-06-03 | DoS | healthcheck/base mismatch | mitigate | `render.yaml:410` `healthCheckPath: /v1/health` |
| T-98-06-SC | Tampering | npm installs | accept | Deps landed 98-01 |
| T-98-07-01 | Info disclosure | Cross-tenant read via cursor/filter | mitigate | `contractor.ts:32-35`/`invoice.ts:33-36` `where:{organizationId,deletedAt:null}`; tenant-isolation test green |
| T-98-07-02 | DoS | Deep offset scans | mitigate | Offset removed; `cursorClause`+`paginateByLastKeptUndefined`; no total |
| T-98-07-SC | Tampering | npm installs | accept | No new deps |
| T-98-08-01 | Info disclosure | Cross-tenant read (payment/workflow/audit) | mitigate | All 7 net-new routers `where:{organizationId}`; `tenant-isolation.security.test.ts` 15 tests green |
| T-98-08-02 | Info disclosure | audit_log PII over-exposure | mitigate | `audit.ts:12-19` select excludes actorId/actorName/ip/userAgent/metadata; `classification.ts:17-25` excludes answers/outcome |
| T-98-08-03 | EoP | Classification write leaks as read | mitigate | `classification.ts` list/getById only; `compliance-document.ts` list/getById only; `index.ts:20-33` |
| T-98-08-SC | Tampering | npm installs | accept | No new deps |
| T-98-09-01 | EoP | Write without scope (BFLA) | mitigate | Every write `.use(requirePermission(...))` (contractor/invoice/payment/payment-run/workflow/workflow-task); live 403 matrix `public-api-write-scope.security.test.ts:265-282` |
| T-98-09-02 | Tampering | Mass-assign org/workerType/money | mitigate | `validators/public-api/index.ts:258-361` `.strict()` write DTOs omit them; money server-derived (`payment-run.ts:98`); tenant from `ctx.organizationId` |
| T-98-09-03 | Tampering | Reimplemented FSM/money drift | mitigate | `payment-run.ts:16-27` reuses `VALID_TRANSITIONS/loadEligibleInvoices/seedRunItems/_generateExportFileForFormat`; `workflow-task.ts:15` reuses `validateTransition/unblockDependentsAndRecomputeRun` |
| T-98-09-04 | Repudiation | External mutation without audit | mitigate | `write-shared.ts:22-47` `writePublicApiAudit` (actorType `API_KEY`) in every write tx; `public-api-mutation-audit.security.test.ts:257` |
| T-98-09-05 | EoP | Payout initiation exposed | mitigate | `_initiatePayoutForRun` NOT imported/exposed in `payment-run.ts` (grep clean); DEFERRED |
| T-98-09-SC | Tampering | npm installs | accept | No new deps |
| T-98-10-02 | EoP | Write reachable before flag granted | mitigate | Runtime flag gate in `apiKeyTenantProcedure`; `write-routes-dark.test.ts:109-119` 404-when-off (all 11 routes) |
| T-98-10-03 | Tampering | Business logic drift in Hono handler | mitigate | Handlers thin (`contractors.ts:86-103` delegate to `createPublicCaller`); same `.strict()` DTO via `jsonBody` |
| T-98-10-SC | Tampering | npm installs | accept | No new deps |
| T-98-12-02 | EoP | P99 flag-flip w/o scope taxonomy reconciled | mitigate | `98-09-HANDOFF.md` + `98-03-SUMMARY` A1 reconciliation; MEMORY:201-230 |
| T-98-12-SC | Tampering | npm installs | accept | No installs |

### OPEN (6)

| Threat ID | Category | Component | Sev. | Mitigation expected vs. found | Evidence searched |
|-----------|----------|-----------|------|-------------------------------|-------------------|
| T-98-10-01 | Info disclosure | Write surface leaks into spec/SDK/portal | MEDIUM | Expected `hide:true` on every write createRoute (zero write paths in doc). **Absent** — 0 `hide:true`; writes appear in derived doc; `/v1/openapi.json` + `/v1/docs` unauthenticated. Superseded by documented Phase-100 un-hide (see Accepted-Risk Log). | `apps/public-api/src/routes/*.ts` (grep `hide` = 0); `app.ts:136,139`; `openapi-doc.test.ts:66-78`; `write-routes-dark.test.ts:122-135` |
| T-98-11-01 | Info disclosure | Writes leak into published SDK | MEDIUM | Expected writes-hidden `openapi.snapshot.json` + CI drift check. **Not implemented** — no snapshot, no `.speakeasy/workflow.yaml`, no `sdk-*.yml`. No SDK published (no live leak), but with writes un-hidden any future snapshot would include them → compensating control gone. INTEG-API-05 undelivered. | `apps/public-api/openapi.snapshot.json` (absent); `.speakeasy/` (absent); `.github/workflows/sdk-*.yml` (absent) |
| T-98-11-02 | Spoofing/Tampering | Long-lived PyPI token exfiltration | LOW | Expected PyPI OIDC / least-priv token. **Not implemented** — no publish pipeline exists → no credential surface yet. | `.github/workflows/sdk-publish.yml` (absent) |
| T-98-11-03 | Tampering | Premature public 1.0 SDK | LOW | Expected 0.x prerelease only. **Not implemented** — no SDK produced. | `.speakeasy/workflow.yaml` (absent) |
| T-98-11-SC | Tampering | Speakeasy action supply chain | LOW | Expected pinned ≥7-day action. **Not implemented** — no CI action wired. | `.github/workflows/sdk-*.yml` (absent) |
| T-98-12-01 | Integrity | Stale wiki misleads on dark-gate/BFLA | LOW | Expected `wiki/domains/public-api.md` + pattern pages + `check:wiki-brain`. **Page absent** (MEMORY invariants present at :201-230). Compounded by false "hide:true" docstrings in `build-openapi-doc.ts:6-11` + `openapi-route.ts:62-65`. | `.planning/brain/wiki/domains/public-api.md` (absent) |

---

## Accepted-Risk Log

### AR-98-01 — Write surface un-hidden into the OpenAPI spec / Scalar portal (T-98-10-01)

**Status:** ACCEPTED (2026-07-06) — supersession confirmed, OWASP-gate precondition VERIFIED GREEN.
**What:** Phase 98 required writes double-dark (`hide:true`). Shipped code exposes the 11 write
routes in the unauthenticated `/v1/openapi.json` + `/v1/docs`.
**Why acceptable:** Documented as a **planned Phase-100 action gated on the `owasp-api-gate` suite**
(`.planning/MEMORY.md:209,230`). Access control is unchanged and verified: API-key auth (401),
per-org `module.public-api` flag gate (404 dark), mandatory scope (403). Exposure is limited to the
API **shape**, not data or access. Deploy posture is local-only.
**Follow-up disposition:**
1. ✓ RESOLVED — `owasp-api-gate` suite verified **GREEN (7/7)** this session
   (`pnpm --filter @contractor-ops/api test owasp-api-gate`, 2026-07-06); the un-hide precondition
   (BOLA/BFLA/SSRF/mass-assignment/misconfig/injection) holds against the real surface.
2. OPEN (LOW) — fix the false docstrings claiming `hide:true` (`build-openapi-doc.ts:6-11`,
   `openapi-route.ts:62-65`); misleading in security-relevant code. Non-blocking; track to Phase-100/101 doc pass.
3. NOTE — `/v1/openapi.json` + `/v1/docs` exposure of the write surface is the intended product
   decision (public discoverable shape, per-org 404 until flag granted). Deploy posture is local-only.

### AR-98-02 — SDK codegen/publish pipeline (INTEG-API-05) not delivered (T-98-11-*)

**Status:** DEFERRED (undelivered scope, no live exposure).
No snapshot / `.speakeasy` workflow / SDK CI exists. No SDK is published, so no write endpoints leak
today. **However**, because writes are now un-hidden (AR-98-01), the "writes-hidden snapshot" premise
of T-98-11-01 no longer holds: whoever builds the SDK later must re-establish a write-exclusion (or
consciously publish writes). Track with INTEG-API-05.

### AR-98-03 — Documentation-follows-code obligation partially unmet (T-98-12-01)

**Status:** OPEN (LOW). `wiki/domains/public-api.md` absent; MEMORY invariants present. Plans 98-11
and 98-12 have no SUMMARY. Non-security-blocking; complete per CLAUDE.md doc-follows-code.

---

## Unregistered Flags

None. No `## Threat Flags` section is present in any `98-0x-SUMMARY.md`; no new attack surface was
declared during implementation beyond the plan-time register. The one material divergence from the
register (write un-hide) is captured above as T-98-10-01 / AR-98-01 rather than an unregistered flag,
because it maps to an existing threat ID.

---

## Verified Defensive Controls (register-adjacent, no dedicated threat ID)

- **API-key auth 401:** `api-key-auth.ts:28-59` — Bearer `co_live_` required; HMAC resolve; suspended
  org → FORBIDDEN.
- **Rate limiting:** `apps/public-api/src/lib/rate-limiter.ts` — 100 req/min sliding window per key,
  fail-closed (503) in prod, 429 + Retry-After; mounted `app.use('*', rateLimitMiddleware)`
  (`app.ts:115`). Post-auth per-tier monthly quota via `enforceApiTierQuota` in the procedure chain.
- **CORS:** `app.ts:98-114` — first-party allowlist, no `*`, `credentials:false`, prod boots-fast if
  `PUBLIC_API_CORS_ORIGINS` unset.
- **Secure headers:** `app.ts:90-97` — `X-Frame-Options: DENY`, `nosniff`, referrer policy.
- **Write actor model:** `api-key-auth.ts:83` `apiKeyActingUserId` fills non-null user FKs
  (`payment-run.ts:81` `createdByUserId`, `workflow.ts:92` `startedByUserId`) as **attribution only**
  (never authorization); guarded with `UNAUTHORIZED` when absent.

---

## Security Audit 2026-07-06

| Metric | Count |
|--------|-------|
| Threats in register | 43 |
| Closed (code-verified) | 37 |
| Accepted-as-risk (reviewed) | 6 |
| Open (unresolved) | 0 |

**Actions this session:**
- Ran `pnpm --filter @contractor-ops/api test owasp-api-gate` → **7/7 GREEN** (BOLA/BFLA/SSRF/mass-assignment/misconfig/injection). Resolves AR-98-01 precondition.
- User reviewed the 6 non-blocking findings (0 HIGH/BLOCKER) and **accepted** them as documented risk (AR-98-01/02/03).
- Residual LOW follow-ups tracked, non-blocking: fix false `hide:true` docstrings; author `wiki/domains/public-api.md`; re-establish SDK write-exclusion when INTEG-API-05 lands.
- `threats_open: 0` → phase security gate cleared.

## Phase disposition

**SECURED — threats_open: 0.** The security substance (auth, per-org dark gate, tenant isolation,
BFLA scope enforcement, mass-assignment defense, PII stripping, cursor tamper safety, non-repudiation
audit, invariant reuse, deferred-create gating) is CLOSED and code-verified. The write-visibility
supersession (T-98-10-01) is accepted with its `owasp-api-gate` precondition verified GREEN; the
remaining LOW items (SDK pipeline, wiki, docstrings) are accepted follow-on scope. Phase does not block.

_Audited read-only. No implementation file modified._
