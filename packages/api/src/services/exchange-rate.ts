/**
 * Exchange rate service — ECB daily rate fetching, cross-rate derivation, and conversion.
 *
 * ECB is the primary source. AED (3.6725 USD peg) and SAR (3.75 USD peg)
 * are derived via USD cross-rates. Rates are stored in ExchangeRate and
 * refreshed via a QStash daily cron.
 */

import type { DbClient, PrimaryPrismaClient } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ECB_DAILY_URL = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml';

/** AED is pegged to USD at 3.6725 AED per 1 USD. */
const AED_USD_PEG = 3.6725;

/** SAR is pegged to USD at 3.75 SAR per 1 USD. */
const SAR_USD_PEG = 3.75;

/**
 * Prefix marking a rate row copied forward from a prior day during an ECB feed
 * outage (the fallback in `fetchAndStoreRates`). Encoded as
 * `CARRIED_FORWARD:<YYYY-MM-DD>` where the suffix is the ORIGINAL observation
 * date, so a multi-day outage keeps pointing at the last genuine ECB reading and
 * the staleness stays visible to `getRate`'s max-age floor even though the row's
 * own `date` is re-stamped to today on each carry-forward.
 */
export const CARRIED_FORWARD_SOURCE_PREFIX = 'CARRIED_FORWARD';

/**
 * Max age (in days) of the underlying rate observation before a settlement or
 * tax/invoice FX conversion FAILS LOUDLY instead of silently applying a stale
 * rate. ECB publishes on TARGET business days; the longest legitimate
 * weekend+holiday gap (Easter, Christmas) is ~4 calendar days, so 7 tolerates
 * every real gap with margin while still catching a genuine multi-day feed
 * outage. Display-only conversions pass no floor and are unaffected.
 */
export const FX_CONVERSION_MAX_AGE_DAYS = 7;

/**
 * Thrown by `getRate` when a `maxAgeDays` floor is supplied and the resolved
 * rate observation is older than that threshold. Settlement / tax conversions
 * translate this into a caller-facing error rather than paying at a stale rate.
 */
export class StaleExchangeRateError extends Error {
  readonly base: string;
  readonly target: string;
  /** Date of the underlying observation (original date for carried-forward rows). */
  readonly rateDate: Date;
  /** Date the conversion was requested for. */
  readonly requestedDate: Date;
  readonly ageDays: number;
  readonly maxAgeDays: number;

  constructor(args: {
    base: string;
    target: string;
    rateDate: Date;
    requestedDate: Date;
    ageDays: number;
    maxAgeDays: number;
  }) {
    super(
      `Exchange rate ${args.base}->${args.target} is stale: observation dated ` +
        `${args.rateDate.toISOString().slice(0, 10)} is ${args.ageDays}d old ` +
        `(> ${args.maxAgeDays}d max) as of ${args.requestedDate.toISOString().slice(0, 10)}`,
    );
    this.name = 'StaleExchangeRateError';
    this.base = args.base;
    this.target = args.target;
    this.rateDate = args.rateDate;
    this.requestedDate = args.requestedDate;
    this.ageDays = args.ageDays;
    this.maxAgeDays = args.maxAgeDays;
  }
}

/**
 * The underlying observation date for a stored rate row. For a carried-forward
 * row (`CARRIED_FORWARD:<YYYY-MM-DD>`) this is the embedded original date;
 * otherwise the row's own `date`. Falls back to the row date if the suffix is
 * unparseable.
 */
