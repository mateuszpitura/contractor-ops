import { describe, expect, it } from 'vitest';

import {
  CARRIED_FORWARD_SOURCE_PREFIX,
  deriveAedRate,
  deriveSarRate,
  fetchAndStoreRates,
  getRate,
  parseEcbXml,
  roundHalfUpMinor,
  StaleExchangeRateError,
} from '../exchange-rate';

// Sample ECB XML fragment for testing
const SAMPLE_ECB_XML = `<?xml version="1.0" encoding="UTF-8"?>
<gesmes:Envelope xmlns:gesmes="http://www.gesmes.org/xml/2002-08-01"
  xmlns="http://www.ecb.int/vocabulary/2002-08-01/eurofxref">
  <gesmes:subject>Reference rates</gesmes:subject>
  <Cube>
    <Cube time="2026-04-11">
      <Cube currency="USD" rate="1.0836"/>
      <Cube currency="GBP" rate="0.85630"/>
      <Cube currency="PLN" rate="4.2815"/>
    </Cube>
  </Cube>
</gesmes:Envelope>`;

describe('parseEcbXml', () => {
  it('extracts USD, GBP, PLN rates from sample ECB XML', () => {
    const rates = parseEcbXml(SAMPLE_ECB_XML);
    expect(rates.get('USD')).toBeCloseTo(1.0836, 4);
    expect(rates.get('GBP')).toBeCloseTo(0.8563, 4);
    expect(rates.get('PLN')).toBeCloseTo(4.2815, 4);
    expect(rates.size).toBe(3);
  });

  it('returns empty map for malformed XML', () => {
    const rates = parseEcbXml('<invalid>not xml rates</invalid>');
    expect(rates.size).toBe(0);
  });

  it('returns empty map for empty string', () => {
    const rates = parseEcbXml('');
    expect(rates.size).toBe(0);
  });

  it('handles single-quote XML attributes', () => {
    const xml = `<Cube currency='EUR' rate='1.0000'/><Cube currency='CHF' rate='0.9321'/>`;
    const rates = parseEcbXml(xml);
    expect(rates.get('CHF')).toBeCloseTo(0.9321, 4);
  });
});

describe('deriveAedRate', () => {
  it('computes AED/EUR as USD/EUR * 3.6725', () => {
    const usdPerEur = 1.0836;
    const aedRate = deriveAedRate(usdPerEur);
    expect(aedRate).not.toBeNull();
    expect(aedRate).toBeCloseTo(usdPerEur * 3.6725, 4);
  });

  it('returns null when USD rate is undefined', () => {
    expect(deriveAedRate(undefined)).toBeNull();
  });

  it('returns null when USD rate is 0', () => {
    expect(deriveAedRate(0)).toBeNull();
  });

  it('returns null when USD rate is negative', () => {
    expect(deriveAedRate(-1)).toBeNull();
  });
});

