# Phase 65: Phase 63 Critical Bug Fixes - Context

**Gathered:** 2026-04-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Close the v5.0 audit gaps for Phase 63 routers so that:

- `late-payment-interest.ts` router compiles and routes correctly (correct flag key, valid TRPCError codes, type-safe Prisma access)
- `services/late-payment-interest.ts` produces LPCDA-correct claim letters (`daysOverdue` from `overdueStartMs`, not `dueDateMs`)
- `skonto.ts` router computes monetary amounts against canonical Invoice schema fields (`amountToPayMinor`, plural relations `billingProfiles` / `skontoTerms`, `contractor` resolved through includes)
- `admin-boe-rate.ts` permission check stays type-safe (already fixed — verify no regressions)

Out of scope: any feature work, UI changes, new tRPC procedures, schema migrations, or fixes outside the three Phase 63 routers + the two Phase 63 services they depend on. New capabilities belong in their own phases.

</domain>

<decisions>
## Implementation Decisions

### Scope (D-01 .. D-04)
- **D-01:** Comprehensive scope — fix every gap listed in `.planning/phases/63-uk-payments-financial-features/63-VERIFICATION.md` under `gaps_remaining` and `new_findings`, not just the 4 success criteria named in ROADMAP.md.
- **D-02:** Treat the 2 already-landed fixes (CR-01 flag key on all 6 procedures, CR-03 `admin:boe-rate` registration) as done — verify no regression, do not re-touch.
- **D-03:** Bug inventory locked from `63-VERIFICATION.md`:
  - **B-01 (CR-02 — skonto field):** `packages/api/src/routers/skonto.ts:280` references `invoice.totalMinor`; canonical field for late-payment monetary calculation is `invoice.amountToPayMinor`. Verify against the success criterion ("line 287 uses `invoice.amountToPayMinor`") and align.
  - **B-02 (CR-02b — skonto include path):** `packages/api/src/routers/skonto.ts:244` uses `include: { billingProfile }` (singular). Canonical Prisma relation is `billingProfiles` (plural). 1× TS2561.
  - **B-03 (CR-02c — skonto skontoTerm references):** Lines 261, 263, 264, 265 reference `invoice.skontoTerm` (singular). Canonical relation is `skontoTerms` (plural array). 4× TS2339.
  - **B-04 (CR-02d — skonto contractor reference):** Lines 269, 272, 275, 277 reference `invoice.contractor` but the relation is not in the `include` path. 4× TS2551.
  - **B-05 (daysOverdue source):** `packages/api/src/services/late-payment-interest.ts:213` computes `daysOverdue = floor((endDateMs - dueDateMs) / day)`. LPCDA-correct value uses `overdueStartMs` (which already exists at line 196: `dueDateMs + 24 * 60 * 60 * 1000`).
  - **B-06 (CR-01b — TRPCError code):** `packages/api/src/routers/late-payment-interest.ts:462,469` use `code: 'FAILED_PRECONDITION'`. The valid tRPC v11 code is `PRECONDITION_FAILED`.
  - **B-07 (CR-01c — Prisma narrowing):** `packages/api/src/routers/late-payment-interest.ts:78,226,435` fail Prisma client narrowing around `boEBaseRateHistory`. Likely root cause: tenant-scope adapter not preserved when calling `loadBoeRateHistory(ctx.db)`. Investigate and resolve.
- **D-04:** Re-validate at planning time — re-run `pnpm typecheck` against `packages/api` immediately when planning starts, since the v2 branch has moved since 63-VERIFICATION.md was written. Drop any item from B-01..B-07 already resolved by intervening commits.

### Test/regression strategy (D-05 .. D-07)
- **D-05:** Add a focused regression test per fix (one test → one bug) that would have caught the original failure. Tests live next to the code under test (`packages/api/src/routers/__tests__/` and `packages/api/src/services/__tests__/`).
- **D-06:** Tests must exercise the corrected behavior at the level where it broke:
  - Schema-relation bugs (B-01..B-04) — integration tests using a real Prisma client (in-memory or pg-mem) against the canonical schema, NOT mocked responses with the broken field names. Existing skonto router tests passed against broken code precisely because they mocked the bad field names — that anti-pattern must not recur.
  - Math bugs (B-05) — unit test on the service that asserts `daysOverdue` equals expected value when an invoice is overdue by exactly 1 day, exactly 30 days, and on the boundary at midnight.
  - tRPCError code (B-06) — assert the procedure throws with code `PRECONDITION_FAILED` for the precondition path.
  - Prisma narrowing (B-07) — type test (no runtime needed) that the narrowed `ctx.db` resolves `boEBaseRateHistory` without a cast.
