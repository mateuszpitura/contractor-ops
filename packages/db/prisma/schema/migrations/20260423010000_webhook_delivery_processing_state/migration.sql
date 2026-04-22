-- Adds a PROCESSING intermediate state to WebhookDeliveryStatus so the
-- async /api/webhooks/_process handler can atomically claim a delivery
-- (RECEIVED | FAILED -> PROCESSING) before invoking the provider adapter.
--
-- Rationale: QStash is at-least-once. Without an intermediate state the
-- handler had no way to dedup retries of an already-PROCESSED delivery
-- nor to prevent two concurrent workers from both invoking the adapter
-- on a RECEIVED row. Both paths caused duplicate side effects (Jira /
-- Linear mutations, e-sign completion handlers, Resend inbound intake).
--
-- Placement between RECEIVED and PROCESSED keeps the enum order natural.

-- Postgres only allows ALTER TYPE ADD VALUE ... BEFORE / AFTER on enums
-- (outside a transaction block per PG17 docs). Keeping this statement
-- standalone so Prisma migrate applies it directly.

ALTER TYPE "WebhookDeliveryStatus" ADD VALUE IF NOT EXISTS 'PROCESSING' BEFORE 'PROCESSED';
