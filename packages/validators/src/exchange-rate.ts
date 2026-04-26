import { z } from 'zod';

/**
 * Query exchange rates for a date range and currency pair.
 */
export const exchangeRateQuerySchema = z.object({
  base: z.string().length(3).default('EUR'),
  target: z.string().length(3),
  dateFrom: z.coerce.date(),
  dateTo: z.coerce.date().optional(),
});

export type ExchangeRateQuery = z.infer<typeof exchangeRateQuerySchema>;

/**
 * Get the latest rate for a currency pair.
 */
export const exchangeRateLatestSchema = z.object({
  base: z.string().length(3).default('EUR'),
  target: z.string().length(3),
});

export type ExchangeRateLatest = z.infer<typeof exchangeRateLatestSchema>;

/**
 * Convert an amount from one currency to another using stored rates.
 */
export const exchangeRateConvertSchema = z.object({
  amountMinor: z.number().int(),
  from: z.string().length(3),
  to: z.string().length(3),
  date: z.coerce.date().optional(),
});

export type ExchangeRateConvert = z.infer<typeof exchangeRateConvertSchema>;
