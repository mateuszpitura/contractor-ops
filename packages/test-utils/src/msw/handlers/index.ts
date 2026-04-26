import type { HttpHandler } from 'msw';
import type { HandlerOptions } from '../types.js';
import { autentiHandlers } from './autenti.js';
import { claudeOcrHandlers } from './claude-ocr.js';
import { clockifyHandlers } from './clockify.js';
import { confluenceHandlers } from './confluence.js';
import { docusignHandlers } from './docusign.js';
import { googleCalendarHandlers } from './google-calendar.js';
import { googleWorkspaceHandlers } from './google-workspace.js';
import { hmrcHandlers } from './hmrc.js';
import { jiraHandlers } from './jira.js';
import { ksefHandlers } from './ksef.js';
import { linearHandlers } from './linear.js';
import { notionHandlers } from './notion.js';
import { outlookCalendarHandlers } from './outlook-calendar.js';
import { qstashHandlers } from './qstash.js';
import { r2Handlers } from './r2.js';
import { resendHandlers } from './resend.js';
import { slackHandlers } from './slack.js';
import { stripeHandlers } from './stripe.js';
import { upstashRedisHandlers } from './upstash-redis.js';
import { viesHandlers } from './vies.js';

/**
 * All handler factories indexed by provider name.
 * Use this to selectively include only the providers you need.
 */
export const handlersByProvider = {
  stripe: stripeHandlers,
  jira: jiraHandlers,
  linear: linearHandlers,
  slack: slackHandlers,
  docusign: docusignHandlers,
  autenti: autentiHandlers,
  googleCalendar: googleCalendarHandlers,
  outlookCalendar: outlookCalendarHandlers,
  confluence: confluenceHandlers,
  notion: notionHandlers,
  clockify: clockifyHandlers,
  ksef: ksefHandlers,
  resend: resendHandlers,
  claudeOcr: claudeOcrHandlers,
  qstash: qstashHandlers,
  upstashRedis: upstashRedisHandlers,
  r2: r2Handlers,
  googleWorkspace: googleWorkspaceHandlers,
  hmrc: hmrcHandlers,
  vies: viesHandlers,
} as const;

export type ProviderName = keyof typeof handlersByProvider;

/**
 * Get all handlers from all providers.
 */
export function allHandlers(options?: HandlerOptions): HttpHandler[] {
  return Object.values(handlersByProvider).flatMap(factory => factory(options));
}

/**
 * Get handlers from specific providers only.
 *
 * ```ts
 * const handlers = selectHandlers(["stripe", "jira"], { network: { delayMs: 100 } });
 * ```
 */
export function selectHandlers(providers: ProviderName[], options?: HandlerOptions): HttpHandler[] {
  return providers.flatMap(name => handlersByProvider[name](options));
}

export { clearHmrcTokenRefreshLedger } from './hmrc.js';
export {
  clearRedisStore,
  isUpstashRedisApiHostname,
  isUpstashRedisPipelineUrl,
  isUpstashRedisSingleCommandUrl,
} from './upstash-redis.js';
// Re-export individual factories for direct use
export {
  autentiHandlers,
  claudeOcrHandlers,
  clockifyHandlers,
  confluenceHandlers,
  docusignHandlers,
  googleCalendarHandlers,
  googleWorkspaceHandlers,
  hmrcHandlers,
  jiraHandlers,
  ksefHandlers,
  linearHandlers,
  notionHandlers,
  outlookCalendarHandlers,
  qstashHandlers,
  r2Handlers,
  resendHandlers,
  slackHandlers,
  stripeHandlers,
  upstashRedisHandlers,
  viesHandlers,
};
