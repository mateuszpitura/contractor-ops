---
title: API router groups
type: structure
tags: [structure, api, trpc]
source_commit: 70f5782d78e33ba98c82e4ccda2cd4b0b4aff216
verify_with:
  - packages/api/src/routers/
  - packages/api/src/root.ts
updated: 2026-06-09
---

# API router groups

## Purpose

`packages/api/src/routers/` organizes tRPC procedures by domain folder. Large namespaces use `mergeRouters` in `packages/api/src/init.ts`.

## Flow

```mermaid
flowchart LR
  root[root.ts appRouter] --> core[routers/core]
  root --> finance[routers/finance]
  root --> compliance[routers/compliance]
  root --> integrations[routers/integrations]
  root --> workflow[routers/workflow]
  root --> equipment[routers/equipment]
  root --> gulf[routers/gulf]
  portalRoot[portal-root.ts] --> portal[routers/portal]
```

## Entry points

| Folder | Namespaces (high level) | Notes |
|--------|-------------------------|-------|
| `core/` | organization, user, contractor, contract, approval, audit, time, document, … | `organizationDefinitions` nests team/project/costCenter |
| `finance/` | invoice, invoiceIntake, payment, billing, skonto, bacs, … | payment/invoice split into sub-modules |
| `compliance/` | complianceAdmin, gdpr, consent, zatca, gulf, einvoice, tax + 8 conditional classification* | classification flag-gated |
| `integrations/` | integration, jira, linear, ksef, peppol, googleWorkspace, teams | OAuth via integration framework |
| `workflow/` | workflow, workflowRoles | KT role templates |
| `equipment/` | equipment | shipments, carriers |
| `portal/` | portal, portalTime | **Not** in appRouter — see portal-root |
| `public-api/` | REST callers only | Hono surface |

## Related

- [[api-routers-catalog]]
- [[patterns/trpc-procedure-stack]]
- [[decisions/arch-decisions]]

## Verify live

```bash
semble search "mergeRouters"
ls packages/api/src/routers/
```

## Agent mistakes

- Adding portal procedures to `root.ts` — use `portal-root.ts`
- Flat 2000-line router files — split + merge pattern exists
