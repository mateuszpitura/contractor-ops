/**
 * @fastify/helmet registration with the API-side CSP.
 *
 * Per plan.md Step 2 verify gate, the live API runs **report-only** for
 * 48 h before flipping to enforce. Toggle via the `CSP_MODE` env var
 * (`report-only` | `enforce`, default `enforce` once the rollout
 * completes).
 */

import helmet, { type FastifyHelmetOptions } from '@fastify/helmet';
import type { FastifyInstance } from 'fastify';
import type { Env } from '../env.js';
import { buildApiCsp, REPORT_TO_HEADER } from '../lib/csp.js';

export async function registerHelmet(app: FastifyInstance, env: Env): Promise<void> {
  const cspBody = buildApiCsp({ extraConnectSrc: [env.APP_URL] });
  const reportOnly = env.CSP_MODE === 'report-only';

  const opts: FastifyHelmetOptions = {
    contentSecurityPolicy: false, // we set the header manually below to preserve the exact directive order
    crossOriginEmbedderPolicy: false, // API responses are usually JSON; COEP costs more than it buys here.
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-site' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    strictTransportSecurity: {
      maxAge: 63_072_000,
      includeSubDomains: true,
      preload: true,
    },
    xFrameOptions: { action: 'deny' },
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },
  };

  await app.register(helmet, opts);

  // Set CSP + Report-To manually so the directive list stays byte-identical
  // to the legacy Next config (easier to audit during the C.1.c-equivalent
  // rollout). `onSend` runs after helmet so the header isn't double-set.
  app.addHook('onSend', async (_req, reply, payload) => {
    const header = reportOnly ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy';
    reply.header(header, cspBody);
    reply.header('Report-To', REPORT_TO_HEADER);
    reply.header(
      'Permissions-Policy',
      [
        'camera=()',
        'microphone=()',
        'geolocation=()',
        'interest-cohort=()',
        'payment=()',
        'fullscreen=(self)',
      ].join(', '),
    );
    return payload;
  });
}
