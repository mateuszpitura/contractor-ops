/**
 * Defense-in-depth CSRF origin check for /api/**.
 *
 * Better Auth ships its own CSRF token + SameSite cookie posture, but the
 * cross-subdomain deployment (app.* ↔ api.* with `SameSite=None`) widens
 * the attack surface. This hook rejects any non-`GET` request whose
 * `Origin` (or, when absent, `Referer`) header is not in the configured
 * allowlist — regardless of Better Auth's own checks.
 *
 * Exempt paths:
 *   - /health, /ready  — operator probes; Origin typically absent.
 *   - /webhooks/**     — signed by external providers (Stripe, KSeF, Peppol,
 *                       ZATCA, InPost, Storecove); HMAC verification owns
 *                       authenticity.
 *   - /csp-report      — browser-emitted; Origin is null on report POSTs.
 *
 * Mismatch returns 403 + `{ error: 'origin not allowed' }`. The request is
 * logged at WARN with the bad origin so a spike in attempts is visible to
 * on-call (potential cross-site request floods).
 */

import { createLogger } from '@contractor-ops/logger';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

const log = createLogger({ service: 'api-server', component: 'csrf-origin' });

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const EXEMPT_PREFIXES = [
  '/health',
  '/ready',
  '/csp-report',
  '/web-vitals',
  '/webhooks/',
  '/revalidate-legal',
  // QStash-driven worker routes — authn is the QStash `Receiver`
  // signature check, not Origin.
  '/zatca/',
  '/peppol/',
  '/ksef/',
  '/outbox/',
  '/ocr/',
  '/exports/_process',
  '/google-workspace/',
  '/late-interest/',
  '/webhooks-outbound/',
  '/contract-health/',
  '/idp-deprovisioning/',
  // Bot Framework `process()` validates the inbound JWT itself — Origin
  // is not relevant.
  '/teams/',
  // Better Auth ships its own CSRF token + per-endpoint origin checks
  // (auth.trustedOrigins). Double-guarding here would block the legitimate
  // sign-out / OAuth callback flows where `Origin` is intentionally absent
  // or third-party (e.g. POST from a provider's OAuth redirect).
  '/api/auth/',
] as const;

function isExempt(url: string): boolean {
  return EXEMPT_PREFIXES.some(p => url === p || url.startsWith(p));
}

export interface CsrfOriginOptions {
  allowedOrigins: readonly string[];
}

export function registerCsrfOriginGuard(app: FastifyInstance, opts: CsrfOriginOptions): void {
  const allow = new Set(opts.allowedOrigins);

  app.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (SAFE_METHODS.has(request.method)) return;
    if (isExempt(request.url)) return;

    const origin =
      (request.headers.origin as string | undefined) ?? deriveOriginFromReferer(request);
    if (!origin) {
      log.warn(
        { method: request.method, url: request.url, requestId: request.requestId },
        'csrf-origin: missing Origin/Referer on state-changing request',
      );
      return reply.code(403).send({ error: 'origin not allowed' });
    }
    if (!allow.has(origin)) {
      log.warn(
        { method: request.method, url: request.url, origin, requestId: request.requestId },
        'csrf-origin: rejected non-allowlisted origin',
      );
      return reply.code(403).send({ error: 'origin not allowed' });
    }
  });
}

function deriveOriginFromReferer(request: FastifyRequest): string | undefined {
  const referer = request.headers.referer ?? request.headers.referrer;
  if (typeof referer !== 'string') return;
  try {
    return new URL(referer).origin;
  } catch {
    return;
  }
}
