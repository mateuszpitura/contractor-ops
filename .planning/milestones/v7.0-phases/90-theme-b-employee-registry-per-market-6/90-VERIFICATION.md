# Phase 90 — Theme B — Employee Registry per Market (×6): Verification

**Verified:** 2026-07-01 (main-session verification — the formal `gsd-verifier` background pass was deferred due to a subagent session-limit; this records an equivalent goal-backward check run inline.)
**Result:** PASS — all 7 plans executed + merged to `main`; phase goal met.

## Phase goal (ROADMAP)
> HR can register an employee in any of the six supported markets (PL/DE/UK/US/AE/SA) with all statutory identifiers validated.

## Plans (7/7 executed + merged)
| Plan | Deliverable | Evidence |
|------|-------------|----------|
| 90-01 | Wave-0 RED scaffolds (validators + country-fields + crypto vectors) | merged |
| 90-02 | Greenfield statutory validators + adviser-verify reference seed tables | merged |
| 90-03 | Employee country-fields registry + PII crypto util + `EMPLOYEE_PII_ENCRYPTION_KEY` | merged |
| 90-04 | `EmployeeProfile` model + `employeePii` RBAC + cross-org leak + additive multi-region migration | `packages/db/prisma/schema/employee.prisma:12`; migration additive-only (prod apply deferred, local-only) |
| 90-05 | `employeeRegistryRouter` register/revealPii + ELStAM stub + PII-mask paths | commits `1d6f427b0`, `9ebd7cab7`, `68cf993b6` |
| 90-06 | Per-market web-vite registration UI (dispatch, masked reveal, advisory, i18n parity en/de/pl/ar) | commits `85cc6bd52`, `ce8ec1eb6`, `65cdee081` |
| 90-07 | Documentation-follows-code: employee-registry wiki + MEMORY invariants | merged `812bdf6ea` (`wiki/domains/employee-registry.md` + structure/pattern sync + MEMORY) |

## Verification method + evidence
- **Typecheck:** `pnpm typecheck --filter=@contractor-ops/api --filter=@contractor-ops/db --filter=@contractor-ops/web-vite --filter=@contractor-ops/ui` — all green (17/17 web-vite tasks, 15/15 api).
- **Tests (scoped, Phase-90 domain):** `employee-pii-crypto`, `worker-regression`, `employee-cross-org-leak`, `employee-registry`, `worker-tenant-isolation` — **5 files / 44 tests all PASS**.
- **Regression fixed during verification:** `rbac-recipients.test.ts` failed because the `ROLE_CONTRACTOR_ACTIONS` mirror in `packages/api/src/services/rbac-recipients.ts` was not updated when Phase 89 added the four HR roles — a real defect (hr_admin/hr_manager were excluded from `contractor:read` notification recipients despite holding the permission). Fixed in commit `f708d81df`; test now 7/7.
- **Doc gates:** `check:web-vite-data-layer` / `-presentational` / `-page-shells` OK; `lint:no-breadcrumbs` OK; `check:wiki-brain` 0 errors.

## Success criteria (goal-backward)
1. ✅ Register an employee in any of PL/DE/UK/US/AE/SA — `employeeRegistryRouter.register` + per-market country-fields dispatch (UI + validators).
2. ✅ All statutory identifiers validated — greenfield validators (PESEL/NI/tax-code/W-4/Emirates ID/Iqama/GOSI…) + reused v5.0/v4.0 validators; enums for Lohnsteuerklasse + Saudization.
3. ✅ National-ID PII encrypted (AES-256-GCM) + `employeePii:read`-gated reveal + audit; tax/social IDs plain-but-gated; masked in logs.
4. ✅ New tenant-owning `EmployeeProfile` never in `globalModels`; cross-org leak test green.

## Notes / carried
- Multi-region **prod** migration apply is deferred-by-design (local-only posture) — additive migration staged.
- Live government lookups (ELStAM/ZUS/NFZ) are stub hooks / seeded reference lists by design (v7.0 scope).
- Unblocks execution of Phase 91 (Akta Osobowe — planned) and Phase 92 (Leave+Time — planned), both of which attach to `EmployeeProfile`.
- Out-of-scope note: the full `packages/api` suite has a small number of pre-existing failures in OTHER (non-Phase-90) test files — separate test-debt, not introduced here.
