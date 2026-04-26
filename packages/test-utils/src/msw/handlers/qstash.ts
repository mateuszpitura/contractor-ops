import type { HttpHandler } from 'msw';
import { HttpResponse, http } from 'msw';
import type { HandlerOptions } from '../types.js';
import { applyNetworkConditions, mockId } from '../utils.js';

/** Exported for scenario overrides (MSW path globs break with path-to-regexp v8). */
export function isQStashPublishUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname === 'qstash.upstash.io' && u.pathname.startsWith('/v2/publish/');
  } catch {
    return false;
  }
}

function isQStashEnqueueUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname === 'qstash.upstash.io' && u.pathname.startsWith('/v2/enqueue/');
  } catch {
    return false;
  }
}

export function qstashHandlers(options?: HandlerOptions): HttpHandler[] {
  const net = options?.network;

  return [
    http.post(
      ({ request }) => isQStashPublishUrl(request.url),
      async () => {
        const err = await applyNetworkConditions(net);
        if (err) return err;
        return HttpResponse.json({
          messageId: `msg_${mockId()}`,
        });
      },
    ),

    http.post(
      ({ request }) => isQStashEnqueueUrl(request.url),
      async () => {
        const err = await applyNetworkConditions(net);
        if (err) return err;
        return HttpResponse.json({
          messageId: `msg_${mockId()}`,
        });
      },
    ),

    http.post('https://qstash.upstash.io/v2/batch', async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json([
        { messageId: `msg_${mockId()}` },
        { messageId: `msg_${mockId()}` },
      ]);
    }),
  ];
}
