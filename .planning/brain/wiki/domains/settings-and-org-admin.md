---
title: Settings and org admin
type: domain
tags: [settings, organization, users]
source_commit: 70f5782d78e33ba98c82e4ccda2cd4b0b4aff216
verify_with:
  - packages/api/src/routers/core/organization.ts
  - packages/api/src/routers/core/settings.ts
updated: 2026-06-09
---

# Settings and org admin

## Purpose

Organization profile, users/roles, org settings, teams/projects/cost centers (`organizationDefinitions`), integrations tab, e-invoicing config, API keys, audit log tab, in-app feedback.

## Entry points

| Namespace | Path |
|-----------|------|
| `organization` | `routers/core/organization.ts` |
| `organizationDefinitions` | `team`, `project`, `costCenter` nested routers |
| `user` | `routers/core/user.ts` |
| `settings` | `routers/core/settings.ts` |
| `apiKey` | enterprise API keys → [[domains/public-api-surface]] |
| `audit` | `routers/core/audit.ts` — read audit trail ([[patterns/audit-log]]) |
| `calendar` | `routers/core/calendar.ts` — deadline sync with [[domains/workflows-and-roles]] |
| `featureFlags` | staff flag introspection UI |
| UI | `components/settings/`, `organization/`, `admin/`, `feedback/` |

## Related

- [[patterns/rbac-permissions]]
- [[integrations/_index]]
- [[consent-gdpr-pdpl]]

## Verify live

```bash
semble search "organizationRouter"
semble search "settingsRouter"
```

## Agent mistakes

- Trusting org id from form without session alignment
