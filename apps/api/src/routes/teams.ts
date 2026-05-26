/**
 * Microsoft Teams Bot Framework messaging endpoint.
 *
 * Migrated 2026-05-22 from archived `botbuilder` → Microsoft 365 Agents SDK.
 *
 *   1. `CloudAdapter` + `TurnContext` + `ActivityHandler` now ship from
 *      `@microsoft/agents-hosting`.
 *   2. `ConfigurationBotFrameworkAuthentication(process.env)` is gone;
 *      we build a plain `AuthConfiguration` from the existing
 *      `AZURE_BOT_APP_ID` / `AZURE_BOT_APP_SECRET` env vars (no Render
 *      rename needed). Multi-tenant is the default — no MicrosoftAppType
 *      field exists on `AuthConfiguration`.
 *   3. The Agents SDK splits JWT validation out of `CloudAdapter.process()`
 *      into an Express middleware `authorizeJWT(authConfig)`. The legacy
 *      Bot Framework SDK validated inline. Since Fastify can't run Express
 *      middleware directly, we bridge with a per-route preHandler that
 *      wraps Fastify's request/reply in Express-shaped shims, invokes
 *      `authorizeJWT`, and lets it write 401 directly on shim rejection.
 *      On success the JWT payload is on `shimReq.user` for
 *      `adapter.process()` to consume.
 *   4. The shim req/res chain feeds both `authorizeJWT` and
 *      `adapter.process()` so identity + response writes flow through one
 *      object pair. Fastify's reply mirrors the shim's final status/body.
 *
 * Bot Framework `process()` no longer auto-validates the inbound JWT — we
 * MUST run `authorizeJWT` first, otherwise `request.user` is undefined and
 * `new TurnContext(this, activity, request.user!)` blows up on the
 * non-null assertion inside CloudAdapter. Anonymous local-dev mode is
 * supported by `authorizeJWT` itself: when `authConfig.clientId` is empty
 * and `NODE_ENV !== 'production'`, the middleware sets `req.user = { name:
 * 'anonymous' }`.
 *
 * `/teams/` is registered in `EXEMPT_PREFIXES` for the CSRF origin guard —
 * Teams' Bot Framework Service doesn't send an Origin header and the JWT
 * is the actual authn.
 */

import { TeamsBotHandler } from '@contractor-ops/api/services/teams/teams-bot-handler';
import { createWebhookLogger } from '@contractor-ops/logger';
import type { AuthConfiguration } from '@microsoft/agents-hosting';
import { authorizeJWT, CloudAdapter } from '@microsoft/agents-hosting';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { loadEnv } from '../env.js';

const log = createWebhookLogger('teams-bot');

let adapter: CloudAdapter | null = null;

function getAuthConfig(): AuthConfiguration {
  const env = loadEnv();
  return {
    clientId: env.AZURE_BOT_APP_ID ?? '',
    clientSecret: env.AZURE_BOT_APP_SECRET ?? '',
  };
}

function getAdapter(): CloudAdapter {
  if (adapter) return adapter;
  adapter = new CloudAdapter(getAuthConfig());
  return adapter;
}

const bot = new TeamsBotHandler();

// ---------------------------------------------------------------------------
// Express ↔ Fastify shims
// ---------------------------------------------------------------------------
//
// Both `authorizeJWT` and `CloudAdapter.process` are written against the
// Express request/response API. We bridge with a minimal shim pair that
// covers exactly what those code paths touch:
//
//   req: body, headers, method, user (set by authorizeJWT)
//   res: status(n).send(body).end(), setHeader(k, v), writableEnded,
//        headersSent
//
// The shim res buffers writes; after `process()` returns we flush
// statusCode + headers + body onto Fastify's reply.
// ---------------------------------------------------------------------------

interface ShimRequest {
  body: unknown;
  headers: Record<string, string | string[] | undefined>;
  method: string;
  user?: unknown;
}

interface ShimResponse {
  statusCode: number;
  responseBody: unknown;
  responseHeaders: Record<string, string>;
  writableEnded: boolean;
  headersSent: boolean;
  status(code: number): ShimResponse;
  send(body: unknown): ShimResponse;
  end(): ShimResponse;
  setHeader(name: string, value: string): ShimResponse;
}

function createResponseShim(): ShimResponse {
  const shim: ShimResponse = {
    statusCode: 200,
    responseBody: undefined,
    responseHeaders: {},
    writableEnded: false,
    headersSent: false,
    status(code: number) {
      shim.statusCode = code;
      return shim;
    },
    send(body: unknown) {
      shim.responseBody = body;
      shim.headersSent = true;
      return shim;
    },
    end() {
      shim.writableEnded = true;
      return shim;
    },
    setHeader(name: string, value: string) {
      shim.responseHeaders[name.toLowerCase()] = value;
      return shim;
    },
  };
  return shim;
}

function buildShimRequest(request: FastifyRequest): ShimRequest {
  return {
    body: request.body ?? {},
    // `authorizeJWT` reads `request.headers.authorization` — Fastify's
    // headers object already gives lowercased keys.
    headers: request.headers as Record<string, string | string[] | undefined>,
    method: request.method,
  };
}

async function runAuthorizeJWT(
  authConfig: AuthConfiguration,
  shimReq: ShimRequest,
  shimRes: ShimResponse,
): Promise<boolean> {
  const middleware = authorizeJWT(authConfig);

  let nextCalled = false;
  const next = () => {
    nextCalled = true;
  };

  // The Express middleware is async; await its returned promise. On
  // failure it writes status + body via `res.status(n).send(...)` and
  // returns without calling `next()`. We surface that as `false`.
  await (
    middleware as unknown as (
      req: ShimRequest,
      res: ShimResponse,
      next: () => void,
    ) => Promise<void>
  )(shimReq, shimRes, next);

  return nextCalled;
}

function flushShimToFastify(shimRes: ShimResponse, reply: FastifyReply): FastifyReply {
  for (const [name, value] of Object.entries(shimRes.responseHeaders)) {
    reply.header(name, value);
  }
  reply.code(shimRes.statusCode);
  if (shimRes.responseBody === undefined) return reply.send();
  return reply.send(shimRes.responseBody);
}

export function registerTeamsMessagesRoute(app: FastifyInstance): void {
  app.post('/teams/messages', async (request, reply) => {
    try {
      const authConfig = getAuthConfig();
      const shimReq = buildShimRequest(request);
      const shimRes = createResponseShim();

      const authorized = await runAuthorizeJWT(authConfig, shimReq, shimRes);
      if (!authorized) {
        return flushShimToFastify(shimRes, reply);
      }

      // CloudAdapter.process expects the Express-shaped req/res; types are
      // duck-typed structurally, so cast through `unknown`.
      type RawAdapterProcess = (
        req: unknown,
        res: unknown,
        // biome-ignore lint/suspicious/noExplicitAny: Bot Framework callback type
        logic: (context: any) => Promise<void>,
      ) => Promise<void>;
      await (getAdapter().process as unknown as RawAdapterProcess)(
        shimReq,
        shimRes,
        async context => {
          await bot.run(context);
        },
      );

      return flushShimToFastify(shimRes, reply);
    } catch (error) {
      log.error({ err: error }, 'bot framework endpoint error');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}
