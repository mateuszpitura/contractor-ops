/**
 * Portal session cookie helpers.
 *
 * Both routes are exempt from the CSRF origin guard via the `/portal/`
 * prefix exemption — portal session establishment runs from the magic
 * link verification page which posts here cross-tab on cold load.
 *
 * set-session requires an HMAC signature minted by the originating tRPC
 * mutation (`portal.verifyMagicLink` / `portal.selectOrg`). Without it,
 * an attacker could plant any body-supplied token as a cookie — a CSRF /
 * session-fixation primitive.
 * The signature is byte-identical to the helper in
 * `packages/api/src/routers/portal/portal.ts#signPortalSessionToken`;
 * any rotation requires bumping the domain-separator label there too.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { deletePortalSession } from '@contractor-ops/api/services/portal-session';
import { createLogger } from '@contractor-ops/logger';
import { getServerEnv } from '@contractor-ops/validators';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Sentry } from '../lib/sentry.js';

const log = createLogger({ service: 'portal-session' });

const setSessionSchema = z.object({
  token: z.string().min(1),
  expiresAt: z.string().min(1),
  signature: z.string().min(1),
});

function expectedSignature(token: string, expiresAt: string): string {
  const secret = getServerEnv().BETTER_AUTH_SECRET;
  return createHmac('sha256', `${secret}|portal-set-session-v1`)
    .update(`${token}.${expiresAt}`)
    .digest('base64url');
}

function signaturesMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function registerPortalSessionRoutes(app: FastifyInstance): void {
  app.post('/portal/set-session', async (request, reply) => {
    const parsed = setSessionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid request body' });
    }

    const { token, expiresAt, signature } = parsed.data;
    const expected = expectedSignature(token, expiresAt);
    if (!signaturesMatch(signature, expected)) {
      return reply.code(401).send({ error: 'Invalid session signature' });
    }

    reply.setCookie('portal_session', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
      expires: new Date(expiresAt),
    });
    return reply.code(200).send({ success: true });
  });

  app.post('/portal/clear-session', async (request, reply) => {
    try {
      const sessionToken = request.cookies?.portal_session;
      if (sessionToken) {
        await deletePortalSession(sessionToken);
      }
    } catch (err) {
      log.warn({ err }, 'failed to delete portal session DB row; clearing cookie anyway');
      Sentry.captureException(err, { tags: { 'portal.flow': 'clear_session' } });
    }
    reply.clearCookie('portal_session', { path: '/' });
    return reply.code(200).send({ success: true });
  });
}
