import { HttpResponse, http } from 'msw';
import { dataportFixtures } from '../fixtures/dataport.js';
import type { HandlerOptions } from '../types.js';
import { applyNetworkConditions } from '../utils.js';

/**
 * MSW handlers for dataport.pl's company-registry REST API.
 *
 * Default: any 10-digit NIP returns the happy-path fixture. Tests that need
 * a 404 / different payload can override via `server.use(...)`.
 */
export function dataportHandlers(options?: HandlerOptions) {
  const net = options?.network;

  return [
    http.get('https://dataport.pl/api/v1/company/:nip', async ({ params }) => {
      const err = await applyNetworkConditions(net);
      if (err) return err;

      const nip = String(params.nip ?? '');
      if (!/^\d{10}$/.test(nip)) {
        return HttpResponse.json({ error: 'invalid_nip' }, { status: 400 });
      }

      return HttpResponse.json(dataportFixtures.happyPath());
    }),
  ];
}
