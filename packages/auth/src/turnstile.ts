/**
 * Cloudflare Turnstile server-side verification.
 *
 * Closes the email-enumeration gap on the signup endpoint. The legacy
 * /sign-up/email route returns distinct messages for "email exists" vs.
 * "ok", which lets an attacker enumerate valid emails at the per-IP rate
 * limit cap (~10/min). Turnstile fronts the form with an invisible /
 * managed challenge whose token is verified server-side here BEFORE Better
 * Auth processes the signup body.
 *
 * Endpoint: https://challenges.cloudflare.com/turnstile/v0/siteverify
 *
 * Behaviour:
 *   - When TURNSTILE_SECRET_KEY is set: token is required; verifies against
 *     Cloudflare; returns true only on `success: true`.
 *   - When TURNSTILE_SECRET_KEY is unset (development without Turnstile
 *     configured): returns true (open) but logs a warning. Production
 *     deployments MUST set the secret — the env validator allows it
 *     optional only so local contributors don't need a Cloudflare app.
 *
 * Cloudflare imposes a 5-minute server-verify TTL; we don't cache positive
 * verifications because the signup mutation is one-shot anyway.
 */

import { createLogger } from '@contractor-ops/logger';

const log = createLogger({ service: 'auth-turnstile' });

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

interface TurnstileSiteverifyResponse {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  'error-codes'?: string[];
  action?: string;
  cdata?: string;
}

export interface VerifyTurnstileTokenInput {
  /** Token returned by the client widget (cf-turnstile-response). */
  token: string;
  /** The remote IP for forensics. Optional but recommended. */
  remoteIp?: string;
}

/**
 * Verify a Turnstile token against Cloudflare. Returns `true` when the
 * challenge passed (or when Turnstile is not configured in development).
 */
export async function verifyTurnstileToken(input: VerifyTurnstileTokenInput): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  const isProduction = process.env.NODE_ENV === 'production';

  if (!secret) {
    if (isProduction) {
      // Production must have Turnstile wired. Fail-closed so an oversight
      // does not silently disable bot protection on signup.
      log.error(
        { event: 'auth.turnstile.unconfigured' },
        'TURNSTILE_SECRET_KEY missing in production — rejecting signup',
      );
      return false;
    }
    log.warn(
      { event: 'auth.turnstile.skipped', reason: 'no secret in non-production' },
      'turnstile verification skipped — TURNSTILE_SECRET_KEY unset',
    );
    return true;
  }

  if (!input.token) {
    log.warn({ event: 'auth.turnstile.no_token' }, 'turnstile token missing on signup');
    return false;
  }

  try {
    const body = new URLSearchParams();
    body.set('secret', secret);
    body.set('response', input.token);
    if (input.remoteIp) body.set('remoteip', input.remoteIp);

    // Cloudflare recommends a short timeout — the siteverify endpoint
    // typically responds < 500ms. AbortController so a hung verifier
    // doesn't stall every signup request.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);

    let response: Response;
    try {
      response = await fetch(TURNSTILE_VERIFY_URL, {
        method: 'POST',
        body,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      log.error(
        { event: 'auth.turnstile.http_error', status: response.status },
        'turnstile siteverify HTTP error',
      );
      return false;
    }

    const data = (await response.json()) as TurnstileSiteverifyResponse;
    if (!data.success) {
      log.warn(
        { event: 'auth.turnstile.failed', errors: data['error-codes'] },
        'turnstile verification failed',
      );
      return false;
    }

    return true;
  } catch (err) {
    log.error(
      { event: 'auth.turnstile.exception', err },
      'turnstile verification threw — failing closed',
    );
    return false;
  }
}
