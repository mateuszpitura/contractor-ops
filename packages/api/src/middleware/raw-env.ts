/**
 * Single raw-env boundary for middleware modules.
 *
 * The Upstash pair intentionally stays a raw read (not getServerEnv): the
 * limiters must construct their Redis client at module load in every runtime
 * (api-server, tests) without requiring the full validated server env.
 * Consolidating here keeps the check:no-process-env ratchet flat when a new
 * limiter or flag gate is added — import from this module instead of reading
 * process.env in the new file.
 */

export const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
export const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

/** Rate limiters fail closed in production, fall back in-memory elsewhere. */
export function runtimeEnv(): string {
  return process.env.NODE_ENV ?? 'development';
}

/**
 * QA walk org (QA_DEFAULT_ORG_ID) force-registers flag-gated router surfaces
 * so the seeded org can exercise them; production never sets it.
 */
export function hasQaDefaultOrg(): boolean {
  return Boolean(process.env.QA_DEFAULT_ORG_ID);
}
