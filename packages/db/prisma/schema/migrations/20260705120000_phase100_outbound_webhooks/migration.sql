-- Theme C — outbound webhooks: subscription + delivery attempt + dead-letter.
-- Additive; no data loss. NAME-DISTINCT from the inbound "WebhookDelivery".
-- Apply per region (EU/ME/US) via `pnpm db:migrate:all` post-merge (deferred —
-- generated + committed here, applied at deploy).

-- Enum (own status set; NOT the inbound WebhookDeliveryStatus).
CREATE TYPE "OutboundWebhookStatus" AS ENUM ('PENDING', 'SENDING', 'DELIVERED', 'FAILED', 'DEAD');

-- Subscription endpoint.
CREATE TABLE "WebhookSubscription" (
    "id"              TEXT NOT NULL,
    "organizationId"  TEXT NOT NULL,
    "url"             TEXT NOT NULL,
    "eventFilter"     TEXT[],
    "secretEncrypted" TEXT NOT NULL,
    "includePii"      BOOLEAN NOT NULL DEFAULT false,
    "httpAllowed"     BOOLEAN NOT NULL DEFAULT false,
    "enabled"         BOOLEAN NOT NULL DEFAULT true,
    "maxRetries"      INTEGER NOT NULL DEFAULT 6,
    "lastSuccessAt"   TIMESTAMP(3),
    "lastFailureAt"   TIMESTAMP(3),
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookSubscription_pkey" PRIMARY KEY ("id")
);

-- One delivery attempt (redaction-applied snapshot in payloadJson).
CREATE TABLE "WebhookDeliveryAttempt" (
    "id"             TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "outboxEventId"  TEXT,
    "eventType"      TEXT NOT NULL,
    "payloadJson"    JSONB NOT NULL,
    "status"         "OutboundWebhookStatus" NOT NULL DEFAULT 'PENDING',
    "attempts"       INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responseStatus" INTEGER,
    "lastError"      TEXT,
    "deliveredAt"    TIMESTAMP(3),
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookDeliveryAttempt_pkey" PRIMARY KEY ("id")
);

-- Dead-letter queue (exhausted attempts; retained for replay).
CREATE TABLE "webhook_failures" (
    "id"             TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "attemptId"      TEXT,
    "eventType"      TEXT NOT NULL,
    "payloadJson"    JSONB NOT NULL,
    "lastError"      TEXT NOT NULL,
    "attempts"       INTEGER NOT NULL,
    "failedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "replayedAt"     TIMESTAMP(3),

    CONSTRAINT "webhook_failures_pkey" PRIMARY KEY ("id")
);

-- Indexes.
CREATE INDEX "WebhookSubscription_organizationId_enabled_idx" ON "WebhookSubscription"("organizationId", "enabled");
CREATE INDEX "WebhookDeliveryAttempt_status_nextAttemptAt_idx" ON "WebhookDeliveryAttempt"("status", "nextAttemptAt");
CREATE INDEX "WebhookDeliveryAttempt_subscriptionId_createdAt_idx" ON "WebhookDeliveryAttempt"("subscriptionId", "createdAt");
CREATE INDEX "webhook_failures_organizationId_failedAt_idx" ON "webhook_failures"("organizationId", "failedAt");

-- Foreign keys.
ALTER TABLE "WebhookSubscription"
    ADD CONSTRAINT "WebhookSubscription_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WebhookDeliveryAttempt"
    ADD CONSTRAINT "WebhookDeliveryAttempt_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WebhookDeliveryAttempt"
    ADD CONSTRAINT "WebhookDeliveryAttempt_subscriptionId_fkey"
    FOREIGN KEY ("subscriptionId") REFERENCES "WebhookSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "webhook_failures"
    ADD CONSTRAINT "webhook_failures_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "webhook_failures"
    ADD CONSTRAINT "webhook_failures_subscriptionId_fkey"
    FOREIGN KEY ("subscriptionId") REFERENCES "WebhookSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-level security — member read, ops write (mirrors "OutboxEvent" / inbound
-- "WebhookDelivery"). Every row is org-scoped so RLS auto-isolates tenants.
alter table "WebhookSubscription" enable row level security;
alter table "WebhookSubscription" force row level security;
drop policy if exists webhooksubscription_select on "WebhookSubscription";
create policy webhooksubscription_select on "WebhookSubscription"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists webhooksubscription_write on "WebhookSubscription";
create policy webhooksubscription_write on "WebhookSubscription"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

alter table "WebhookDeliveryAttempt" enable row level security;
alter table "WebhookDeliveryAttempt" force row level security;
drop policy if exists webhookdeliveryattempt_select on "WebhookDeliveryAttempt";
create policy webhookdeliveryattempt_select on "WebhookDeliveryAttempt"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists webhookdeliveryattempt_write on "WebhookDeliveryAttempt";
create policy webhookdeliveryattempt_write on "WebhookDeliveryAttempt"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

alter table "webhook_failures" enable row level security;
alter table "webhook_failures" force row level security;
drop policy if exists webhook_failures_select on "webhook_failures";
create policy webhook_failures_select on "webhook_failures"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists webhook_failures_write on "webhook_failures";
create policy webhook_failures_write on "webhook_failures"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());
