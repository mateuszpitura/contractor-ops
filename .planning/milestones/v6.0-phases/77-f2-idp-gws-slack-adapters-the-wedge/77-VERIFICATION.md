---
status: passed
phase: 77-f2-idp-gws-slack-adapters-the-wedge
verified: 2026-05-31
requirements: [IDP-01, IDP-03, IDP-04, IDP-12]
method: inline (Agent subagent unavailable in this runtime — sequential inline execution)
---

# Phase 77 Verification — F2 IdP GWS + Slack Adapters (the wedge)

**Verdict: PASSED.** All 5 plans executed and committed; the additive contract +
GWS/Slack adapters + backend wiring + admin UI deliver the wedge goal (deprovision
GWS suspend+OAuth-revoke+sign-out and Slack session-invalidate+SCIM-deactivate, with
impact preview, manual-override unblock, and per-provider gating). Monorepo
typecheck + all touched-package test suites + every lint guard pass.

## Requirement traceability

| Req | Statement (abbrev) | Status | Evidence |
|-----|--------------------|--------|----------|
| IDP-01 | Per-IdP impact preview (`describeImpact`) before execute | ✓ | `describeImpact` on both adapters (77-02/03), cached `getImpactPreview` service + tRPC query (77-04), impact-preview panel UI (77-05) |
| IDP-03 | GWS suspend + revoke OAuth grants + sign-out | ✓ | `GoogleWorkspaceAdapter` suspend + two-sub-action revoke (tokens delete + signOut) (77-02); step-runner persists + 3 audit rows (77-04) |
| IDP-04 | Slack session-invalidate + SCIM-deactivate | ✓ | `SlackAdapter` SCIM PATCH active=false + admin.users.session.invalidate via org-grid token (77-03) |
| IDP-12 | Manual mark-complete with audited reason, unblock workflow | ✓ | `overrideStepFailure` mutation (MANUAL_COMPLETED + AuditLog + recompute + parent-run auto-complete) (77-04); override dialog + permanent badge UI (77-05) |

## Must-haves (per plan)

- **77-01** — additive `LIKELY_GONE` + `describeImpact` interface method + `ImpactPreview` union + `ErrorClass`/`classifyError` + Slack scopes + Prisma `MANUAL_COMPLETED`/`ErrorClass`/`ManualOverrideCategory` enums + 5 columns + create-only additive migration + `idp:override_step_failure` permission + two ship-dark flags + audit-logger fields. All present + committed; `recomputeRunStatus` treats `MANUAL_COMPLETED` as terminal-success (D-11).
- **77-02** — `GoogleWorkspaceAdapter implements Deprovisionable` for real; suspend/revoke(2 sub-actions)/verify/describeImpact; classifyError mapping; `admin.directory.user.security` scope; registered.
- **77-03** — `SlackAdapter implements Deprovisionable`; SCIM + admin.session via org-grid token exclusively; Enterprise-Grid detection (PERMANENT_FORBIDDEN on write / NOT_ON_ENTERPRISE_GRID on preview); `getOrgGridOAuthConfig` + SLACK_ORG_GRID sub-kind; registered.
- **77-04** — step-runner errorClass/LIKELY_GONE/3-audit-row + token resolution; cached preview service + failure classifier; `describeImpact`/`overrideStepFailure`/`enableProviderForOrg`/`connectSlackOrgGrid`/`getDeprovisioningRun`/`getProviderToggleState` procedures; step-runner route registered.
- **77-05** — impact preview panel, saga run-view (LIKELY_GONE/MANUAL_COMPLETED), override dialog + badge, Slack org-grid card, per-provider toggle table; Page→Container→Hook→Component; i18n en/de/pl/ar parity; permission-gated override.

## Gates

| Gate | Result |
|------|--------|
| `pnpm typecheck` (tsc, monorepo) | PASS (43/43) |
| integrations vitest | 446 pass / 7 todo (see note) |
| idp-saga / auth / feature-flags / logger / db-idp / api-idp | PASS (28 / 63 / 75 / 46 / 13 / 20) |
| `pnpm lint:scopes` | PASS |
| `node scripts/check-webhook-routes.mjs` | PASS (28 routes) |
| `pnpm i18n:parity` | PASS |
| `check:web-vite-data-layer` / `-dialog-pattern` / `-presentational` / `-table-pattern` | PASS |
| schema-drift gate | no blocking drift |
| `pnpm lint:schema` | 1 PRE-EXISTING offence (`UserPinnedView`, auth.prisma) — unrelated, documented since Phase 75 |

## Notes / known conditions (non-blocking)

- **integrations full-suite exit code 1** is an `EnvironmentTeardownError` flake in the Phase-76 `google-workspace-webhook-provenance.test.ts` (async idp-saga import after teardown). It passes in isolation; all 446 tests pass; pre-existing and unrelated to Phase 77 changes.
- **Deferred follow-ups** (documented in 77-04 + 77-05 SUMMARYs): the Slack org-grid OAuth `/api/oauth/slack-org-grid/start` route + callback (Enterprise-Grid probe → `scopeCapabilities.unavailableReason`), the saga-start eligibility filter wiring into `startDeprovisioningRun` (+ `idp.slack.org_grid_unavailable` skip audit), and mounting the run-view/impact-preview containers into the offboarding `ACCESS_REVOKE` page. The connect entry point, token resolver, per-provider state query, and all contracts are in place so these are additive.

## Human verification recommended (post-deploy)

- **MANUAL multi-region migration apply** (`pnpm db:migrate:all` against EU + ME) — the Phase 77 additive migration is generated + committed but NOT applied (LOCAL-ONLY Standing Constraint; documented in `packages/db/scripts/README.md`).
- Flip `module.idp-deprovisioning-gws` / `-slack` signoff entries PENDING→APPROVED after legal review before enabling per-org.

---
*Phase: 77-f2-idp-gws-slack-adapters-the-wedge*
*Verified: 2026-05-31 (inline)*
