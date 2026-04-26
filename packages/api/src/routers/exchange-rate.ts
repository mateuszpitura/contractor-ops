import { getRegionalClient, SUPPORTED_REGIONS } from '@contractor-ops/db';
import {
  exchangeRateConvertSchema,
  exchangeRateLatestSchema,
  exchangeRateQuerySchema,
} from '@contractor-ops/validators';
import { router } from '../init.js';
import { cronProcedure } from '../middleware/cron-trpc.js';
import { tenantProcedure } from '../middleware/tenant.js';
import { convertAmount, fetchAndStoreRates, getRate } from '../services/exchange-rate.js';

export const exchangeRateRouter = router({
  /**
   * Get exchange rates for a date range and currency pair.
   */
  query: tenantProcedure.input(exchangeRateQuerySchema).query(async ({ ctx, input }) => {
    const rates = await ctx.db.exchangeRate.findMany({
      where: {
        base: input.base,
        target: input.target,
        date: {
          gte: input.dateFrom,
          ...(input.dateTo ? { lte: input.dateTo } : {}),
        },
      },
      orderBy: { date: 'desc' },
    });
    return rates.map(r => ({
      date: r.date.toISOString().slice(0, 10),
      base: r.base,
      target: r.target,
      rate: Number(r.rate),
      source: r.source,
    }));
  }),

  /**
   * Get the latest available rate for a currency pair.
   */
  latest: tenantProcedure.input(exchangeRateLatestSchema).query(async ({ ctx, input }) => {
    const result = await getRate(ctx.db, input.base, input.target, new Date());
    if (!result) {
      throw new Error(`No exchange rate found for ${input.base}/${input.target}`);
    }
    return {
      date: result.date.toISOString().slice(0, 10),
      rate: result.rate,
      source: result.source,
    };
  }),

  /**
   * Convert an amount between currencies using stored rates.
   */
  convert: tenantProcedure.input(exchangeRateConvertSchema).query(async ({ ctx, input }) => {
    const result = await convertAmount(ctx.db, input.amountMinor, input.from, input.to, input.date);
    if (!result) {
      throw new Error(`Cannot convert ${input.from} to ${input.to} — missing exchange rate`);
    }
    return result;
  }),

  /**
   * Cron endpoint: Fetch ECB rates once and persist into **each** regional DB
   * (same `ExchangeRate` rows per region; tenant reads use `ctx.db`).
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
