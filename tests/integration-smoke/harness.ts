/**
 * Live integration-smoke harness.
 *
 * These suites hit REAL provider sandboxes — they are the cutover safety net
 * that MSW unit tests can't give (MSW proves we parse a recorded shape; smoke
 * proves the live contract, credentials, and our configured URLs still work).
 *
 * They NEVER run in the main `pnpm test` / `turbo test` pipeline:
 *   - files are named `*.smoke.ts` (not `*.test.ts`), so per-package vitest
 *     `include` globs ignore them;
 *   - they only run via `pnpm test:integration:smoke`
 *     (→ `vitest run --config vitest.smoke.config.ts`);
 *   - every suite is gated on `RUN_LIVE_SMOKE=1` AND its own credentials.
 *
 * Contract for a smoke test:
 *   1. Use `smokeDescribe(provider, requiredEnv, fn)` — auto-skips when
 *      RUN_LIVE_SMOKE!=1 or any required env var is missing.
 *   2. Do the SMALLEST real round-trip (read a balance, post one message,
 *      validate one VAT number).
 *   3. Be SELF-CLEANING + idempotent. Create-then-delete. Never touch shared
 *      or persistent provider state. Identity-mutating smokes (GWS/Okta/Entra
 *      deprovision) target DISPOSABLE test identities only.
 */

import { describe } from 'vitest';

/** True only when the operator explicitly opted into live calls. */
export const LIVE = process.env.RUN_LIVE_SMOKE === '1';

/** @returns the names of any required env vars that are missing/empty. */
export function missingEnv(required: readonly string[]): string[] {
  return required.filter(name => {
    const v = process.env[name];
    return v === undefined || v === '';
  });
}

/**
 * `describe` wrapper that skips unless live mode is on AND all required env
 * vars are present. Prints WHY it skipped so a half-configured CI run is
 * legible rather than silently green.
 */
export function smokeDescribe(
  provider: string,
  requiredEnv: readonly string[],
  fn: () => void,
): void {
  const missing = missingEnv(requiredEnv);
  const reason = LIVE
    ? missing.length > 0
      ? `missing env: ${missing.join(', ')}`
      : ''
    : 'RUN_LIVE_SMOKE!=1';

  if (reason) {
    // eslint-disable-next-line no-console
    describe.skip(`[smoke] ${provider} (skipped — ${reason})`, fn);
    return;
  }
  describe(`[smoke] ${provider}`, fn);
}

/** Small fetch helper with a timeout so a hung sandbox fails fast, not slow. */
export async function smokeFetch(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  const { timeoutMs = 15_000, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...rest, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
