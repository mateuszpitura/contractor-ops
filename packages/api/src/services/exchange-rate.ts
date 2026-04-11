/**
 * Exchange rate service — ECB daily rate fetching, cross-rate derivation, and conversion.
 *
 * Per D-05: ECB is the primary source. AED (3.6725 USD peg) and SAR (3.75 USD peg)
 * are derived via USD cross-rates.
 * Per D-06: ExchangeRate table with QStash daily cron.
 */

import type { PrismaClient } from "@contractor-ops/db";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ECB_DAILY_URL =
  "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";

/** AED is pegged to USD at 3.6725 AED per 1 USD. */
const AED_USD_PEG = 3.6725;

/** SAR is pegged to USD at 3.75 SAR per 1 USD. */
const SAR_USD_PEG = 3.75;

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
  const pattern =
    /currency=['"]([A-Z]{3})['"]\s+rate=['"]([\d.]+)['"]/g;

  for (const match of xml.matchAll(pattern)) {
    const code = match[1];
    const rate = parseFloat(match[2]);
    if (code && !isNaN(rate)) {
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
export function deriveAedRate(
  usdPerEur: number | undefined,
): number | null {
  if (usdPerEur === undefined || usdPerEur <= 0) return null;
  return usdPerEur * AED_USD_PEG;
}

/**
 * Derive SAR/EUR rate from USD/EUR rate using the USD peg (3.75 SAR = 1 USD).
 * Returns null if USD rate is not available.
 */
export function deriveSarRate(
  usdPerEur: number | undefined,
): number | null {
  if (usdPerEur === undefined || usdPerEur <= 0) return null;
  return usdPerEur * SAR_USD_PEG;
}

// ---------------------------------------------------------------------------
// Fetch & Store
// ---------------------------------------------------------------------------

/**
 * Fetch rates from ECB, derive AED/SAR, and store in ExchangeRate table.
 * On fetch failure, attempts to copy previous day's rates as fallback.
 */
export async function fetchAndStoreRates(
  prisma: PrismaClient,
  fetchFn: typeof fetch = fetch,
): Promise<{ stored: number; errors: string[] }> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const errors: string[] = [];

  let ecbRates: Map<string, number>;

  try {
    const response = await fetchFn(ECB_DAILY_URL);
    if (!response.ok)
      throw new Error(`ECB returned ${response.status}`);
    const xml = await response.text();
    ecbRates = parseEcbXml(xml);

    if (ecbRates.size === 0) {
      throw new Error("ECB XML parsed but no rates found");
    }
  } catch (err) {
    errors.push(
      `ECB fetch failed: ${err instanceof Error ? err.message : String(err)}`,
    );

    // Fallback: copy previous day's rates
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const prevRates = await prisma.exchangeRate.findMany({
      where: { date: yesterday, base: "EUR" },
    });

    if (prevRates.length > 0) {
      const stored = await Promise.all(
        prevRates.map((r) =>
          prisma.exchangeRate.upsert({
            where: {
              date_base_target: {
                date: today,
                base: "EUR",
                target: r.target,
              },
            },
            update: { rate: r.rate, source: r.source },
            create: {
              date: today,
              base: "EUR",
              target: r.target,
              rate: r.rate,
              source: r.source,
            },
          }),
        ),
      );
      errors.push(
        `Used ${stored.length} rates from previous day as fallback`,
      );
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
            base: "EUR",
            target: currency,
          },
        },
        update: { rate, source: "ECB" },
        create: {
          date: today,
          base: "EUR",
          target: currency,
          rate,
          source: "ECB",
        },
      }),
    );
  }

  // Derive AED and SAR from USD rate
  const usdRate = ecbRates.get("USD");
  const aedRate = deriveAedRate(usdRate);
  const sarRate = deriveSarRate(usdRate);

  if (aedRate !== null) {
    upserts.push(
      prisma.exchangeRate.upsert({
        where: {
          date_base_target: {
            date: today,
            base: "EUR",
            target: "AED",
          },
        },
        update: { rate: aedRate, source: "DERIVED" },
        create: {
          date: today,
          base: "EUR",
          target: "AED",
          rate: aedRate,
          source: "DERIVED",
        },
      }),
    );
  } else {
    errors.push(
      "Could not derive AED rate — USD rate missing from ECB feed",
    );
  }

  if (sarRate !== null) {
    upserts.push(
      prisma.exchangeRate.upsert({
        where: {
          date_base_target: {
            date: today,
            base: "EUR",
            target: "SAR",
          },
        },
        update: { rate: sarRate, source: "DERIVED" },
        create: {
          date: today,
          base: "EUR",
          target: "SAR",
          rate: sarRate,
          source: "DERIVED",
        },
      }),
    );
  } else {
    errors.push(
      "Could not derive SAR rate — USD rate missing from ECB feed",
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
 */
export async function getRate(
  prisma: PrismaClient,
  base: string,
  target: string,
  date: Date,
): Promise<{
  rate: number;
  date: Date;
  source: string;
} | null> {
  const direct = await prisma.exchangeRate.findFirst({
    where: { base, target, date: { lte: date } },
    orderBy: { date: "desc" },
  });

  if (!direct) return null;
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
 */
export async function convertAmount(
  prisma: PrismaClient,
  amountMinor: number,
  fromCurrency: string,
  toCurrency: string,
  date?: Date,
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

  // Convert through EUR as base
  let fromToEur = 1; // If from is EUR, rate is 1
  if (fromCurrency !== "EUR") {
    const fromRate = await getRate(prisma, "EUR", fromCurrency, rateDate);
    if (!fromRate) return null;
    fromToEur = 1 / fromRate.rate; // Invert: EUR per 1 fromCurrency
  }

  let eurToTarget = 1; // If target is EUR, rate is 1
  if (toCurrency !== "EUR") {
    const toRate = await getRate(prisma, "EUR", toCurrency, rateDate);
    if (!toRate) return null;
    eurToTarget = toRate.rate; // EUR to target directly
  }

  const combinedRate = fromToEur * eurToTarget;
  const convertedAmount = Math.round(amountMinor * combinedRate);

  return {
    amountMinor: convertedAmount,
    rate: combinedRate,
    rateDate,
  };
}