- **D-07:** Existing skonto/late-interest tests that passed against broken code are themselves bugs — update them to use canonical field names and remove the mocks that masked the original failure.

### Commit atomicity (D-08 .. D-10)
- **D-08:** One atomic commit per fix. Commit subject format: `fix(65-NN): <one-line summary>` matching the established Phase 63 convention (`fix(63-05): repair late-interest router type errors`).
- **D-09:** Plan granularity mirrors commits — one PLAN.md per fix (65-01 through 65-07 max). Plans for already-resolved bugs are dropped during the validation pass in D-04.
- **D-10:** Each fix commit MUST also include the regression test that locks the corrected behavior (per D-05). Commit must not land if `pnpm typecheck` and the new test fail.

### Verification gate (D-11 .. D-13)
- **D-11:** During execute, every plan completes only when:
  1. `pnpm --filter @contractor-ops/api typecheck` passes clean on the changed file
  2. The new regression test passes
  3. Existing tests in the affected file still pass (no regression in the test suite that masked the bug)
- **D-12:** After all fix plans land, run `/gsd-verify-work 63` (re-verify Phase 63) — NOT a fresh verify of Phase 65 — to formally close `63-VERIFICATION.md` from `gaps_found` → `verified`.
- **D-13:** Phase 65 itself gets a `65-VERIFICATION.md` confirming all D-03 bug-IDs are resolved AND that re-verify of Phase 63 succeeded. This is the phase's exit gate.

### Claude's Discretion
- Exact test file naming if a regression case doesn't fit existing test files
- How to spike on B-07 (Prisma narrowing) — root-cause investigation may reveal a generic ctx-adapter helper that fixes other call sites; if so, scope confined to Phase 63 routers
- Whether `pnpm typecheck` runs at the package level or via `turbo typecheck` in CI gate (functional equivalent)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Source of truth for bugs
- `.planning/phases/63-uk-payments-financial-features/63-VERIFICATION.md` — Authoritative bug inventory (`gaps_remaining` + `new_findings`). Every fix in Phase 65 must trace back to a row here.
- `.planning/ROADMAP.md` §"Phase 65: Phase 63 Critical Bug Fixes" — Success criteria (4 named) and dependency declaration.

### Phase 63 context to honor
- `.planning/phases/63-uk-payments-financial-features/63-CONTEXT.md` — Phase 63 implementation decisions (feature flag naming, monetary precision rules, schema patterns).
- `.planning/phases/63-uk-payments-financial-features/63-05-PLAN.md` — Late-payment interest plan (router + service shape).
- `.planning/phases/63-uk-payments-financial-features/63-05-SUMMARY.md` — What 63-05 actually shipped (vs. planned).
- `.planning/phases/63-uk-payments-financial-features/63-06-PLAN.md` — Skonto eligibility plan.
- `.planning/phases/63-uk-payments-financial-features/63-06-SUMMARY.md` — What 63-06 actually shipped (vs. planned).

### Files being fixed
- `packages/api/src/routers/late-payment-interest.ts` — TRPCError code + Prisma narrowing fixes (B-06, B-07). Already-fixed lines for flag key (lines 49, 178, 283, 343, 388, 567) must remain `requireFeatureFlag('payments.late-interest-enabled')`.
- `packages/api/src/services/late-payment-interest.ts` — `daysOverdue` source fix (B-05). `overdueStartMs` already computed at line 196 and ready to use.
- `packages/api/src/routers/skonto.ts` — Schema relation + field fixes (B-01..B-04).
- `packages/api/src/services/skonto.ts` — May need touch-up depending on B-01 alignment.
- `packages/api/src/routers/admin-boe-rate.ts` — Already passes (B-03/CR-03 done). Verify no regression only.
- `packages/auth/src/permissions.ts` — Source of `accessControlStatement`. `'admin:boe-rate': ['read', 'write']` registered at line 32 — protect from regression.

### Test homes (regression tests land here)
- `packages/api/src/routers/__tests__/late-payment-interest.test.ts`
- `packages/api/src/routers/__tests__/skonto.test.ts`
- `packages/api/src/routers/__tests__/admin-boe-rate.test.ts`
- `packages/api/src/services/__tests__/late-payment-interest.test.ts`
- `packages/api/src/services/__tests__/skonto.test.ts`

