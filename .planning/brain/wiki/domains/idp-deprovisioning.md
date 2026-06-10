---
title: IdP deprovisioning
type: domain
tags: [idp, okta, entra, deprovision]
source_commit: 70f5782d78e33ba98c82e4ccda2cd4b0b4aff216
verify_with:
  - packages/api/src/routers/integrations/deprovisioning.ts
  - apps/web-vite/src/components/idp/
updated: 2026-06-09
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