describe('deriveSarRate', () => {
  it('computes SAR/EUR as USD/EUR * 3.75', () => {
    const usdPerEur = 1.0836;
    const sarRate = deriveSarRate(usdPerEur);
    expect(sarRate).not.toBeNull();
    expect(sarRate).toBeCloseTo(usdPerEur * 3.75, 4);
  });

  it('returns null when USD rate is undefined', () => {
    expect(deriveSarRate(undefined)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getRate — max-age floor (stale-rate detection)
// ---------------------------------------------------------------------------

/** Stub `exchangeRate.findFirst` returning a single row (or null). */
function makeRateDbStub(row: { rate: number; date: Date; source: string } | null) {
  return {
    exchangeRate: {
      findFirst: async () => row,
    },
  } as never;
}

describe('getRate — max-age floor', () => {
  it('returns the rate when no maxAgeDays floor is supplied (display-only path)', async () => {
    const db = makeRateDbStub({ rate: 1.08, date: new Date('2026-01-01'), source: 'ECB' });
    const result = await getRate(db, 'EUR', 'USD', new Date('2026-06-01'));
    expect(result).not.toBeNull();
    expect(result?.rate).toBe(1.08);
  });

  it('returns the rate when it is within the max-age floor', async () => {
    const db = makeRateDbStub({ rate: 1.08, date: new Date('2026-04-08'), source: 'ECB' });
    const result = await getRate(db, 'EUR', 'USD', new Date('2026-04-11'), 7);
    expect(result?.rate).toBe(1.08);
  });

  it('throws StaleExchangeRateError when the rate is older than the floor', async () => {
    const db = makeRateDbStub({ rate: 1.08, date: new Date('2026-04-01'), source: 'ECB' });
    await expect(getRate(db, 'EUR', 'USD', new Date('2026-04-11'), 7)).rejects.toBeInstanceOf(
      StaleExchangeRateError,
    );
  });

  it('measures a carried-forward row from its ORIGINAL date, not the re-stamped row date', async () => {
    // Row date is "fresh" (today), but the original observation is 10 days old.
    const db = makeRateDbStub({
      rate: 1.08,
      date: new Date('2026-04-11'),
      source: `${CARRIED_FORWARD_SOURCE_PREFIX}:2026-04-01`,
    });
    await expect(getRate(db, 'EUR', 'USD', new Date('2026-04-11'), 7)).rejects.toBeInstanceOf(
      StaleExchangeRateError,
    );
  });

  it('returns null (not throw) when no rate exists at all, even with a floor', async () => {
    const db = makeRateDbStub(null);
    const result = await getRate(db, 'EUR', 'USD', new Date('2026-04-11'), 7);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// fetchAndStoreRates — carry-forward provenance
// ---------------------------------------------------------------------------

describe('fetchAndStoreRates — carry-forward provenance', () => {
  /** A fetch that always fails, forcing the previous-day fallback. */
  const failingFetch = (async () => ({
    ok: false,
    status: 503,
    text: async () => '',
  })) as unknown as typeof fetch;

  function makeFallbackDb(
    prevRows: Array<{ target: string; rate: number; source: string; date: Date }>,
  ) {
    const upsertArgs: Array<{ create: { source: string }; update: { source: string } }> = [];
    const db = {
      exchangeRate: {
        findMany: async () => prevRows,
        upsert: async (args: { create: { source: string }; update: { source: string } }) => {
          upsertArgs.push(args);
          return {};
        },
      },
    } as never;
    return { db, upsertArgs };
  }

  it('stamps carried-forward rows with the CARRIED_FORWARD source + original ECB date', async () => {
    const { db, upsertArgs } = makeFallbackDb([
      { target: 'USD', rate: 1.08, source: 'ECB', date: new Date('2026-04-10') },
    ]);
    const result = await fetchAndStoreRates(db, failingFetch);

    expect(result.stored).toBe(1);
    expect(upsertArgs).toHaveLength(1);
    expect(upsertArgs[0]?.create.source).toBe(`${CARRIED_FORWARD_SOURCE_PREFIX}:2026-04-10`);
    expect(upsertArgs[0]?.update.source).toBe(`${CARRIED_FORWARD_SOURCE_PREFIX}:2026-04-10`);
  });

  it('preserves the ORIGINAL date across a multi-day outage (does not re-wrap)', async () => {
    const { db, upsertArgs } = makeFallbackDb([
      {
        target: 'USD',
        rate: 1.08,
        source: `${CARRIED_FORWARD_SOURCE_PREFIX}:2026-04-01`,
        date: new Date('2026-04-10'),
      },
    ]);
    await fetchAndStoreRates(db, failingFetch);
    expect(upsertArgs[0]?.create.source).toBe(`${CARRIED_FORWARD_SOURCE_PREFIX}:2026-04-01`);
  });
});

describe('roundHalfUpMinor', () => {
  it('rounds negative amounts away from zero (HALF-UP)', () => {
    expect(roundHalfUpMinor(-2.5)).toBe(-3);
    expect(roundHalfUpMinor(-2.4)).toBe(-2);
    expect(roundHalfUpMinor(2.5)).toBe(3);
  });
});
