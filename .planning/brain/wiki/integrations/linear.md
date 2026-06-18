---
title: Linear
type: integration
tags: [linear, pm]
source_commit: 57946f64
verify_with:
  - packages/api/src/routers/integrations/linear.ts
  - packages/integrations/src/adapters/linear-adapter.ts
updated: 2026-06-10
---

# Linear

## Purpose

Linear OAuth integration: team discovery, status mapping, task config CRUD, linked issues on engagements, bidirectional sync.

## Flow

```mermaid
flowchart LR
  oauth[OAuth] --> teams[team discovery]
  teams --> mapping[status mapping dialog]
  mapping --> linked[linked issues panel]
  linked --> sync[status sync]
```

## Entry points

| Piece | Path |
|-------|------|
| tRPC | `linear` router |
| Adapter | `linear-adapter.ts` |
| Teams client | `linear-teams-client.ts` |
| UI | `linear-provider-section.tsx`, `linear-status-mapping-dialog.tsx` |
| Shared factory | `status-mapping-factory.ts` |

## Invariants

- Same status-mapping UX pattern as [[jira]]
- Tenant-scoped connection per org
- `connectionStatus` returns an allowlisted `publicLinearConfig` (`statusMappings`, `stateCache`) — `webhooks` / `webhookSecret` are dropped from the client response. Proactive, same allowlist pattern as [[jira]] (see [[patterns/registry-plugin]] § connectionStatus secret hygiene).

## Related

- [[domains/workflows-and-roles]]
- [[domains/contracts-lifecycle]]
- [[framework-core]]

## Verify live

```bash
semble search "linearRouter"
semble search "linear-adapter"
```

## Agent mistakes

- Duplicating status-mapping dialog logic instead of factory
- Client-side only sync without server adapter call
