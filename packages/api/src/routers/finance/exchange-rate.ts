import { getRegionalClient, SUPPORTED_REGIONS } from '@contractor-ops/db';
import { router } from '../../init';
import { cronProcedure } from '../../middleware/cron-trpc';
import { fetchAndStoreRates } from '../../services/exchange-rate';

export const exchangeRateRouter = router({
  /**
   * Cron endpoint: Fetch ECB rates once and persist into **each** regional DB
   * (same `ExchangeRate` rows per region; tenant reads use `ctx.db`).
   *
   * Per-tenant read paths consume `getRate(...)` / `convertAmount(...)`
   * directly from the service module rather than through a tRPC procedure —
   * invoice creation and payment-run preview both call those functions
   * server-side. No FE-facing exchange-rate procedures exist by design.
   *
   * Consumer: `apps/cron-worker/src/jobs/handlers/exchange-rates.ts` runs
   * daily at 06:00 UTC. The handler builds a cron-scoped tRPC caller via
   * `createCallerFactory(appRouter)` + `createCronContext`, forwards the
   * verified `Authorization: Bearer <CRON_SECRET>` header so `cronProcedure`
   * middleware accepts the call, and invokes `caller.exchangeRate.fetchDaily()`.
   * Tagged `orphan-intentional-non-ui` by the FE↔BE audit's triage step
   * (Signal #1: cronProcedure middleware).
   */
  fetchDaily: cronProcedure.mutation(async () => {
    const errors: string[] = [];
    let stored = 0;
    for (const region of SUPPORTED_REGIONS) {
      try {
        const r = await fetchAndStoreRates(getRegionalClient(region));
        stored += r.stored;
        for (const e of r.errors) {
          errors.push(`[${region}] ${e}`);
        }
      } catch (err) {
        errors.push(`[${region}] ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    return { stored, errors };
  }),
});
