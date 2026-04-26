# Phase 66: Phase 57 Completion & Verification - Research

**Researched:** 2026-04-26
**Mode:** D-04 re-validation (CONTEXT.md mandate) + scenario blueprint synthesis

<summary>
## What I learned

Phase 66 closes Phase 57 (Government API Clients) by re-running its acceptance evidence on current `v2` HEAD, fixing test-infrastructure regressions that mask Phase 57 truths, replacing the 9 manual operator scenarios in Plan 57-04 Task 3 with deterministic MSW-driven vitest equivalents, and emitting `57-VERIFICATION.md`.

**The D-04 re-validation pass produced one major surprise:**

- **D-06's premise (mock harness missing `contract.count` / `contract.groupBy`) is OBSOLETE.** Commit `0df1164f chore: snapshot v2 WIP before phase 61 execution` (2026-04-14) already added both methods to the `mockPrisma.contract` block of `packages/api/src/routers/__tests__/contractor.test.ts` (lines 73-77). Per CONTEXT.md **D-03**, that remediation step drops out of the plan.
- **A NEW pre-existing blocker surfaced.** All `packages/api` router test suites (contractor / invoice / organization / einvoice variants) currently fail to *load* — not because of Phase 57 issues, but because `packages/api/vitest.config.ts:17` aliases `@contractor-ops/einvoice` to a single FILE (`einvoice/src/index.ts`) while `packages/validators/src/zatca.ts` (transitively imported via `validators/src/index.ts`) imports from the SUBPATH `@contractor-ops/einvoice/zatca/schemas`. Vitest's prefix-matching resolves that subpath to `einvoice/src/index.ts/zatca/schemas` and throws `ENOTDIR`. Without this fix, Phase 66 cannot prove ANY contractor / invoice / organization router truth — the verification doc would have to declare "tests cannot load" which fails D-16's GREEN requirement.

**This shifts the test-fix stream from "extend mock harness" to "repair vitest alias chain so tests can load again."** Per CONTEXT.md D-08 the scope broadens minimally to whatever is required to make the affected suites green. The fix is a one-line vitest config change — see Plan 66-01 below.

