-- Cron idempotency: at most one ReminderInstance per rule + entity + scheduled day
CREATE UNIQUE INDEX IF NOT EXISTS "ReminderInstance_reminderRuleId_entityType_entityId_scheduledFor_key" ON "ReminderInstance" (
  "reminderRuleId",
  "entityType",
  "entityId",
  "scheduledFor"
);

-- Atomic dedup slots for reminder/cron notification dispatch (not tenant-scoped; cron uses app connection)
CREATE TABLE IF NOT EXISTS "NotificationCronDedup" (
  "id" TEXT NOT NULL,
  "dedupeKey" VARCHAR(512) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationCronDedup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "NotificationCronDedup_dedupeKey_key" ON "NotificationCronDedup" ("dedupeKey");
