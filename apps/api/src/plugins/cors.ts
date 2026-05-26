/**
 * @fastify/cors registration.
 *
 * Exact-origin allowlist seeded from `APP_URL` env (e.g.
 * `https://app.contractor-ops.com`). No wildcards — `credentials: true`
 * forbids `Access-Control-Allow-Origin: *` per the CORS spec.
 *
 * `maxAge: 86400` amortises preflight cost across a day, which matters now
 * that SPA <-> API live on different subdomains and every cross-origin call
 * costs an OPTIONS (plan.md risk: "CORS preflight cache").
 */

import cors, { type FastifyCorsOptions } from '@fastify/cors';
import type { FastifyInstance } from 'fastify';
import type { Env } from '../env.js';

export async function registerCors(app: FastifyInstance, env: Env): Promise<void> {
  const allowedOrigins = new Set<string>([env.APP_URL]);

  const opts: FastifyCorsOptions = {
    origin: (origin, cb) => {
      // Same-origin or server-to-server requests omit `Origin` entirely.
      if (!origin) return cb(null, true);
      if (allowedOrigins.has(origin)) return cb(null, true);
      // Reject rather than echo back a wildcard.
      return cb(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id', 'x-csrf-token'],
    exposedHeaders: [
      'x-request-id',
      'x-ratelimit-limit',
      'x-ratelimit-remaining',
      'x-ratelimit-reset',
    ],
    maxAge: 86_400,
  };

  await app.register(cors, opts);
}
