---
title: Jira Cloud
type: integration
tags: [jira, atlassian]
source_commit: 70f5782d78e33ba98c82e4ccda2cd4b0b4aff216
verify_with:
  - packages/api/src/routers/integrations/jira.ts
  - packages/integrations/src/adapters/jira-adapter.ts
updated: 2026-06-10
---

# Jira Cloud

## Purpose

Atlassian Cloud OAuth: project/issue-type discovery, status mapping, workflow task config, linked issues on contracts, bidirectional status sync, auto-issue creation from workflow tasks.

## Flow

```mermaid
flowchart LR
  connect[OAuth connect] --> projects[project discovery]
  projects --> mapping[status mapping]
  mapping --> sync[bidirectional sync]
  workflow[workflow task] --> createIssue[auto-create issue]
```

## Entry points

| Piece | Path |
|-------|------|
| tRPC | `jira` router |
| Adapter | `jira-adapter.ts` |
| Projects client | `jira-projects-client.ts` |
| UI | `jira-provider-section.tsx`, `use-jira-provider-section.ts` |
| Contract panel | `use-linear-linked-issues-panel` pattern on contracts |

## Invariants

- Status mapping shared pattern with Linear — `integration-status-mapping.ts` (save in `$transaction`) + provider services
- Jira API list/get paths use `jiraApiGet` + Zod; status mapping entries use `workflowTaskStatusEnum`. `registerJiraWebhooks` persists `configJson.webhookSecret` (generated on first register) for HMAC verification. Inbound webhooks validate transitions, org scope, and run `unblockDependentsAndRecomputeRun` on terminal task statuses.
- `saveStatusMapping` returns `{ success, webhooksRegistered }`; web-vite shows warning toast when mapping saved but webhooks not registered (`Integrations.jira.statusMapping.toast.webhooksNotRegistered`).

## Related

- [[domains/workflows-and-roles]]
- [[domains/contracts-lifecycle]]
- [[linear]]
- [[framework-core]]

## Verify live

```bash
semble search "jiraRouter"
semble search "jira-adapter"
```

## Agent mistakes

- Hardcoded Jira status strings instead of mapped values
- Skipping OAuth token refresh path
