/**
 * Date + dedup helpers shared across the reminders handler and its sub-jobs.
 *
 * The canonical implementation moved into the API package
 * (@contractor-ops/api/services/cron-dedup) so the compliance-reminder-scan
 * service can share it without the API package depending on apps/cron-worker.
 * This file remains a re-export so the reminders handler + sub-jobs are unchanged.
 */

export {
  addDays,
  claimCronNotificationDedup,
  startOfDay,
} from '@contractor-ops/api/services/cron-dedup';
