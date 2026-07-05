/**
 * Cron job registry.
 *
 * Each entry binds a job name to a cron schedule string and a handler
 * function that runs the work in-process. Handlers receive a logger
 * already scoped to the job and a request id for correlating audit-log
 * rows with Sentry events.
 */

import { apiKeyLeakAlarmHandler } from './handlers/api-key-leak-alarm.js';
import { boeRatePollHandler } from './handlers/boe-rate-poll.js';
import { classificationEconomicDependencyHandler } from './handlers/classification-economic-dependency.js';
import { classificationReassessmentTriggersHandler } from './handlers/classification-reassessment-triggers.js';
import { dataPurgeHandler } from './handlers/data-purge.js';
import { exchangeRatesHandler } from './handlers/exchange-rates.js';
import { form1099kTrackerHandler } from './handlers/form-1099k-tracker.js';
import { hrisSyncHandler } from './handlers/hris-sync.js';
import { inpostStatusPollHandler } from './handlers/inpost-status-poll.js';
import { jobHealthHandler } from './handlers/job-health.js';
import { lateInterestPdfReaperHandler } from './handlers/late-interest-pdf-reaper.js';
import { orgDefinitionSyncHandler } from './handlers/org-definition-sync.js';
import { remindersHandler } from './handlers/reminders/index.js';
import { stripeReconcileHandler } from './handlers/stripe-reconcile.js';
import { tokenRefreshHandler } from './handlers/token-refresh.js';
import { trialNotificationsHandler } from './handlers/trial-notifications.js';
import { yearEnd1099ReminderHandler } from './handlers/year-end-1099-reminder.js';
import { buildJobMeta } from './job-meta.js';
import type { JobHandler, JobMeta } from './runner.js';

export interface JobDefinition {
  meta: JobMeta;
  handler: JobHandler;
}

export function getJobDefinitions(env: {
  CRON_TOKEN_REFRESH_SCHEDULE: string;
  CRON_DATA_PURGE_SCHEDULE: string;
  CRON_EXCHANGE_RATES_SCHEDULE: string;
  CRON_BOE_RATE_POLL_SCHEDULE: string;
  CRON_ORG_DEFINITION_SYNC_SCHEDULE: string;
  CRON_HRIS_SYNC_SCHEDULE: string;
  CRON_CLASSIFICATION_REASSESSMENT_TRIGGERS_SCHEDULE: string;
  CRON_CLASSIFICATION_ECONOMIC_DEPENDENCY_SCHEDULE: string;
  CRON_FORM_1099K_TRACKER_SCHEDULE: string;
  CRON_INPOST_STATUS_POLL_SCHEDULE: string;
  CRON_JOB_HEALTH_SCHEDULE: string;
  CRON_API_KEY_LEAK_ALARM_SCHEDULE: string;
  CRON_LATE_INTEREST_PDF_REAPER_SCHEDULE: string;
  CRON_TRIAL_NOTIFICATIONS_SCHEDULE: string;
  CRON_REMINDERS_SCHEDULE: string;
  CRON_YEAR_END_1099_REMINDER_SCHEDULE: string;
  CRON_STRIPE_RECONCILE_SCHEDULE: string;
  CRON_JOB_DEFAULT_MAX_MS: number;
}): JobDefinition[] {
  const defaultMaxMs = env.CRON_JOB_DEFAULT_MAX_MS;
  const meta = (name: string, schedule: string): JobMeta =>
    buildJobMeta(name, schedule, defaultMaxMs);
  return [
    {
      meta: meta('token-refresh', env.CRON_TOKEN_REFRESH_SCHEDULE),
      handler: tokenRefreshHandler,
    },
    {
      meta: meta('data-purge', env.CRON_DATA_PURGE_SCHEDULE),
      handler: dataPurgeHandler,
    },
    {
      meta: meta('exchange-rates', env.CRON_EXCHANGE_RATES_SCHEDULE),
      handler: exchangeRatesHandler,
    },
    {
      meta: meta('boe-rate-poll', env.CRON_BOE_RATE_POLL_SCHEDULE),
      handler: boeRatePollHandler,
    },
    {
      meta: meta('org-definition-sync', env.CRON_ORG_DEFINITION_SYNC_SCHEDULE),
      handler: orgDefinitionSyncHandler,
    },
    {
      meta: meta('hris-sync', env.CRON_HRIS_SYNC_SCHEDULE),
      handler: hrisSyncHandler,
    },
    {
      meta: meta(
        'classification-reassessment-triggers',
        env.CRON_CLASSIFICATION_REASSESSMENT_TRIGGERS_SCHEDULE,
      ),
      handler: classificationReassessmentTriggersHandler,
    },
    {
      meta: meta(
        'classification-economic-dependency',
        env.CRON_CLASSIFICATION_ECONOMIC_DEPENDENCY_SCHEDULE,
      ),
      handler: classificationEconomicDependencyHandler,
    },
    {
      meta: meta('form-1099k-tracker', env.CRON_FORM_1099K_TRACKER_SCHEDULE),
      handler: form1099kTrackerHandler,
    },
    {
      meta: meta('inpost-status-poll', env.CRON_INPOST_STATUS_POLL_SCHEDULE),
      handler: inpostStatusPollHandler,
    },
    {
      meta: meta('job-health', env.CRON_JOB_HEALTH_SCHEDULE),
      handler: jobHealthHandler,
    },
    {
      meta: meta('api-key-leak-alarm', env.CRON_API_KEY_LEAK_ALARM_SCHEDULE),
      handler: apiKeyLeakAlarmHandler,
    },
    {
      meta: meta('late-interest-pdf-reaper', env.CRON_LATE_INTEREST_PDF_REAPER_SCHEDULE),
      handler: lateInterestPdfReaperHandler,
    },
    {
      meta: meta('trial-notifications', env.CRON_TRIAL_NOTIFICATIONS_SCHEDULE),
      handler: trialNotificationsHandler,
    },
    {
      meta: meta('reminders', env.CRON_REMINDERS_SCHEDULE),
      handler: remindersHandler,
    },
    {
      meta: meta('year-end-1099-reminder', env.CRON_YEAR_END_1099_REMINDER_SCHEDULE),
      handler: yearEnd1099ReminderHandler,
    },
    {
      meta: meta('stripe-reconcile', env.CRON_STRIPE_RECONCILE_SCHEDULE),
      handler: stripeReconcileHandler,
    },
  ];
}
