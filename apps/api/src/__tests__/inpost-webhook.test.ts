/** @vitest-environment node */

/**
 * Pins the apps/api env contract for the InPost ShipX webhook signature
 * posture knob (apps/api/src/env.ts → STRICT_INPOST_SIGNATURE).
 *
 * The route handler (apps/api/src/routes/webhooks/inpost.ts) consults the
 * dev/staging shipment-id payload fallback only when
 * `NODE_ENV !== 'production' && !STRICT_INPOST_SIGNATURE`. Pinning the flag's
 * parsing here guards against a regression that silently flips staging back to
 * accepting unsigned webhook payloads.
 *
 * Scoped to the env schema (no appRouter / buildServer) so it stays fast and
 * independent of the full server-env validator — the apps/api inject-test
 * harness (buildServer → full appRouter) is a separate, pre-existing concern.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { __resetEnvForTests, loadEnv } from '../env.js';

describe('apps/api env — STRICT_INPOST_SIGNATURE', () => {
  beforeEach(() => {
    __resetEnvForTests();
  });

  afterEach(() => {
    delete process.env.STRICT_INPOST_SIGNATURE;
    __resetEnvForTests();
  });

  it('defaults to false when unset', () => {
    delete process.env.STRICT_INPOST_SIGNATURE;
    __resetEnvForTests();
    expect(loadEnv().STRICT_INPOST_SIGNATURE).toBe(false);
  });

  it('parses the string "true" as true', () => {
    process.env.STRICT_INPOST_SIGNATURE = 'true';
    __resetEnvForTests();
    expect(loadEnv().STRICT_INPOST_SIGNATURE).toBe(true);
  });

  it('treats any other value as false (only exact "true" enables strict mode)', () => {
    process.env.STRICT_INPOST_SIGNATURE = 'yes';
    __resetEnvForTests();
    expect(loadEnv().STRICT_INPOST_SIGNATURE).toBe(false);
  });
});
