import type { HttpHandler } from 'msw';
import { HttpResponse, http } from 'msw';
import type { HandlerOptions } from '../types.js';
import { applyNetworkConditions, mockId } from '../utils.js';

/**
 * True for R2 S3 API URLs (virtual-hosted or path-style).
 * Exported for scenario overrides — avoid `*` in path strings (MSW + path-to-regexp v8).
 */
export function isR2CloudflareStorageUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname.endsWith('.r2.cloudflarestorage.com');
  } catch {
    return false;
  }
}

/**
 * Cloudflare R2 (S3-compatible) mock handlers.
 *
 * The AWS SDK typically uses virtual-hosted style:
 *   `https://{bucket}.{accountId}.r2.cloudflarestorage.com/{key}`
 * Path-style `https://{accountId}.r2.cloudflarestorage.com/{bucket}/{key}` is also supported
 * by using the full pathname (minus leading slash) as the object key in the map.
 */
export function r2Handlers(options?: HandlerOptions): HttpHandler[] {
  const net = options?.network;

  const objects = new Map<string, { body: Uint8Array; contentType: string }>();

  return [
    http.put(
      ({ request }) => isR2CloudflareStorageUrl(request.url),
      async ({ request }) => {
        const err = await applyNetworkConditions(net);
        if (err) return err;

        const url = new URL(request.url);
        const key = url.pathname.replace(/^\//, '');
        const body = new Uint8Array(await request.arrayBuffer());
        const contentType = request.headers.get('Content-Type') ?? 'application/octet-stream';

        objects.set(key, { body, contentType });

        return new HttpResponse(null, {
          status: 200,
          headers: { ETag: `"${mockId().slice(0, 8)}"` },
        });
      },
    ),

    http.get(
      ({ request }) => isR2CloudflareStorageUrl(request.url),
      async ({ request }) => {
        const err = await applyNetworkConditions(net);
        if (err) return err;

        const url = new URL(request.url);
        const key = url.pathname.replace(/^\//, '');
        const obj = objects.get(key);

        if (!obj) {
          return HttpResponse.xml(
            `<?xml version="1.0" encoding="UTF-8"?><Error><Code>NoSuchKey</Code><Message>The specified key does not exist.</Message></Error>`,
            { status: 404 },
          );
        }

        return new HttpResponse(obj.body, {
          headers: { 'Content-Type': obj.contentType },
        });
      },
    ),

    http.head(
      ({ request }) => isR2CloudflareStorageUrl(request.url),
      async ({ request }) => {
        const err = await applyNetworkConditions(net);
        if (err) return err;

        const url = new URL(request.url);
        const key = url.pathname.replace(/^\//, '');
        const obj = objects.get(key);

        if (!obj) {
          return new HttpResponse(null, { status: 404 });
        }

        return new HttpResponse(null, {
          status: 200,
          headers: {
            'Content-Type': obj.contentType,
            'Content-Length': String(obj.body.length),
          },
        });
      },
    ),

    http.delete(
      ({ request }) => isR2CloudflareStorageUrl(request.url),
      async ({ request }) => {
        const err = await applyNetworkConditions(net);
        if (err) return err;

        const url = new URL(request.url);
        const key = url.pathname.replace(/^\//, '');
        objects.delete(key);

        return new HttpResponse(null, { status: 204 });
      },
    ),
  ];
}
