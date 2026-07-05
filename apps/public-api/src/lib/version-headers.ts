import type { MiddlewareHandler } from 'hono';

/**
 * RFC 8594 version-lifecycle headers for the public REST API.
 *
 * Each API version maps to an optional deprecation/sunset policy. When a version
 * is deprecated or scheduled for sunset, the middleware emits `Deprecation` +
 * `Sunset` (HTTP-date) + `Link; rel="sunset"` so consumers can react. The
 * mechanism exists now even though the current `v1` sets no dates — nothing is
 * emitted until a policy is populated (breaking changes only on a major bump).
 */

export interface VersionPolicy {
  deprecation?: Date;
  sunset?: Date;
  policyUrl?: string;
}

export const VERSION_POLICY: Record<string, VersionPolicy> = {
  v1: {
    // Current version — no deprecation/sunset. policyUrl documents the versioning
    // policy for consumers even while nothing is being sunset.
    policyUrl: 'https://api.contractor-ops.com/versioning',
  },
};

/**
 * Hono middleware that, after the handler runs, emits RFC 8594 lifecycle headers
 * for the active version when its policy sets them. Reads the single `v1` policy
 * (the app is mounted at `/v1`); extend the lookup when a second version ships.
 */
export const versionHeaders: MiddlewareHandler = async (c, next) => {
  await next();
  const cfg = VERSION_POLICY.v1;
  if (!cfg) return;
  if (cfg.deprecation) c.header('Deprecation', cfg.deprecation.toUTCString());
  if (cfg.sunset) c.header('Sunset', cfg.sunset.toUTCString());
  if (cfg.policyUrl && cfg.sunset) {
    c.header('Link', `<${cfg.policyUrl}>; rel="sunset"`);
  }
};
