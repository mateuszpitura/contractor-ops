/**
 * Transactional-outbox drain schedule bootstrap.
 *
 * The outbox drain (`POST /outbox/_drain`) only delivers scheduled side
 * effects if something polls it. Unlike the per-org peppol/ksef/google-
 * workspace schedules (created on `connect`), the drain is a single global
 * singleton, so it is (re)ensured once at API boot.
 *
 * `schedules.create({ scheduleId })` upserts when the id already exists, so
 * calling this on every boot is idempotent. After creating we re-read the
 * schedule list and assert the drain schedule is present — a silent create
 * failure would otherwise leave the outbox accumulating PENDING rows with no
 * delivery, the exact failure mode that made the outbox "built but unwired".
 */

import { getQStashClient } from '@contractor-ops/integrations/services/qstash-client';
import { createLogger } from '@contractor-ops/logger';

const log = createLogger({ service: 'outbox-schedule' });

/** Stable scheduleId so create() upserts instead of spawning duplicates. */
export const OUTBOX_DRAIN_SCHEDULE_ID = 'outbox-drain';

/**
 * QStash cron granularity is one minute (the finest a cron expression
 * allows). The drain is cheap and idempotent — `FOR UPDATE SKIP LOCKED`
 * claim + per-row finalize — so a per-minute poll keeps outbox latency
 * bounded without hammering the API.
 */
const OUTBOX_DRAIN_CRON = '* * * * *';

/** Relative path of the drain route mounted by `registerOutboxDrainRoute`. */
const OUTBOX_DRAIN_PATH = '/outbox/_drain';

export interface EnsureOutboxDrainScheduleInput {
  /** Absolute base URL of this API (env `API_URL`). */
  apiUrl: string;
}

/**
 * Idempotently ensure the QStash schedule that polls the outbox drain exists,
 * then assert its presence. Throws if the schedule cannot be confirmed after
 * the create — the caller decides whether that is fatal.
 */
export async function ensureOutboxDrainSchedule({
  apiUrl,
}: EnsureOutboxDrainScheduleInput): Promise<string> {
  const qstash = getQStashClient();
  const destination = `${apiUrl.replace(/\/$/, '')}${OUTBOX_DRAIN_PATH}`;

  await qstash.schedules.create({
    destination,
    scheduleId: OUTBOX_DRAIN_SCHEDULE_ID,
    cron: OUTBOX_DRAIN_CRON,
    // Keep default retries: the drain is idempotent and self-healing (a
    // failed tick recovers on the next minute), and the route already 500s
    // so QStash retries the individual delivery.
  });

  // Assert: re-list schedules so a create that silently no-ops surfaces at
  // boot as a hard error rather than as a permanently-idle outbox.
  const schedules = await qstash.schedules.list();
  const present = schedules.some(s => s.scheduleId === OUTBOX_DRAIN_SCHEDULE_ID);
  if (!present) {
    throw new Error(`outbox drain schedule "${OUTBOX_DRAIN_SCHEDULE_ID}" not found after create`);
  }

  log.info(
    { scheduleId: OUTBOX_DRAIN_SCHEDULE_ID, destination, cron: OUTBOX_DRAIN_CRON },
    'outbox drain schedule ensured',
  );
  return OUTBOX_DRAIN_SCHEDULE_ID;
}
