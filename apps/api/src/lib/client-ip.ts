/**
 * Trusted-proxy client-IP extraction for @contractor-ops/api-server.
 *
 * Ported from `apps/web/src/middleware.ts#extractClientIp` so the new
 * Fastify rate-limiter sees the same address as the legacy Next edge
 * middleware did (F-SEC-17). When the trust list is too permissive a
 * remote attacker can supply their own X-Forwarded-For entry and the
 * rate-limiter sees a fresh IP per request → trivial bypass.
 *
 * Default trust list (`loopback,linklocal,uniquelocal`) is the conservative
 * pre-Render default. Production .env sets `TRUSTED_PROXIES` to Render's
 * private subnet CIDRs (`10.0.0.0/8,loopback`) or Cloudflare's published
 * ranges when fronted by CF.
 */

import type { FastifyRequest } from 'fastify';
import proxyAddr from 'proxy-addr';

export type ClientIpExtractor = (request: FastifyRequest) => string;

export function createClientIpExtractor(trustedProxiesCsv: string): ClientIpExtractor {
  const trusted = trustedProxiesCsv
    .split(',')
    .map(p => p.trim())
    .filter(Boolean);

  return function extractClientIp(request: FastifyRequest): string {
    // proxy-addr wants a Node-shaped req — Fastify already wraps the raw req
    // and the package only reads `.headers` and `.connection.remoteAddress`,
    // so the raw req is a drop-in fit.
    try {
      const ip = proxyAddr(request.raw, trusted);
      return ip || 'unknown';
    } catch {
      // proxy-addr throws on invalid CIDR notation. Fall back to the
      // platform-set x-real-ip / last XFF hop rather than failing the
      // request — rate-limiter loses some precision but stays functional.
      const xri = (request.headers['x-real-ip'] as string | undefined)?.trim();
      if (xri) return xri;
      const xff = request.headers['x-forwarded-for'];
      const xffStr = Array.isArray(xff) ? xff.join(',') : xff;
      const last = xffStr?.split(',').pop()?.trim();
      return last || 'unknown';
    }
  };
}
