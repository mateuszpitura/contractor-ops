---
phase: 98
slug: theme-c-public-rest-api-surface-foundation-gate
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-01
---

# Phase 98 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `98-RESEARCH.md` § Validation Architecture. This is the public REST API
> foundation gate (Theme C serialization point — 99/100/101 wait on it). The whole WRITE
> surface stays DARK (flag off + `hide:true` in the spec/SDK) until Phase 99 — validation
> below asserts writes are BUILT + SCOPE-ENFORCED, not reachable.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x (`apps/public-api` `test: vitest run`; `packages/api` vitest) |
| **Config file** | per-package `vitest` (no root config); Hono fetch-harness (no supertest) |
| **Quick run command** | `pnpm --filter @contractor-ops/public-api test <path>` (SCOPED + path arg) |
| **Full suite command** | `pnpm --filter @contractor-ops/public-api test` + `pnpm --filter @contractor-ops/api test <path>` (scoped) |
| **Estimated runtime** | ~10–30 seconds (scoped) |
| **Existing seam** | `apps/public-api/src/__tests__/app.test.ts` (real app assembly, `createPublicCaller` stubbed via `vi.hoisted`); `*.security.test.ts` regression pattern (`rate-limit.security.test.ts`) |

> **NEVER** run the full unscoped web-vite suite (kills Mac RAM). Always scope `--filter` + a path arg.
> `public-api` / `api` suites are safe when scoped.

---

## Sampling Rate

- **After every task commit:** Run scoped `pnpm --filter @contractor-ops/public-api test <path>` for the touched file.
- **After every plan wave:** Run scoped public-api full suite + the relevant `packages/api` public-api tests.
- **Before `/gsd:verify-work`:** public-api suite green + the new `*.security.test.ts` (write-scope + flag-gate + tenant) green.
- **Max feedback latency:** ~30 seconds (scoped).

---

## Per-Task Verification Map

> Requirement → behavior → test map (from RESEARCH § "Phase Requirements → Test Map").
> Plan/task/wave IDs are assigned by the planner; this table is the requirement-level contract
> each plan's tasks must satisfy.

| Requirement | Wave | Behavior (secure behavior) | Test Type | Automated Command | File Exists | Status |
|-------------|------|----------------------------|-----------|-------------------|-------------|--------|
| INTEG-API-01 | 0 | Every write endpoint rejects a correctly-authenticated key WITHOUT the required scope (BFLA — no unscoped mutating endpoint) | security | `pnpm --filter @contractor-ops/api test public-api-write-scope` | ❌ W0 (`packages/api/src/__tests__/security/public-api-write-scope.security.test.ts`) | ⬜ pending |
| INTEG-API-01 | 0 | `.strict()` DTO rejects extra body keys incl. `organizationId` / `workerType` / money fields (mass-assignment blocked) | unit | `pnpm --filter @contractor-ops/public-api test strict-dto` | ❌ W0 (`apps/public-api/src/__tests__/strict-dto.test.ts`) | ⬜ pending |
| INTEG-API-01 | — | Cross-tenant write/read denied (org from key, never client input) | security | `pnpm --filter @contractor-ops/api test tenant-isolation` (extend existing) | ✅ pattern exists (`security/tenant-isolation-extra.security.test.ts`) | ⬜ pending |
| INTEG-API-02 | — | `getOpenAPI31Document()` emits `openapi: 3.1.x` with all read routes + component schemas; writes ABSENT (`hide:true`) | unit | `pnpm --filter @contractor-ops/public-api test openapi-doc` | ❌ W0 (`apps/public-api/src/__tests__/openapi-doc.test.ts`) | ⬜ pending |
| INTEG-API-03 | — | `/v1/*` base resolves; `versionHeaders` emits `Sunset`/`Link` per RFC 8594 when policy set (none for current v1) | unit | `pnpm --filter @contractor-ops/public-api test version-headers` | ❌ W0 (`apps/public-api/src/__tests__/version-headers.test.ts`) | ⬜ pending |
| INTEG-API-04 | — | Cursor page stable + opaque (decode round-trips; tampered cursor → BAD_REQUEST); `filter[x]` / `sort=-field` parsed + `.strict()` rejects unknown filter | unit | `pnpm --filter @contractor-ops/public-api test cursor-filter` | ❌ W0 (`apps/public-api/src/__tests__/cursor-filter.test.ts`) | ⬜ pending |
| INTEG-API-05 | — | Spec snapshot (writes hidden) diff-checks; Speakeasy target config valid | ci | `speakeasy lint` / `speakeasy run --dry` in CI | ❌ W0 (CI job) | ⬜ pending |
| D-05 | 0 | Per-org `module.public-api` OFF → 404 for reads AND writes (double-dark) | integration | `pnpm --filter @contractor-ops/api test public-api-flag` | ❌ W0 (`packages/api/src/__tests__/security/public-api-flag.security.test.ts`) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/public-api/src/__tests__/write-scope.security.test.ts` — asserts EVERY write route 403s without its scope (BFLA) — INTEG-API-01
- [ ] `apps/public-api/src/__tests__/strict-dto.test.ts` — extra-key rejection incl. org / workerType / money — INTEG-API-01
- [ ] `apps/public-api/src/__tests__/openapi-doc.test.ts` — 3.1 doc shape + writes hidden — INTEG-API-02
- [ ] `apps/public-api/src/__tests__/cursor-filter.test.ts` — cursor round-trip/tamper + bracket-filter/sort — INTEG-API-04
- [ ] `apps/public-api/src/__tests__/version-headers.test.ts` — RFC 8594 emission — INTEG-API-03
- [ ] `packages/api/src/__tests__/security/public-api-flag.security.test.ts` — per-org 404 dark gate — D-05
- [ ] `packages/api/src/__tests__/security/public-api-write-scope.security.test.ts` — apiKey-mode scope matrix — INTEG-API-01 / D-02
- [ ] CI job — `speakeasy` lint/dry-run against the committed spec snapshot — INTEG-API-05
- [ ] **Spike (Wave 0):** prove `@contractor-ops/validators` `.strict()` schemas register into `getOpenAPI31Document()` (RESEARCH seam A2 / Pitfall 1)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Speakeasy actually publishes a 0.x PRERELEASE to npm + PyPI (dark) | INTEG-API-05 | Requires live registry credentials (npm token / PyPI OIDC or `PYPI_TOKEN`) not exercisable in unit tests | Trigger the publish CI job on a branch; confirm `@contractor-ops/sdk@0.x` prerelease tag on npm + `contractor-ops-sdk` prerelease on PyPI; verify the published SDK surface has NO write endpoints |
| Scalar developer portal renders the derived 3.1 spec | INTEG-API-02 | Visual render of an auto-generated portal | Boot `apps/public-api` locally; load the Scalar route; confirm read entities present, writes absent |
| One-time supply-chain verify before the single `pnpm add` of `@hono/zod-openapi` + `@scalar/hono-api-reference` | — | slopcheck was unavailable in research; packages tagged `[ASSUMED]` | `checkpoint:human-verify` — confirm package name/publisher/age ≥7 days, run `pnpm audit` + `pnpm security:scan` after add |

---

## Validation Sign-Off

- [ ] All requirements have an automated verify command or a Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (8 test files + spike + CI job)
- [ ] No watch-mode flags (scoped `vitest run` only)
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter (after planner assigns task IDs + Wave 0 stubs land)

**Approval:** pending
