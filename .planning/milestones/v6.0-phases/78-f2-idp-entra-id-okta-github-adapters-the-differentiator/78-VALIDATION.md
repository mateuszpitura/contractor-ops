---
phase: 78
slug: f2-idp-entra-id-okta-github-adapters-the-differentiator
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-31
---

# Phase 78 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (`vitest run`) |
| **Config file** | `packages/integrations/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @contractor-ops/integrations test <file>` |
| **Full suite command** | `pnpm --filter @contractor-ops/integrations test` |
| **Estimated runtime** | ~20-40s (scoped to integrations package) |

> Web-vite UI tests scope per file: `pnpm --filter @contractor-ops/web-vite test <path>` (NEVER run the full web-vite suite — kills RAM).

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @contractor-ops/integrations test <changed-file>`
- **After every plan wave:** Run `pnpm --filter @contractor-ops/integrations test`
- **Before `/gsd:verify-work`:** Full integrations suite green + `pnpm --filter @contractor-ops/integrations typecheck` exit 0
- **Max feedback latency:** ~40 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 78-01-* | 01 | 0 | IDP-05/06/07 | T-78-05 | MSW handlers stub provider APIs; no live network in tests | unit | `pnpm --filter @contractor-ops/integrations test entra-deprovision` | ❌ W0 | ⬜ pending |
| 78-02-* | 02 | 1 | IDP-05/06/07 | — | scope-const typed `as const`; CI lint asserts union↔scope-registry parity | type | `pnpm --filter @contractor-ops/integrations typecheck` | n/a | ⬜ pending |
| 78-03-* | 03 | 2 | IDP-05 | T-78-01 | token never logged; hybrid-AD blocks before mutation; CA warning non-blocking | unit | `pnpm --filter @contractor-ops/integrations test entra-deprovision` | ❌ W0 | ⬜ pending |
| 78-04-* | 04 | 2 | IDP-06 | T-78-02 | DEPROVISIONED/404 → LIKELY_GONE short-circuit; sessions cleared | unit | `pnpm --filter @contractor-ops/integrations test okta-deprovision` | ❌ W0 | ⬜ pending |
| 78-05-* | 05 | 2 | IDP-07 | T-78-03 | outside-collab flagged; SAML PAT revoke best-effort + warn on non-SAML | unit | `pnpm --filter @contractor-ops/integrations test github-deprovision` | ❌ W0 | ⬜ pending |
| 78-06-* | 06 | 3 | IDP-05/06/07 | T-78-04 | per-provider error classification routes retry budget | unit | `pnpm --filter @contractor-ops/integrations test error-classifier` | ❌ W0 (extend) | ⬜ pending |
| 78-07-* | 07 | 3 | IDP-05/06/07 | T-78-06 | tenant from session; zod on mutation inputs; flags PENDING | unit/type | `pnpm --filter @contractor-ops/api test idp` + `typecheck` | ❌ W0 | ⬜ pending |
| 78-08-* | 08 | 4 | IDP-05/06/07 | T-78-06 | loading/empty/error states; a11y; per-provider toggle gated by flag APPROVED | unit | `pnpm --filter @contractor-ops/web-vite test <provider-section>` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/test-utils/src/msw/handlers/entra.ts` — MSW Microsoft Graph handlers (follow `outlook-calendar.ts`)
- [ ] `packages/test-utils/src/msw/handlers/okta.ts` — MSW Okta handlers
- [ ] `packages/test-utils/src/msw/handlers/github.ts` — MSW GitHub handlers (follow `google-workspace.ts` / `slack.ts`)
- [ ] `packages/integrations/src/adapters/__tests__/entra-deprovision.test.ts` — RED stubs for IDP-05
- [ ] `packages/integrations/src/adapters/__tests__/okta-deprovision.test.ts` — RED stubs for IDP-06
- [ ] `packages/integrations/src/adapters/__tests__/github-deprovision.test.ts` — RED stubs for IDP-07
- [ ] `error-classifier` test extended with Entra/Okta/GitHub status cases

*Framework already present (vitest + MSW). No framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real Entra tenant CA-policy enumeration against a live tenant | IDP-05 | Requires a configured Azure AD app + tenant with CA policies; not reproducible in unit tests | Connect a test Entra app, run `describeImpact` on a tenant user, confirm CA policy names render in preview |
| Real Okta org deactivation | IDP-06 | Requires live Okta org + API token | Connect Okta API token, deactivate a sandbox user, confirm status → DEPROVISIONED |
| Real GitHub SAML PAT revocation | IDP-07 | Requires Enterprise-Cloud org with SAML SSO | On a SAML SSO org, run deprovision, confirm credential-authorizations entry removed |
| Hybrid-AD hard-block UX | SC#4 / IDP-05 | UI panel + on-prem-synced identity needed | Trigger deprovision on `onPremisesSyncEnabled:true` user, confirm refusal + status-panel link |

> These are LOCAL-ONLY deferred items per Standing Constraint — flag at `/gsd:verify-work`, not blockers. Unit tests (MSW) cover the logic paths; manual checks validate live-tenant wiring post-deploy.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 40s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
</content>
