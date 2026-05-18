import { createLogger } from '@contractor-ops/logger';
import { getServerEnv } from '@contractor-ops/validators';
import { PostHog } from 'posthog-node';

const log = createLogger({ service: 'posthog-server' });

let client: PostHog | null = null;
let warnedMissingKey = false;

/**
 * Lazily-constructed singleton `posthog-node` client for server-side events.
 *
 * Returns `null` when `POSTHOG_API_KEY` is unset (dev / preview deployments).
 * Callers are expected to no-op in that case — events should never be a
 * hard dependency of the request path.
 *
 * Production environments set the key during boot validation
 * (`apps/web/src/instrumentation.ts`).
 */
function getPosthog(): PostHog | null {
  if (client) return client;
  const env = getServerEnv();
  if (!env.POSTHOG_API_KEY) {
    if (!warnedMissingKey) {
      log.warn({}, 'POSTHOG_API_KEY not set — server-side analytics disabled');
      warnedMissingKey = true;
    }
    return null;
  }
  client = new PostHog(env.POSTHOG_API_KEY, {
    host: env.POSTHOG_HOST,
    // Smaller batches keep webhook latency predictable. The default 20-item
    // batch + 30s flush keeps Stripe webhooks waiting too long on shutdown
    // paths (Render serverless).
    flushAt: 5,
    flushInterval: 5_000,
  });
  return client;
}

export interface CaptureEventInput {
  distinctId: string;
  event: string;
  properties?: Record<string, unknown>;
  /** Optional org id surfaced as a top-level group + property. */
  organizationId?: string;
}

/**
 * Fire a server-side PostHog event. No-op when analytics is unconfigured.
 *
 * Never throws — analytics must not break the calling request. Errors are
 * logged with the distinct id so they can be traced in production.
 */
export async function captureEvent({
  distinctId,
  event,
  properties,
  organizationId,
}: CaptureEventInput): Promise<void> {
  const ph = getPosthog();
  if (!ph) return;
  try {
    ph.capture({
      distinctId,
      event,
      properties: {
        ...properties,
        ...(organizationId ? { organization_id: organizationId } : {}),
        $set: properties?.$set,
      },
      ...(organizationId ? { groups: { organization: organizationId } } : {}),
    });
  } catch (err) {
    log.warn({ err, event, distinctId }, 'posthog capture failed');
  }
}

/**
 * Stitch the anonymous distinct id (from the landing-side PostHog cookie)
 * to an identified userId so the funnel survives the auth handoff.
 *
 * Safe to call multiple times — PostHog aliases are idempotent.
 */
export async function aliasAnonToUser(
  anonDistinctId: string,
  userDistinctId: string,
): Promise<void> {
  const ph = getPosthog();
  if (!ph) return;
  if (!anonDistinctId || anonDistinctId === userDistinctId) return;
  try {
    ph.alias({ distinctId: userDistinctId, alias: anonDistinctId });
  } catch (err) {
    log.warn({ err, userDistinctId }, 'posthog alias failed');
  }
}

/**
 * Identify a user with a set of profile properties. Used after sign-up to
 * attach market, org id, and locale to the user record.
 */
export async function identifyUser(
  distinctId: string,
  properties: Record<string, unknown>,
): Promise<void> {
  const ph = getPosthog();
  if (!ph) return;
  try {
    ph.identify({ distinctId, properties });
  } catch (err) {
    log.warn({ err, distinctId }, 'posthog identify failed');
  }
}

/**
 * Force a flush. Call from request-completion hooks (Next.js
 * `after()` / Render serverless lifecycle) so events are not lost when the
 * worker is suspended.
 */
export async function flushPosthog(): Promise<void> {
  if (!client) return;
  try {
    await client.flush();
  } catch (err) {
    log.warn({ err }, 'posthog flush failed');
  }
}

/**
 * Shutdown the client. Test-only — production processes are short-lived
 * and rely on the SDK's automatic flush.
 */
export async function shutdownPosthogForTesting(): Promise<void> {
  if (!client) return;
  await client.shutdown();
  client = null;
}
