---
title: Entra Okta GitHub IdP
type: integration
tags: [idp, okta, entra, github]
source_commit: 57946f642
verify_with:
  - packages/api/src/routers/integrations/deprovisioning.ts
  - packages/integrations/src/adapters/
updated: 2026-06-16
---

# Entra / Okta / GitHub IdP

## Purpose

Identity provider integrations for deprovisioning contractor access on offboarding — eligibility checks and provider-specific revoke/disable across five IdP surfaces.

## Flow

```mermaid
flowchart LR
  offboard[contractor offboard] --> elig[deprovisioning eligibility]
  elig --> toggle[provider toggle per IdP]
  toggle --> adapter[IdP adapter revoke]
```

## Entry points

| Piece | Path |
|-------|------|
| tRPC | `deprovisioning` router |
| Adapters | Okta, Entra, GitHub adapters in `packages/integrations/src/adapters/` |
| Scopes | per-provider deprovision scope modules |
| UI | `apps/web-vite/src/components/idp/` |
| Runner | `idp-deprovisioning-step-runner.ts` |

## Invariants

- Sensitive mutations → audit ([[patterns/tenant-and-audit]])
- Google Workspace deprovision scopes: [[google-workspace]]

## Related

- [[domains/idp-deprovisioning]]
- [[framework-core]]

## Verify live

```bash
semble search "deprovisioningRouter"
grep -l deprovision packages/integrations/src/adapters/*.ts
```

## Agent mistakes

- Deprovision without checking eligibility service
- Mixing staff Better Auth revoke with contractor IdP deprovision
