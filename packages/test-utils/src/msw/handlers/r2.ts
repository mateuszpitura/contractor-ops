import { HttpResponse, http } from "msw";
import type { HandlerOptions } from "../types.js";
import { applyNetworkConditions, mockId } from "../utils.js";

/**
 * Cloudflare R2 (S3-compatible) mock handlers.
 *
 * The AWS SDK sends requests to:
 *   https://{ACCOUNT_ID}.r2.cloudflarestorage.com/{bucket}/{key}
 *
 * We use a wildcard pattern to match any account ID.
 */
export function r2Handlers(options?: HandlerOptions) {
  const net = options?.network;

  // In-memory object store
  const objects = new Map<string, { body: Uint8Array; contentType: string }>();

  return [
    // --- PUT Object ---
    http.put("https://*.r2.cloudflarestorage.com/*", async ({ request }) => {
      const err = await applyNetworkConditions(net);
      if (err) return err;

      const url = new URL(request.url);
      const key = url.pathname.slice(1); // remove leading /
      const body = new Uint8Array(await request.arrayBuffer());
      const contentType = request.headers.get("Content-Type") ?? "application/octet-stream";

      objects.set(key, { body, contentType });

      return new HttpResponse(null, {
        status: 200,
        headers: { ETag: `"${mockId().slice(0, 8)}"` },
      });
    }),

    // --- GET Object ---
    http.get("https://*.r2.cloudflarestorage.com/*", async ({ request }) => {
      const err = await applyNetworkConditions(net);
      if (err) return err;

      const url = new URL(request.url);
      const key = url.pathname.slice(1);
      const obj = objects.get(key);

      if (!obj) {
        return HttpResponse.xml(
          `<?xml version="1.0" encoding="UTF-8"?><Error><Code>NoSuchKey</Code><Message>The specified key does not exist.</Message></Error>`,
          { status: 404 },
        );
      }

      return new HttpResponse(obj.body, {
        headers: { "Content-Type": obj.contentType },
      });
    }),

    // --- HEAD Object ---
    http.head("https://*.r2.cloudflarestorage.com/*", async ({ request }) => {
      const err = await applyNetworkConditions(net);
      if (err) return err;

      const url = new URL(request.url);
      const key = url.pathname.slice(1);
      const obj = objects.get(key);

      if (!obj) {
        return new HttpResponse(null, { status: 404 });
      }

      return new HttpResponse(null, {
        status: 200,
        headers: {
          "Content-Type": obj.contentType,
          "Content-Length": String(obj.body.length),
        },
      });
    }),

    // --- DELETE Object ---
    http.delete("https://*.r2.cloudflarestorage.com/*", async ({ request }) => {
      const err = await applyNetworkConditions(net);
      if (err) return err;

      const url = new URL(request.url);
      const key = url.pathname.slice(1);
      objects.delete(key);

      return new HttpResponse(null, { status: 204 });
    }),
  ];
}
