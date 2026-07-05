# 99-01 SUMMARY — Wave-0 RED validation net

**Wave:** 0 · **Status:** done

## What landed

The phase's RED net — every Phase-99 secure behavior now has a failing, scoped, non-watch test that
names the plan turning it green.

### Repointed / un-skipped Phase-98 HOLD suites
- `public-api-write-scope.security.test.ts` — `WRITE_SCOPE_MATRIX` split into **DELIVERED** (11 rows:
  contractor create/update, invoice create/void, payment update, paymentRun create/transition/export,
  workflow create/execute, workflowTask transition) and **DEFERRED** (`payment.create`,
  `complianceDocument.create`, `complianceDocument.link` — explicit `it.skip`, never dropped). The
  live 403 matrix is un-skipped: each DELIVERED write must 403 a key WITHOUT its scope and NOT 403 one
  WITH it. RED → **99-04**.
- `public-api-flag.security.test.ts` — write-half un-skipped: `contractor.create`/`.update` must 404
  with the **dark-gate message** (`publicApiDisabled`) when `module.public-api` is off. Message-matched
  so a not-yet-built procedure (which also 404s as "No procedure found") stays genuinely RED. → **99-04**.
- `strict-dto.test.ts` — repointed per 98-09-HANDOFF: money-rejection → `publicApiPaymentRunCreateInputSchema`
  (money server-derived), org/workerType → `publicApiContractorCreateInputSchema`; invoice keeps only a
  tenant-forge rejection (amounts are legitimate content). RED → **99-04**.

### Four NEW RED security suites
- `api-key-actor.security.test.ts` — D-01: create defaults `actingUserId` to the creator; create/update
  reject binding to a non-member (BAD_REQUEST); public FK-creates set `startedByUserId`/`createdByUserId`
  to the key's actingUserId and audit `API_KEY` + `metadata.actingUserId`. → binding rows **99-02**,
  FK-on-create rows **99-04**.
- `api-key-rotation.security.test.ts` — INTEG-AUTH-01: `resolveByPrefix` must reference
  `supersededAt`/`graceExpiresAt` (grace-aware) while keeping `revokedAt:null`; `rotate` issues a new key,
  supersedes the old with a grace window, and rejects rotating a revoked/superseded key. → **99-05**.
- `api-tier-quota.security.test.ts` — INTEG-AUTH-04: STARTER/PRO over quota → `TOO_MANY_REQUESTS`;
  ENTERPRISE never throws and writes no counter. Mocks the future `api-quota-counter` (inert until the
  99-03 middleware imports it). → **99-03**.
- `public-api-mutation-audit.security.test.ts` — INTEG-AUTH-05: one representative write per delivered
  entity writes exactly one `API_KEY` audit row carrying `actorId` (apiKeyId), `ipAddress` (sourceIp),
  and `userAgent`. → **99-04** (sourceIp/UA ctx threaded in 99-02).

### Nyquist floor
- `99-VALIDATION.md` frontmatter `nyquist_compliant: true`.

## DEFERRED rows (downstream must keep skipped)
`payment.create` (seeded by payment-run creation, not standalone) · `complianceDocument.create` +
`complianceDocument.link` (D-02: ClassificationDocument is an append-only system artifact; the auth
requirement grants `compliance:read` only — compliance docs stay READ-ONLY externally).

## Verification
- All six API suites + strict-dto load and are RED (27 failing rows against the not-yet-built surface;
  scope-registry membership + read/unit rows already GREEN).
- `pnpm typecheck --filter @contractor-ops/api --filter @contractor-ops/public-api` clean (test files use
  narrow casts for not-yet-existing procedure shapes; app tsconfigs exclude `__tests__`).
- Test-only change set — wiki-exempt per CLAUDE.md § Documentation follows code.
