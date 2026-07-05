import { createApiKeyContext, createCallerFactory, publicApiRouter } from '@contractor-ops/api';
import type { Context } from 'hono';

const factory = createCallerFactory(publicApiRouter);

/**
 * Best-effort client IP: the left-most hop of `x-forwarded-for` (the original
 * client as appended by the Render proxy), falling back to `x-real-ip`. Only the
 * proxy-appended chain is trusted — a client-set full XFF is not taken as gospel.
 */
function extractSourceIp(c: Context): string | undefined {
  const forwarded = c.req.header('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return c.req.header('x-real-ip') ?? undefined;
}

/**
 * Builds a tRPC caller for the public API router from a Hono request context.
 * Passes through the Authorization header so the apiKeyTenantProcedure
 * middleware can validate the API key, plus the client source IP + User-Agent so
 * every write mutation audits with `ipAddress` + `userAgent`.
 */
export function createPublicCaller(c: Context) {
  const headers = new Headers();
  headers.set('authorization', c.req.header('authorization') ?? '');

  const ctx = createApiKeyContext({ headers });
  ctx.sourceIp = extractSourceIp(c);
  ctx.userAgent = c.req.header('user-agent') ?? undefined;
  return factory(ctx);
}