### Project-level standing constraints
- `.planning/STATE.md` §"Standing Project Constraints" — Local-only deploy, no production data, legal sign-off deferred. Applies: do NOT block Phase 65 on legal review of late-interest claim letter wording.
- `.planning/PROJECT.md` Key Decisions — General architectural decisions (re-read before planning to avoid contradiction).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`requireFeatureFlag` middleware** (`packages/api/src/middleware/feature-flag.js`) — Already typed with `K extends FlagKey = keyof typeof FLAGS`. Misuse is now a TS2345 at the call site, which is exactly how CR-01 was caught. No work needed; rely on it.
- **`accessControlStatement`** (`packages/auth/src/permissions.ts:12`) — Single registry for resource:action permissions. Adding a permission requires adding it here AND it propagates to `dist/permissions.d.ts` via build. Already includes `'admin:boe-rate': ['read', 'write']`.
- **`overdueStartMs`** (`packages/api/src/services/late-payment-interest.ts:196`) — Already computed as `dueDateMs + 24 * 60 * 60 * 1000`. B-05 fix is a one-token change at line 213; the helper variable is sitting there waiting.
- **Existing test helpers** in `packages/api/src/routers/__tests__/` — Use the same harness (caller, mocked ctx, real Prisma adapter) that the existing tests use, but switch from mock-prisma-with-broken-fields to real Prisma so canonical schema is enforced.

### Established Patterns
- **Phase 63 commit convention:** `fix(63-NN): <imperative summary>` — Phase 65 mirrors this as `fix(65-NN): ...`.
- **One PLAN.md per discrete unit of work** — Phase 63 had 7 plans; Phase 65 follows same granularity (one plan per bug). Plans named `65-01-PLAN.md` through `65-07-PLAN.md`.
- **TRPCError codes are tRPC v11 typed string literals** (`'PRECONDITION_FAILED'`, etc.) — IDE/typecheck catches typos at compile time. B-06 is a typo bug.
- **Prisma includes are typed** — `invoice.skontoTerm` vs `invoice.skontoTerms` is a 4-character schema discrepancy that the typecheck catches; the bug only existed because tests mocked the broken shape (anti-pattern flagged in D-07).

### Integration Points
- **Phase 64 (Legal Compliance Hardening)** — completed; Phase 65 must not break the feature-flag gating Phase 64 added on classification routes. Verify late-interest fixes don't widen the flag surface.
- **`accessControlStatement` is consumed by `requirePermission`** — touching `permissions.ts` rebuilds `dist/permissions.d.ts`. Phase 65 should not need to touch `permissions.ts` (B-03 already done) but if it does, `pnpm --filter @contractor-ops/auth build` is required before tests.
- **No DB migration** — Phase 65 fixes consume existing Prisma schema fields/relations that already exist. Zero migration risk.

</code_context>

<specifics>
## Specific Ideas

- "The existing skonto/late-interest tests passed against broken code precisely because they mocked the broken field names" — this is the key insight from 63-VERIFICATION.md. Regression tests for Phase 65 must NOT mock the canonical schema; they must hit a real (or pg-mem) Prisma client so schema drift is caught at test time, not at runtime against Neon.
- The phase is an audit-gap closure phase — every commit message and SUMMARY entry should reference the corresponding bug-ID (B-01..B-07) and the source row in `63-VERIFICATION.md` so the audit trail stays linkable.
- Recent commits `415794cb`, `929b0e1d`, `ece79f07` already partially address some bugs. D-04 mandates re-validation at planning time so the plan reflects current truth, not the snapshot in 63-VERIFICATION.md.

</specifics>

<deferred>
## Deferred Ideas

- **Generic tenant-scope adapter helper** — if B-07's investigation reveals the `ctx.db` narrowing failure is a pattern affecting other Phase 63+ routers, a shared helper extraction is warranted. Confine the helper change to Phase 63 router files within Phase 65; broader rollout to Phases 56..64 routers belongs in a future cleanup phase.
- **Test-mock anti-pattern audit** — the "mocked Prisma with broken field names hiding real bugs" pattern (D-07 + Specifics) likely affects other phases' router tests. A repo-wide audit + cleanup is its own phase, not Phase 65.
- **Test infra: real-Prisma harness vs mocks** — Phase 65 will use whichever is already established (pg-mem or in-memory). Standardizing test-DB strategy across `packages/api` is its own infra phase.
- **Phase 67 verification work** — Phase 56 + 58 verification (per ROADMAP.md Phase 67) is explicitly out of scope.

### Reviewed Todos (not folded)
None — `.planning/STATE.md` "Pending Todos" was empty at gather time.

</deferred>

---

*Phase: 65-phase-63-critical-bug-fixes*
*Context gathered: 2026-04-26*