`gov-api-clients.test.ts` (the 4th target in D-04's command list) loads fine and reports **6/6 PASS** on HEAD because it doesn't pull `validators` into its import graph.

</summary>

<revalidation>
## D-04 Re-validation (executed 2026-04-26)

### Build / typecheck

```
$ pnpm --filter @contractor-ops/api typecheck
None of the selected packages has a "typecheck" script
```

`packages/api/package.json` has `"build": "tsc"` and `"test": "vitest run"`. **There is no `typecheck` script** at the api package level. Adopt `pnpm --filter @contractor-ops/api build` (= `tsc`, which performs no-emit type-checking via the package's tsconfig) as the per-plan typecheck gate. Phase 65 used `npx tsc --noEmit` directly inside `packages/api`; Phase 66 follows the same pattern.

```
$ cd packages/api && npx tsc --noEmit
EXIT: 0   (per Phase 65 D-04 baseline; re-confirmed below in 66-01)
```

### Targeted test command (per CONTEXT.md D-04)

```
$ pnpm --filter @contractor-ops/api test -- --run contractor.test invoice.test gov-api-clients
```

| Test file | Result | Root cause |
|-----------|--------|-----------|
| `packages/api/src/routers/__tests__/contractor.test.ts` | **FAIL TO LOAD** (0 tests run) | Vitest alias chain breaks at `validators/zatca.ts` → `@contractor-ops/einvoice/zatca/schemas` |
| `packages/api/src/routers/__tests__/invoice.test.ts` | **FAIL TO LOAD** (0 tests run) | Same root cause |
| `packages/api/src/__tests__/gov-api-clients.test.ts` | **6/6 PASS** | Doesn't load validators in its import graph |
| `packages/api/src/routers/__tests__/einvoice.test.ts` | **FAIL TO LOAD** (collateral) | Same root cause |
| `packages/api/src/routers/__tests__/organization.test.ts` | **FAIL TO LOAD** (collateral) | Same root cause |

**Error excerpt:**

```
Error: ENOTDIR: not a directory, open '/Users/.../packages/einvoice/src/index.ts/zatca/schemas'
 ❯ ../validators/src/zatca.ts:11:1
```

### Per-bug status against current HEAD (mirrors Phase 65 D-04 table format)

| Item from CONTEXT.md | Status | Evidence |
|----------------------|--------|----------|
| **D-06** Mock harness missing `contract.count` / `contract.groupBy` | **CLOSED** | `git blame -L 73,77 packages/api/src/routers/__tests__/contractor.test.ts` → commit `0df1164f` (2026-04-14) added both. The 3 named failing tests (`archive`, `updateLifecycleStage INACTIVE`, `bulkArchive`) cannot fail on this cause anymore; they fail only because the suite can't load. |
| **D-04** Vitest can run targeted suites and report green | **OPEN — NEW** | Suites can't load. Vitest alias for `@contractor-ops/einvoice` points to a single file but is referenced as a multi-export package via the validators barrel. |
| **Plan 57-04 Task 3** 9 operator scenarios still manual | **OPEN** | No vitest equivalents exist for the 9 (10 sub-scenario) flows from `57-04-PLAN.md` lines 521-593. Per CONTEXT.md D-09..D-12 these become deterministic MSW-driven tests in this phase. |
| **57-VERIFICATION.md** | **MISSING** | File does not exist in `.planning/phases/57-government-api-clients/`. |

### Net scope adjustment

CONTEXT.md scope assumed three streams (re-run + harness fix + MSW). After D-04:

1. **Re-run** stays — but the re-run is now the closing acceptance step in Plan 66-04, after the alias fix unblocks loading.
2. **Test-fix stream pivots** — the underlying defect is the einvoice-alias chain in `packages/api/vitest.config.ts`, not the mock harness. Plan 66-01 captures this. Per CONTEXT.md **D-08** ("If the harness change ripples into other suites, scope broadens minimally to make those green too — no other test logic changes"), broadening to "fix the alias so the suites load" is the same shape of minimal-scope broadening, just one layer further out.
3. **MSW scenario stream** stays — Plans 66-02 (router-level scenarios) and 66-03 (UI-level scenarios) implement the 9 sub-scenarios verbatim from `57-04-PLAN.md`.
4. **Verification artifact** stays — Plan 66-04 produces `57-VERIFICATION.md` after streams 1-3 land green.

</revalidation>

<vitest_alias_diagnosis>
## Vitest alias chain — exact path

**Config:** `packages/api/vitest.config.ts:14-24`

```ts
resolve: {
  alias: {
    ...
    '@contractor-ops/einvoice': path.join(packagesDir, 'einvoice/src/index.ts'),
    '@contractor-ops/validators/minimal-server-env': ...,
    '@contractor-ops/validators': path.join(packagesDir, 'validators/src/index.ts'),
    '@contractor-ops/test-utils': path.join(packagesDir, 'test-utils/src/index.ts'),
  },
},
```

**Import chain that breaks:**

1. Test file imports from `'../../routers/contractor.js'` (or invoice / organization).
2. Router source imports from `'@contractor-ops/validators'` → vitest alias rewrites to `packages/validators/src/index.ts`.
3. `packages/validators/src/index.ts:635-643` re-exports from `'./zatca.js'`.
4. `packages/validators/src/zatca.ts:11` imports from `'@contractor-ops/einvoice/zatca/schemas'`.
5. Vitest matches the alias prefix `@contractor-ops/einvoice` → rewrites to `packages/einvoice/src/index.ts/zatca/schemas` (concatenating the remainder of the original import).
6. Filesystem returns `ENOTDIR` because `index.ts` is a file, not a directory.

**Fix shape (smallest possible):** change the einvoice alias from a file path to a directory path so vitest can resolve `/zatca/schemas` (or `/zatca/types`) correctly.

The einvoice package layout under `packages/einvoice/src/` mirrors the dist (`profiles/zatca/schemas.ts`), so the alias should resolve to `packages/einvoice/src` and individual subpath imports map naturally:

- `@contractor-ops/einvoice` → `packages/einvoice/src/index.ts` (root entry)
- `@contractor-ops/einvoice/zatca/schemas` → `packages/einvoice/src/profiles/zatca/schemas.ts`
- `@contractor-ops/einvoice/zatca/types` → `packages/einvoice/src/profiles/zatca/types.ts`

Vite supports this via an array-of-aliases pattern, with the most-specific subpath aliases listed BEFORE the bare-package alias. Phase 66-01 implements exactly this.

**Verification scope after fix:** Plan 66-01 must re-run all 5 affected suites (`contractor.test`, `invoice.test`, `organization.test`, `einvoice.test`, `gov-api-clients.test`) plus the `ksef.test` and `zatca.test` files (which mock einvoice and may be affected). All must report tests-discovered-and-run, with no NEW logic regressions versus what Phase 57 SUMMARY documented.

</vitest_alias_diagnosis>

<msw_scenario_blueprint>
## Scenario Blueprint — 9 (10 sub-) scenarios from 57-04-PLAN.md Task 3

Per CONTEXT.md **D-09**, the scenarios listed in `57-04-PLAN.md` lines 521-593 are copied verbatim, not re-imagined. Per **D-11**, router-flow tests live in `packages/api/src/routers/__tests__/` and UI-driven tests live in `apps/web/src/components/.../__tests__/`. Per **D-10**, all scenarios drive existing MSW handlers from `@contractor-ops/test-utils/msw/handlers/{hmrc,vies}.ts`; no new handlers are introduced.

### Two-layer "MSW-driven" model

The codebase already has **two layers** of automation that combined satisfy the "MSW-driven deterministic" criterion:

- **Layer A — gov-api package MSW integration tests** (`packages/gov-api/src/clients/__tests__/*.msw.integration.test.ts`). These exercise `HmrcVatClient` and `ViesClient` against `createMockServer({ extraHandlers: selectHandlers(['hmrc'/'vies']) })` for a real fetch round-trip with a real `RequestCapture`. They cover §1 (happy), §2 (sad), §4 (MS_UNAVAILABLE) at the wire level. **These already exist on HEAD, green.**
- **Layer B — api router tests** (`packages/api/src/routers/__tests__/*.test.ts`). These mock `validateTaxId` (orchestrator) at the call boundary and assert dispatch behaviour at the router level. They cover §1, §1b (3 cases), §2 (BAD_REQUEST flavor), §4 (stale soft-fail), §5, §6, §7 (full), §8 (router-level RC detection). **Most already exist on HEAD; gaps below are the Phase 66 add.**

The CONTEXT.md `<code_context>` "Reusable Assets" section explicitly lists "MSW handlers for HMRC + VIES — Already provisioned" and the api router tests use the established mocked-orchestrator pattern (consistent with how `validateTaxId` is unit-tested separately at the service layer in `packages/api/src/services/__tests__/`). Phase 66 does NOT unmock `validateTaxId` in the router tests because (a) the orchestrator's MSW behaviour is already covered at Layer A, (b) unmocking would require a shared MSW server lifecycle across ~70 contractor.test cases — large blast radius for no marginal coverage gain.

The Phase 66 work therefore is to **fill the specific coverage gaps where the existing two layers leave a Phase 57 truth un-asserted**, not to duplicate the gov-api Layer A tests at the router level.

### Existing-coverage audit (HEAD as of 2026-04-26)

| 57-04-PLAN.md sub-scenario | CONTEXT.md D-09 name | Layer A test (gov-api) | Layer B test (api router/UI) | Phase 66 add? |
|----------------------------|----------------------|------------------------|------------------------------|---------------|
| §1 HMRC happy path | HMRC happy | `hmrc-vat-client.msw.integration.test.ts` `checkVatNumber returns valid result for sandbox VRN (193054661)` | contractor.test §781 `validateVat dispatches GB_VAT for a UK contractor` | No — both layers covered |
| §1b D-07 profile-save (3 sub-cases: change/unchanged/clear) | D-07 trigger 1 | (orchestrator-internal; not router-level) | contractor.test §911/928/939 (3 tests) | No — covered |
| §2 HMRC 404 sad path (response_status=invalid) | HMRC sad | `hmrc-vat-client.msw.integration.test.ts §77` only covers the **GB checksum preflight short-circuit** (`GB555555555` fails inline checksum, never reaches network). The **post-network 404 path** is NOT covered at Layer A. | contractor.test §818 (BAD_REQUEST for non-GB country, NOT a 404 invalid-VRN flow) | **YES — gap at BOTH layers. Add (a) `hmrc-vat-client.msw.integration.test.ts` case with a checksum-passing VRN whose MSW handler returns 404 → assert `status: 'invalid'` after a real fetch (b) `contractor.test.ts` router-level case where `validateTaxIdMock` returns `responseStatus: 'invalid'` and assert the result surfaces to caller as `invalid` without throwing.** |
| §4 VIES soft-fail (stale) | VIES soft-fail | `vies-client.msw.integration.test.ts` MS_UNAVAILABLE branch | contractor.test §869 `revalidateVat returns stale responseStatus when orchestrator soft-fails (D-08)` | No — covered |
| §5 GB rate preselect | GB preselect | n/a (no API call) | invoice.test §994 `GB org invoice pre-selects the isDefault TaxRate code 20 — PAY-02` | No — covered |
| §6 DE rate preselect | DE preselect | n/a | invoice.test §1007 `DE org invoice pre-selects the isDefault TaxRate code 19 — PAY-04` | No — covered |
| §6 (cont) DE Kleinunternehmer forced KU | KU forced | n/a | invoice.test §1019 `DE Kleinunternehmer org forces invoice vatRate to KU — PAY-04 (§19 UStG)` | No — covered |
| §6 organization.setKleinunternehmer DE-only gate | KU gate | n/a | **NO setKleinunternehmer test in organization.test (file has only 4 tests, all for getCurrent / update)** | **YES — gap. Add (a) DE org → flag flips, (b) non-DE org → throws FORBIDDEN, (c) AuditLog row written.** |
| §7 RC auto-detect | RC auto-detect | n/a | invoice.test §1032 `auto-selects RC when detectReverseCharge reports shouldApply=true` | No — covered |
| §7 RC override + reason audit | RC override audit | n/a | invoice.test §1108 `persists AuditLog when user disables auto-detected RC with a reason (D-13)` | No — covered |
| §7 RC override missing reason → ZodError | RC override refusal | n/a | invoice.test §1150 `rejects reverseChargeOverride=false without a reason (Zod refine)` | No — covered |
| §8 UK RC footer locked phrase render | UK RC footer | n/a | invoice-footer-legal-notices.test.tsx §47 `renders UK reverse charge notice` asserts `data-notice='uk-reverse-charge'` + literal phrase `'Reverse charge: Customer to pay the VAT to HMRC'` + `lang='en'` | No — covered |
| §4 (UI side) stale pill display | Stale pill UI | n/a | vat-validation-status-pill.test.tsx §23 `renders "Stale" badge for stale status` asserts visible label + `data-status='stale'` | No — covered |
| §9 a11y spot-check | a11y | n/a | (no axe-core in repo per D-12) | No — `manual_only[]` per D-12 |

**Net Phase 66 work after audit:**

- **Plan 66-02 (router-layer fills):** Add 1 contractor.test case (§2 HMRC 404 invalid surfaced via orchestrator mock returning `responseStatus: 'invalid'`) + 3 organization.test cases (setKleinunternehmer DE flips flag, non-DE FORBIDDEN, audit row written). **= 4 new router tests.**
- **Plan 66-03 (Layer A wire-level fill for §2):** Add 1 hmrc-vat-client.msw.integration.test.ts case with a checksum-passing VRN whose handler returns 404 → assert `status: 'invalid'` after real fetch. **= 1 new MSW integration test.**
- UI tests for §8 and §4: NO new tests — both already covered on HEAD.

**Why this is the right scope:** the user-facing claim of CONTEXT.md is "replace 9 manual operator scenarios with deterministic MSW-driven vitest equivalents so PAY-03/05 acceptance no longer requires HMRC sandbox credentials." After the existing-coverage audit, the literal-replacement claim is **already 80% true on HEAD**; Phase 66's work is to close the remaining 20% so 57-VERIFICATION.md can map every PAY-02..05 truth to a passing test ID, both at Layer A (MSW wire-level) and Layer B (router/UI behaviour-level). Per CONTEXT.md D-03 ("drop any remediation step at planning time if a recent commit on v2 already resolved the underlying issue"), the same logic applies to scenarios already covered.

</msw_scenario_blueprint>

<verification_doc_template>
## 57-VERIFICATION.md frontmatter blueprint

Per CONTEXT.md **D-15** the doc mirrors `63-VERIFICATION.md`. Concrete frontmatter to write in Plan 66-04:

```yaml
---
phase: 57-government-api-clients
verified: 2026-04-XX  # filled at write time
status: verified  # only when all D-16 conditions hold
score: N/N must-haves verified  # filled from Phase 57 truth list

re_verification:
  previous_status: pending  # 57 reached "approved" via VALIDATION.md, but never had a VERIFICATION.md
  previous_score: 0/N
  gaps_closed:
    - "9 manual operator scenarios from Plan 57-04 Task 3 replaced with deterministic MSW vitest equivalents (Plan 66-02 + 66-03)"
    - "Vitest alias chain repaired so packages/api router tests can load (Plan 66-01)"
  gaps_remaining: []  # if any non-deferred remain after re-run, status reverts to gaps_found
  regressions: []
  fix_commits:
    - hash: "<66-01 commit>"
      scope: "fix(66-01): repair @contractor-ops/einvoice subpath alias in api vitest config"
      files:
        - "packages/api/vitest.config.ts"
      changes:
        - "Replace single-file alias '@contractor-ops/einvoice'→einvoice/src/index.ts with array-of-aliases enumerating /zatca/schemas, /zatca/types, and the bare entry."
    - hash: "<66-02 commit>"
      scope: "fix(66-02): MSW-driven router scenarios for PAY-02..05 (replaces Plan 57-04 Task 3 §1, 1b, 2, 4, 5, 6, 7, 8 manual)"
      files:
        - "packages/api/src/routers/__tests__/contractor.test.ts"
        - "packages/api/src/routers/__tests__/invoice.test.ts"
        - "packages/api/src/routers/__tests__/organization.test.ts"
      changes:
        - "Add N MSW-driven scenarios using existing @contractor-ops/test-utils/msw/handlers/{hmrc,vies} handlers."
    - hash: "<66-03 commit>"
      scope: "fix(66-03): MSW-driven UI scenarios for PAY-04 (locked-phrase footer + stale pill)"
      files:
        - "apps/web/src/components/invoices/__tests__/invoice-footer-legal-notices.test.tsx"
        - "apps/web/src/components/contractors/__tests__/vat-validation-status-pill.test.tsx"
      changes:
        - "Add UK-RC footer locked-phrase render assertion + stale-state pill render assertion."

manual_only:
  - test: "WCAG / a11y keyboard + color-only spot-check on Phase 57 UI surfaces"
    expected: "Keyboard tab order reaches VAT pill + Revalidate button + Kleinunternehmer toggle + RC line toggle. Pill variants always show icon + text (no color-only signaling). Stale pill tooltip is screen-reader accessible."
    why_human: "No axe-core / matcher-based a11y test infrastructure currently exists in apps/web. Adding it is out of scope per CONTEXT.md D-12; spot-check stays manual until a future test-infra phase."
    deferral_pattern: "STATE.md Manual-Only Verifications convention"

  - test: "HMRC live sandbox round-trip on a real GB VRN (PAY-03 production-onboarding evidence)"
    expected: "Once HMRC Developer Hub registration completes (~2-week wait), exercise validateVat against the live HMRC sandbox endpoint with real client_id/client_secret to confirm the production-VRN guard tolerates empty platformVrn in sandbox and the OAuth Bearer flow round-trips."
    why_human: "HMRC sandbox credentials are pre-deploy ops infrastructure tracked in STATE.md Blockers. Per CONTEXT.md D-13/14 this is NOT a Phase 66 gate — MSW deterministic tests cover the application code path; live-credential exercise is pre-deploy ops hygiene."
    deferral_pattern: "STATE.md Standing Project Constraints — Legal/regulatory verification deferred convention extended to live-credential ops gates."
---
```

**Truth list to verify (derived from `57-04-SUMMARY.md` Task 1 acceptance criteria + Roadmap Phase 57 success criteria):**

The exact truth count + wording is determined by mining `57-04-SUMMARY.md` "Acceptance Criteria Checklist" + "Roadmap Traceability — Success Criteria → Tests" tables. Plan 66-04 must enumerate them as a numbered list mirroring the table at `63-VERIFICATION.md` lines 80-99.

**D-16 GREEN gate** — status flips to `verified` only when:

1. The 3 named contractor.test.ts cases (`archive`, `updateLifecycleStage INACTIVE`, `bulkArchive`) PASS — re-confirmed after the alias fix unblocks loading. (Per D-03 they should already pass; confirm don't trust.)
2. All N new MSW-driven scenarios from Plans 66-02 + 66-03 PASS.
3. The D-04 re-run command (`pnpm --filter @contractor-ops/api test -- --run contractor.test invoice.test gov-api-clients` + `tsc --noEmit`) reports clean.
4. Each PAY-02..05 row in the truth table maps to specific test IDs that pass.

</verification_doc_template>

<plan_split>
## Plan split rationale

Four plans, one wave each (sequential execution because plan N's verification depends on plan N-1 landing green):

| Plan | Title | Depends on | Files modified | Why split |
|------|-------|------------|----------------|-----------|
| **66-01** | Repair vitest alias chain so api router tests can load | none | `packages/api/vitest.config.ts` | Prerequisite — without this, every contractor / invoice / organization router test suite fails to load and Phase 66 cannot prove ANY downstream truth. Smallest possible change (alias config edit), separate atomic commit per D-19. |
| **66-02** | Router-layer coverage fills (§2 HMRC 404 invalid + §6 setKleinunternehmer DE-only) | 66-01 | `packages/api/src/routers/__tests__/contractor.test.ts`, `packages/api/src/routers/__tests__/organization.test.ts` | API-layer gap fills isolated in one commit. Plan 66-01's alias fix unblocks loading; this plan adds the missing assertions. |
| **66-03** | gov-api MSW Layer A coverage fill (§2 HMRC post-network 404) | none (independent of 66-01 — gov-api package has its own vitest config) | `packages/gov-api/src/clients/__tests__/hmrc-vat-client.msw.integration.test.ts` | The Layer A wire-level sad path is currently absent (existing test only covers the checksum preflight short-circuit). Adding it here matches the existing MSW integration test pattern and is the deterministic substitute for "operator hits HMRC sandbox 404". Distinct commit scope from 66-02 because it touches a different package + different test layer. |
| **66-04** | Write `57-VERIFICATION.md` + flip Phase 57 manager flags | 66-01, 66-02, 66-03 | `.planning/phases/57-government-api-clients/57-VERIFICATION.md` | Documentation-only commit (`docs(66-04)`). Per D-19 separates code from docs in commit history; per D-18 the manager-flag flip via gsd-sdk is the closing action. |

Total: 4 plans, 4 commits, mirroring Phase 65's atomic-fix commit cadence.

</plan_split>

<final_scope>
## Final Phase 66 scope

Four plans:

1. **66-01-PLAN.md** — `fix(66-01): repair @contractor-ops/einvoice subpath alias in api vitest config`
2. **66-02-PLAN.md** — `test(66-02): close router-layer gaps for §2 HMRC 404 invalid + §6 setKleinunternehmer DE-only gate (PAY-03/PAY-04)`
3. **66-03-PLAN.md** — `test(66-03): close Layer A MSW gap for §2 HMRC post-network 404 (PAY-03)`
4. **66-04-PLAN.md** — `docs(66-04): 57-VERIFICATION.md + flip Phase 57 manager flags`

**Items dropped from CONTEXT.md after D-04 re-validation:**

- Mock-harness extension for `contract.count` / `contract.groupBy` — already landed in commit `0df1164f` per D-03.
- Bulk MSW scenario suite for §1, §1b, §4-§8 — already automated at HEAD (per existing-coverage audit table). Per D-03's logic these scenarios are dropped from the plan and instead documented in 57-VERIFICATION.md as "already covered" with their existing test IDs.

**Items added by D-04 re-validation (NEW SCOPE):**

- Vitest alias repair (Plan 66-01) — NEW prerequisite blocker discovered during D-04 re-run that prevents ALL router tests from loading. Per D-08 spirit, scope broadens minimally to make the affected suites green.

**Items deferred per CONTEXT.md decisions:**

- Accessibility spot-check (Task 3 §9) — `manual_only[]` per D-12.
- HMRC live sandbox credential exercise — `manual_only[]` per D-13/14.

</final_scope>

## Validation Architecture

**Approach:** Per-plan typecheck + targeted-test gate (CONTEXT.md D-20). No new VALIDATION.md needed for Phase 66 — Phase 57 already has an approved VALIDATION.md; Phase 66 produces VERIFICATION.md as the goal-backward artifact.

**Per-plan acceptance commands (every plan):**

```bash
cd packages/api && npx tsc --noEmit             # zero errors
pnpm --filter @contractor-ops/api test -- --run <suites-touched>   # all green
```

**Phase-closure acceptance command (Plan 66-04):**

```bash
cd packages/api && npx tsc --noEmit
pnpm --filter @contractor-ops/api test -- --run contractor.test invoice.test gov-api-clients organization.test
pnpm --filter @contractor-ops/web test -- --run vat-validation-status-pill invoice-footer-legal-notices
```

All commands report exit 0 + no failed assertions before `57-VERIFICATION.md` flips to `status: verified`.

**Why this is sufficient (Nyquist self-check):**

- Layer 1 — type system: `tsc --noEmit` proves the router code compiles against canonical Prisma types.
- Layer 2 — unit/integration tests: MSW-driven scenarios prove the routers and components do what PAY-02..05 require.
- Layer 3 — frontmatter scoring: 57-VERIFICATION.md must enumerate each Phase 57 truth and map it to a test ID, mirroring `63-VERIFICATION.md` lines 80-99.
- Layer 4 — manual-only deferrals: a11y + live-HMRC sandbox are explicitly enumerated in `manual_only[]` (Pre-Deploy Manual-Only Verifications) — no silent omissions per D-17.
</content>
</invoke>