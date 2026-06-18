---
title: IdP deprovisioning
type: domain
tags: [idp, okta, entra, deprovision]
source_commit: d839f52eb98d86236bd6d0018bdff84de49427b8
verify_with:
  - packages/api/src/routers/integrations/deprovisioning.ts
  - apps/web-vite/src/components/idp/
  - packages/api/src/services/idp-deprovisioning-step-runner.ts
updated: 2026-06-18
---

# IdP deprovisioning

## Purpose

Deprovisioning eligibility and provider toggles for Okta, Entra, GitHub, Google Workspace, and related IdP integrations when contractors offboard.

## Entry points

| Piece | Path |
|-------|------|
| Router | `deprovisioning` |
| IdP adapters | `packages/integrations/src/adapters/` + deprovision scopes |
| UI | `apps/web-vite/src/components/idp/` |
| Offboarding UI | `components/offboarding/` |

## Related

- [[integrations/entra-okta-github]]
- [[integrations/google-workspace]]
- [[contractors-engagements]]

## Verify live

```bash
semble search "deprovisioningRouter"
```

## Agent mistakes

- Deprovision without audit trail
- Assuming an OFFBOARDING `WorkflowRun` completing auto-starts a `DeprovisioningRun` — it does **not**. `startDeprovisioningRun` is called only from the tRPC mutation (UI `components/idp/hooks/use-start-deprovisioning.ts`); the offboarding template's access-revoke task is a marker, not a saga trigger. Deprovisioning is manual-only — never claim offboarding completion revokes IdP access on its own.
