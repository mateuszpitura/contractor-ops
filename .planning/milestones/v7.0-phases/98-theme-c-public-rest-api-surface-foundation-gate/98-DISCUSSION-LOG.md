# Phase 98: Theme C — Public REST API Surface - Discussion Log

> **Audit trail only.** Decisions are captured in CONTEXT.md.

**Date:** 2026-07-01
**Phase:** 98-theme-c-public-rest-api-surface-foundation-gate
**Areas discussed:** Endpoint↔domain reuse, Write-endpoint sequencing, OpenAPI + pagination, SDK gen + publish

---

## Write Reuse (INTEG-API-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Re-impl in public tRPC layer | publicApiRouter writes under apiKeyTenantProcedure, reuse invariant helpers + services + API_KEY audit; internal mutations untouched | |
| Extract shared service layer first | Refactor mutation bodies out of internal tRPC into actor-agnostic services; DRY but big refactor of stable routers | |
| You decide | Planner picks; constraint = reuse invariants, API_KEY audit, key-tenant | ✓ |

**User's choice:** You decide.
**Notes:** Claude's lean = re-impl in public tRPC layer (CONTEXT D-01). Scout: write logic locked in tenantProcedure.mutation() closures coupled to ctx.user.id, not plain-service-reachable; reuse VALID_TRANSITIONS/validateTransition + audit-writer(API_KEY)/payment-export/doc-link-service/personnel-classifier.

---

## Write-Endpoint Sequencing (BFLA vs Phase 99)

| Option | Description | Selected |
|--------|-------------|----------|
| Writes built + scoped, flag-dark | Build writes in 98 with mandatory per-endpoint scope from day 1; dark (module.public-api off) until Phase 99 | ✓ |
| Read-only in 98, writes in 99 | 98 reads only; all writes + scopes in 99; rescope SC#1 | |
| You decide | Planner picks; hard constraint = no unscoped write endpoint | |

**User's choice:** Writes built + scoped, flag-dark.
**Notes:** Scout confirmed PUBLIC_API_SCOPES has only :read + scope enforcement is opt-in → unscoped write = live BFLA hole. Define write scopes now + mandatory requirePermission on every write; whole surface dark until 99.

---

## OpenAPI + Pagination (INTEG-API-02/03/04)

| Option | Description | Selected |
|--------|-------------|----------|
| @hono/zod-openapi + cursor | Auto-derive 3.1 spec from Zod, Scalar as dep, cursor (mirror core/audit.ts), filter/sort, /v1, Sunset; migrate existing 5 reads | ✓ |
| Zod-openapi new routes; offset stays | New routes zod-openapi+cursor; old 5 stay hand-spec+offset; mixed conventions | |
| You decide | Planner picks; constraint = auto-spec + cursor + /v1 + Sunset | |

**User's choice:** @hono/zod-openapi + cursor.
**Notes:** Hand-written openapi.ts drifts; @hono/zod-openapi not a dep; Scalar CDN-only; pagination offset today (reqs want cursor). Migrate the 5 existing reads to the pattern too.

---

## SDK Gen + Publish (INTEG-API-05)

| Option | Description | Selected |
|--------|-------------|----------|
| Build pipeline, publish 0.x prerelease | Speakeasy codegen + CI in 98; publish 0.x dark; promote 1.0 post-99 | ✓ |
| Publish public v1 in 98 | Public 1.0 SDKs now; but 99 changes surface → breaking 2.0, churns adopters | |
| You decide | Planner picks; constraint = Speakeasy codegen + publish pipeline exists | |

**User's choice:** Build pipeline, publish 0.x prerelease.
**Notes:** No SDK/Speakeasy today (entirely new). Don't ship a public v1 for a read-only-partial API that changes in 99.

---

## Claude's Discretion
- Write-exposure mechanism (D-01) — lean public-tRPC re-impl.
- Cursor token encoding + filter/sort grammar.
- Read-migration order; Speakeasy CI + semver; write-scope taxonomy (align w/ Phase 99 INTEG-AUTH-02).

## Deferred Ideas
- Key-mgmt UI / scope picker / per-tier limits / rotation → Phase 99.
- Outbound webhooks + SSRF → Phase 100.
- Marketplace + DX portal → Phase 101.
- Extract-shared-service refactor → deferred.
- Public 1.0 SDK promotion → post-99.
