---
title: Notifications and reminders
type: domain
tags: [notifications, reminders, email, slack]
source_commit: 70f5782d78e33ba98c82e4ccda2cd4b0b4aff216
verify_with:
  - packages/api/src/routers/core/notification.ts
  - packages/api/src/routers/core/reminder.ts
  - packages/api/src/services/notification-service.ts
updated: 2026-06-10
---

# Notifications and reminders

## Purpose

In-app notifications (unread counts, preferences), outbound email/Slack/Teams delivery, and configurable reminder rules that spawn reminder instances (compliance renewals, DRV expiry, etc.).

## Flow

```mermaid
flowchart TD
  event[domain event] --> notifSvc[notification-service]
  notifSvc --> inApp[in-app notification row]
  notifSvc --> email[Resend email]
  notifSvc --> teams[Teams/Slack dispatch]
  rule[reminder rule CRUD] --> instance[reminder instances]
  cron[cron-worker] --> instance
```

## Entry points

| Piece | Path |
|-------|------|
| Notification router | `packages/api/src/routers/core/notification.ts` |
| Reminder router | `packages/api/src/routers/core/reminder.ts` |
| Dispatch service | `packages/api/src/services/notification-service.ts` |
| Compliance reminders | `apps/cron-worker/.../compliance-reminder.ts` |
| DRV reminders | `cron-worker/.../reminders/drv-clearance-expiries.ts` |
| UI | `apps/web-vite/src/components/notifications/` |
| Settings prefs | `settings/notification-preferences.tsx` (wired + `NotificationPreferencesView`) |

## Invariants

- Preferences CRUD scoped to tenant user
- Silent catch in dispatch is tech debt — [[decisions/tech-debt-hotspots]]
- Teams/Slack channels via [[integrations/teams]] framework

## Related

- [[approvals-engine]]
- [[compliance-dashboard]]
- [[classification-ir35]]
- [[settings-and-org-admin]]
- [[patterns/logging-and-errors]]

## Verify live

```bash
semble search "notification-service"
semble search "reminderRouter"
```

## Agent mistakes

- Adding notification side effects with empty catch
- Reminder instances without cascade delete on rule toggle-off
