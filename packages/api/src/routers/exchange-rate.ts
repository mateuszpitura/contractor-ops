import { z } from "zod";
import { prisma } from "@contractor-ops/db";
import { router } from "../init.js";
import { tenantProcedure } from "../middleware/tenant.js";
import { publicProcedure } from "../init.js";
import {
  exchangeRateQuerySchema,
  exchangeRateLatestSchema,
  exchangeRateConvertSchema,
} from "@contractor-ops/validators";
import {
  fetchAndStoreRates,
  getRate,
  convertAmount,
} from "../services/exchange-rate.js";

export const exchangeRateRouter = router({
  /**
   * Get exchange rates for a date range and currency pair.
   */
  query: tenantProcedure
    .input(exchangeRateQuerySchema)
    .query(async ({ input }) => {
      const rates = await prisma.exchangeRate.findMany({
        where: {
          base: input.base,
          target: input.target,
          date: {
            gte: input.dateFrom,
            ...(input.dateTo ? { lte: input.dateTo } : {}),
          },
        },
        orderBy: { date: "desc" },
      });
      return rates.map((r) => ({
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
  latest: tenantProcedure
    .input(exchangeRateLatestSchema)
    .query(async ({ input }) => {
      const result = await getRate(
        prisma,
        input.base,
        input.target,
        new Date(),
      );
      if (!result) {
        throw new Error(
          `No exchange rate found for ${input.base}/${input.target}`,
        );
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
  convert: tenantProcedure
    .input(exchangeRateConvertSchema)
    .query(async ({ input }) => {
      const result = await convertAmount(
        prisma,
        input.amountMinor,
        input.from,
        input.to,
        input.date,
      );
      if (!result) {
        throw new Error(
          `Cannot convert ${input.from} to ${input.to} — missing exchange rate`,
        );
      }
      return result;
    }),

  /**
   * Cron endpoint: Fetch and store today's rates.
   * Called by QStash daily cron job.
   */
  fetchDaily: publicProcedure
    .input(z.object({ signature: z.string().optional() }).optional())
    .mutation(async () => {
      const result = await fetchAndStoreRates(prisma);
      return result;
    }),
});
