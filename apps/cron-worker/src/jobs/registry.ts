/**
 * Cron job registry.
 *
 * Each entry binds a job name to a cron schedule string and a handler
 * function that runs the work in-process. Handlers receive a logger
 * already scoped to the job and a request id for correlating audit-log
 * rows with Sentry events.
 */

import { boeRatePollHandler } from './handlers/boe-rate-poll.js';
import { classificationEconomicDependencyHandler } from './handlers/classification-economic-dependency.js';
import { classificationReassessmentTriggersHandler } from './handlers/classification-reassessment-triggers.js';
import { dataPurgeHandler } from './handlers/data-purge.js';
import { exchangeRatesHandler } from './handlers/exchange-rates.js';
import { inpostStatusPollHandler } from './handlers/inpost-status-poll.js';
import { jobHealthHandler } from './handlers/job-health.js';
import { lateInterestPdfReaperHandler } from './handlers/late-interest-pdf-reaper.js';
import { orgDefinitionSyncHandler } from './handlers/org-definition-sync.js';
import { remindersHandler } from './handlers/reminders/index.js';
import { tokenRefreshHandler } from './handlers/token-refresh.js';
import { trialNotificationsHandler } from './handlers/trial-notifications.js';
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
  CRON_CLASSIFICATION_REASSESSMENT_TRIGGERS_SCHEDULE: string;
  CRON_CLASSIFICATION_ECONOMIC_DEPENDENCY_SCHEDULE: string;
  CRON_INPOST_STATUS_POLL_SCHEDULE: string;
  CRON_JOB_HEALTH_SCHEDULE: string;
  CRON_LATE_INTEREST_PDF_REAPER_SCHEDULE: string;
  CRON_TRIAL_NOTIFICATIONS_SCHEDULE: string;
  CRON_REMINDERS_SCHEDULE: string;
}): JobDefinition[] {
  return [
    {
      meta: { name: 'token-refresh', schedule: env.CRON_TOKEN_REFRESH_SCHEDULE },
      handler: tokenRefreshHandler,
    },
    {
      meta: { name: 'data-purge', schedule: env.CRON_DATA_PURGE_SCHEDULE },
      handler: dataPurgeHandler,
    },
    {
      meta: { name: 'exchange-rates', schedule: env.CRON_EXCHANGE_RATES_SCHEDULE },
      handler: exchangeRatesHandler,
    },
    {
      meta: { name: 'boe-rate-poll', schedule: env.CRON_BOE_RATE_POLL_SCHEDULE },
      handler: boeRatePollHandler,
    },
    {
      meta: { name: 'org-definition-sync', schedule: env.CRON_ORG_DEFINITION_SYNC_SCHEDULE },
      handler: orgDefinitionSyncHandler,
    },
    {
      meta: {
        name: 'classification-reassessment-triggers',
        schedule: env.CRON_CLASSIFICATION_REASSESSMENT_TRIGGERS_SCHEDULE,
      },
      handler: classificationReassessmentTriggersHandler,
    },
    {
      meta: {
        name: 'classification-economic-dependency',
        schedule: env.CRON_CLASSIFICATION_ECONOMIC_DEPENDENCY_SCHEDULE,
      },
      handler: classificationEconomicDependencyHandler,
    },
    {
      meta: {
        name: 'inpost-status-poll',
        schedule: env.CRON_INPOST_STATUS_POLL_SCHEDULE,
      },
      handler: inpostStatusPollHandler,
    },
    {
      meta: { name: 'job-health', schedule: env.CRON_JOB_HEALTH_SCHEDULE },
      handler: jobHealthHandler,
    },
    {
      meta: {
        name: 'late-interest-pdf-reaper',
        schedule: env.CRON_LATE_INTEREST_PDF_REAPER_SCHEDULE,
      },
      handler: lateInterestPdfReaperHandler,
    },
    {
      meta: {
        name: 'trial-notifications',
        schedule: env.CRON_TRIAL_NOTIFICATIONS_SCHEDULE,
      },
      handler: trialNotificationsHandler,
    },
    {
      meta: { name: 'reminders', schedule: env.CRON_REMINDERS_SCHEDULE },
      handler: remindersHandler,
    },
  ];
}
