/**
 * Fastify ↔ Web (fetch API) request/response bridge.
 *
 * Used by every Fastify route that delegates to a framework-agnostic Web
 * handler — Better Auth (`auth.handler(Request)`) and tRPC's
 * `fetchRequestHandler`. Keeping the conversion in one place means both
 * mount points share the same header/body/cookie semantics.
 *
 * Body handling:
 *   - GET/HEAD requests carry no body.
 *   - For body-bearing methods the calling plugin MUST register a
 *     raw-buffer content-type parser (Fastify's default JSON parser
 *     consumes the stream and hands back a parsed object, which is the
 *     wrong shape for a Web Request body). Pattern:
 *
 *       app.removeAllContentTypeParsers();
 *       app.addContentTypeParser('*', { parseAs: 'buffer' }, (_r, b, d) => d(null, b));
 *
 *     Both auth.ts and trpc.ts encapsulate that override inside their own
 *     plugin scope so JSON parsing on sibling routes is unaffected.
 */

import type { FastifyReply, FastifyRequest } from 'fastify';

/** Build a Web `Request` from a Fastify request, preserving headers + body. */
export function toWebRequest(request: FastifyRequest): Request {
  const url = absoluteUrl(request);

  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, item);
    } else {
      headers.set(key, String(value));
    }
  }

  const method = request.method.toUpperCase();
  const hasBody = !['GET', 'HEAD'].includes(method);
  const body = hasBody ? (request.body as Buffer | undefined) : undefined;

  const init: RequestInit = {
    method,
    headers,
    body: body && body.length > 0 ? body : undefined,
  };
  if (hasBody && body && body.length > 0) {
    // Node ≥ 18 requires duplex when constructing a Request with a body;
    // @types/node@24+ accepts it via RequestInit augmentation.
    (init as RequestInit & { duplex: 'half' }).duplex = 'half';
  }
  return new Request(url, init);
}

/** Stream a Web `Response` back to a Fastify reply, preserving Set-Cookie. */
export async function sendWebResponse(reply: FastifyReply, response: Response): Promise<void> {
  reply.code(response.status);

  // Headers.entries() collapses Set-Cookie to a single comma-joined value
  // which corrupts multi-cookie responses. Use getSetCookie() (Node ≥
  // 19.7 / undici ≥ 5.21) to recover the per-cookie array.
  for (const [key, value] of response.headers.entries()) {
    if (key.toLowerCase() === 'set-cookie') continue;
    reply.header(key, value);
  }
  const setCookies =
    (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
  for (const cookie of setCookies) {
    reply.header('set-cookie', cookie);
  }

  const body = response.body ? Buffer.from(await response.arrayBuffer()) : null;
  if (body && body.length > 0) {
    await reply.send(body);
  } else {
    await reply.send();
  }
}

function absoluteUrl(request: FastifyRequest): URL {
  // Fastify exposes the path + query as request.url; scheme/host come from
  // headers (Render/Cloudflare set x-forwarded-proto). The downstream Web
  // handlers (Better Auth, tRPC) only read pathname/search, so host is
  // best-effort.
  const protocol = (request.headers['x-forwarded-proto'] as string | undefined) ?? 'http';
  const host = request.headers.host ?? 'localhost';
  return new URL(request.url, `${protocol}://${host}`);
}