function observationDate(row: { date: Date; source: string }): Date {
  if (row.source.startsWith(`${CARRIED_FORWARD_SOURCE_PREFIX}:`)) {
    const iso = row.source.slice(CARRIED_FORWARD_SOURCE_PREFIX.length + 1);
    const parsed = new Date(`${iso}T00:00:00.000Z`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return row.date;
}

/** Whole-day age of `rateDate` relative to `asOf`, both floored to UTC midnight. */
function rateAgeInDays(rateDate: Date, asOf: Date): number {
  const dayMs = 24 * 60 * 60 * 1000;
  const rateDay = Date.UTC(
    rateDate.getUTCFullYear(),
    rateDate.getUTCMonth(),
    rateDate.getUTCDate(),
  );
  const asOfDay = Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate());
  return Math.floor((asOfDay - rateDay) / dayMs);
}

/**
 * Build the `source` value for a carried-forward row, preserving the ORIGINAL
 * observation date across a multi-day outage: if the prior row was itself
 * carried forward, its embedded original date is reused.
 */
function carriedForwardSource(prev: { date: Date; source: string }): string {
  if (prev.source.startsWith(`${CARRIED_FORWARD_SOURCE_PREFIX}:`)) return prev.source;
  return `${CARRIED_FORWARD_SOURCE_PREFIX}:${prev.date.toISOString().slice(0, 10)}`;
}

// ---------------------------------------------------------------------------
// ECB XML Parsing
// ---------------------------------------------------------------------------

/**
 * Parse ECB daily XML feed into a Map of currency code -> rate (per 1 EUR).
 * Returns empty map on parse failure (never throws).
 */
export function parseEcbXml(xml: string): Map<string, number> {
  const rates = new Map<string, number>();

  // ECB uses both single and double quotes — match both variants
  const pattern = /currency=['"]([A-Z]{3})['"]\s+rate=['"]([\d.]+)['"]/g;

  for (const match of xml.matchAll(pattern)) {
    const code = match[1];
    const rateStr = match[2];
    if (!(code && rateStr)) continue;
    const rate = parseFloat(rateStr);
    if (!Number.isNaN(rate)) {
      rates.set(code, rate);
    }
  }

  return rates;
}

// ---------------------------------------------------------------------------
// Cross-Rate Derivation
// ---------------------------------------------------------------------------

/**
 * Derive AED/EUR rate from USD/EUR rate using the USD peg (3.6725 AED = 1 USD).
 * Returns null if USD rate is not available.
 */
export function deriveAedRate(usdPerEur: number | undefined): number | null {
  if (usdPerEur === undefined || usdPerEur <= 0) return null;
  return usdPerEur * AED_USD_PEG;
}

/**
 * Derive SAR/EUR rate from USD/EUR rate using the USD peg (3.75 SAR = 1 USD).
 * Returns null if USD rate is not available.
 */
export function deriveSarRate(usdPerEur: number | undefined): number | null {
  if (usdPerEur === undefined || usdPerEur <= 0) return null;
  return usdPerEur * SAR_USD_PEG;
}

// ---------------------------------------------------------------------------
// Fetch & Store
// ---------------------------------------------------------------------------

/**
 * Fetch rates from ECB, derive AED/SAR, and store in `ExchangeRate`.
 * On fetch failure, attempts to copy previous day's rates as fallback.
 *
 * Pass a **base** regional `PrismaClient` from `getRegionalClient(region)` (no tenant
 * extension): `ExchangeRate` has no `organizationId`, so it must not go through
 * `createTenantClientFrom`. Cron loops `SUPPORTED_REGIONS` and calls this per region.
 */
export async function fetchAndStoreRates(
  prisma: PrimaryPrismaClient,
  fetchFn: typeof fetch = fetch,
): Promise<{ stored: number; errors: string[] }> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const errors: string[] = [];

  let ecbRates: Map<string, number>;

  try {
    const response = await fetchFn(ECB_DAILY_URL);
    if (!response.ok) throw new Error(`ECB returned ${response.status}`);
    const xml = await response.text();
    ecbRates = parseEcbXml(xml);

    if (ecbRates.size === 0) {
      throw new Error('ECB XML parsed but no rates found');
    }
  } catch (err) {
    errors.push(`ECB fetch failed: ${err instanceof Error ? err.message : String(err)}`);

    // Fallback: copy previous day's rates
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const prevRates = await prisma.exchangeRate.findMany({
      where: { date: yesterday, base: 'EUR' },
    });

    if (prevRates.length > 0) {
      const stored = await Promise.all(
        prevRates.map(r =>
          prisma.exchangeRate.upsert({
            where: {
              date_base_target: {
                date: today,
                base: 'EUR',
                target: r.target,
              },
            },
            update: { rate: r.rate, source: carriedForwardSource(r) },
            create: {
              date: today,
              base: 'EUR',
              target: r.target,
              rate: r.rate,
              source: carriedForwardSource(r),
            },
          }),
        ),
      );
      errors.push(`Used ${stored.length} rates from previous day as fallback`);
      return { stored: stored.length, errors };
    }

    return { stored: 0, errors };
  }

  // Store ECB direct rates
  const upserts: Promise<unknown>[] = [];

  for (const [currency, rate] of ecbRates) {
    upserts.push(
      prisma.exchangeRate.upsert({
        where: {
          date_base_target: {
            date: today,
            base: 'EUR',
            target: currency,
          },
        },
        update: { rate, source: 'ECB' },
        create: {
          date: today,
          base: 'EUR',
          target: currency,
          rate,
          source: 'ECB',
        },
      }),
    );
  }

  // Derive AED and SAR from USD rate
  const usdRate = ecbRates.get('USD');
  const aedRate = deriveAedRate(usdRate);
  const sarRate = deriveSarRate(usdRate);

  if (aedRate === null) {
    errors.push('Could not derive AED rate — USD rate missing from ECB feed');
  } else {
    upserts.push(
      prisma.exchangeRate.upsert({
        where: {
          date_base_target: {
            date: today,
            base: 'EUR',
            target: 'AED',
          },
        },
        update: { rate: aedRate, source: 'DERIVED' },
        create: {
          date: today,
          base: 'EUR',
          target: 'AED',
          rate: aedRate,
          source: 'DERIVED',
        },
      }),
    );
  }

  if (sarRate === null) {
    errors.push('Could not derive SAR rate — USD rate missing from ECB feed');
  } else {
    upserts.push(
      prisma.exchangeRate.upsert({
        where: {
          date_base_target: {
            date: today,
            base: 'EUR',
            target: 'SAR',
          },
        },
        update: { rate: sarRate, source: 'DERIVED' },
        create: {
          date: today,
          base: 'EUR',
          target: 'SAR',
          rate: sarRate,
          source: 'DERIVED',
        },
      }),
    );
  }

  await Promise.all(upserts);
  return { stored: upserts.length, errors };
}

// ---------------------------------------------------------------------------
// Query
// ---------------------------------------------------------------------------

/**
 * Get exchange rate for a currency pair on a specific date.
 * Falls back to most recent available rate if exact date not found (weekends/holidays).
 *
 * When `maxAgeDays` is supplied, the resolved observation must be no older than
 * that many days relative to `date` — otherwise a {@link StaleExchangeRateError}
 * is thrown rather than silently returning a stale rate. Carried-forward rows
 * are measured from their ORIGINAL observation date (not the re-stamped row
 * date), so a multi-day ECB outage is caught even though a fresh row is written
 * each day. Omit `maxAgeDays` for display-only reads that tolerate any age.
 *
 * Pass **`ctx.db`** (regional tenant client) from tenant routes.
 */
export async function getRate(
  db: DbClient,
  base: string,
  target: string,
  date: Date,
  maxAgeDays?: number,
): Promise<{
  rate: number;
  date: Date;
  source: string;
} | null> {
  const direct = await db.exchangeRate.findFirst({
    where: { base, target, date: { lte: date } },
    orderBy: { date: 'desc' },
  });

  if (!direct) return null;

  if (maxAgeDays !== undefined) {
    const observedOn = observationDate(direct);
    const ageDays = rateAgeInDays(observedOn, date);
    if (ageDays > maxAgeDays) {
      throw new StaleExchangeRateError({
        base,
        target,
        rateDate: observedOn,
        requestedDate: date,
        ageDays,
        maxAgeDays,
      });
    }
  }

  return {
    rate: Number(direct.rate),
    date: direct.date,
    source: direct.source,
  };
}

// ---------------------------------------------------------------------------
// Conversion
// ---------------------------------------------------------------------------

/**
 * Convert an amount from one currency to another using stored rates.
 * All rates are stored relative to EUR, so non-EUR conversions go through EUR.
 * Returns the converted amount in minor units of the target currency.
 *
 * Pass **`ctx.db`** (regional tenant client) from tenant routes.
 */
export async function convertAmount(
  db: DbClient,
  amountMinor: number,
  fromCurrency: string,
  toCurrency: string,
  date?: Date,
  maxAgeDays?: number,
): Promise<{
  amountMinor: number;
  rate: number;
  rateDate: Date;
} | null> {
  if (fromCurrency === toCurrency) {
    return {
      amountMinor,
      rate: 1,
      rateDate: date ?? new Date(),
    };
  }

  const rateDate = date ?? new Date();

  // Convert through EUR as base. `maxAgeDays` (when set) makes each leg throw a
  // StaleExchangeRateError rather than convert at a stale rate.
  let fromToEur = 1; // If from is EUR, rate is 1
  if (fromCurrency !== 'EUR') {
    const fromRate = await getRate(db, 'EUR', fromCurrency, rateDate, maxAgeDays);
    if (!fromRate) return null;
    fromToEur = 1 / fromRate.rate; // Invert: EUR per 1 fromCurrency
  }

  let eurToTarget = 1; // If target is EUR, rate is 1
  if (toCurrency !== 'EUR') {
    const toRate = await getRate(db, 'EUR', toCurrency, rateDate, maxAgeDays);
    if (!toRate) return null;
    eurToTarget = toRate.rate; // EUR to target directly
  }

  // Money-rounding policy (see wiki/patterns/money-rounding): no decimal.js in this service,
  // so guard that the integer minor-unit amount and the FX rate factors are finite, then apply
  // exactly ONE HALF-UP round on the integer minor-unit product. Never let NaN/Infinity (from a
  // bad/zero stored rate) silently coerce a money value.
  if (
    !(Number.isFinite(amountMinor) && Number.isFinite(fromToEur) && Number.isFinite(eurToTarget))
  ) {
    return null;
  }
  const combinedRate = fromToEur * eurToTarget;
  const convertedAmount = Math.round(amountMinor * combinedRate);

  return {
    amountMinor: convertedAmount,
    rate: combinedRate,
    rateDate,
  };
}
