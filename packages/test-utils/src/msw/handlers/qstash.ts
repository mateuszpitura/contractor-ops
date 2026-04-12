import { HttpResponse, http } from 'msw';
import type { HandlerOptions } from '../types.js';
import { applyNetworkConditions, mockId } from '../utils.js';

export function qstashHandlers(options?: HandlerOptions) {
  const net = options?.network;

  return [
    // --- Publish Message ---
    http.post('https://qstash.upstash.io/v2/publish/*', async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json({
        messageId: `msg_${mockId()}`,
      });
    }),

    // --- Publish JSON ---
    http.post('https://qstash.upstash.io/v2/enqueue/*', async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json({
        messageId: `msg_${mockId()}`,
      });
    }),

    // --- Batch Publish ---
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
