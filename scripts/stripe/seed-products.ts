#!/usr/bin/env tsx
/**
 * Idempotent Stripe products + prices upsert driven by products.seed.json.
 *
 *   pnpm tsx scripts/stripe/seed-products.ts          # test mode (sk_test_*)
 *   pnpm tsx scripts/stripe/seed-products.ts --live   # live mode, requires CONFIRM=YES
 *
 * Stripe has no native upsert. The script:
 *   1. Finds existing products by metadata `lookup_key` (search API).
 *   2. Lists prices per product; matches by Stripe price `lookup_key`.
 *   3. Creates missing products + prices; deactivates stale prices when the
 *      seeded amount changes (Stripe prices are immutable).
 *   4. Refuses to delete; only deactivates so the audit trail stays intact.
 */
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pino from 'pino';
import Stripe from 'stripe';

const log = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: { level: label => ({ level: label }) },
  base: { service: 'stripe-seed-products' },
});

const MARKETS = ['PL', 'DE', 'INTL', 'UK', 'UAE', 'SA'] as const;
const TIERS = ['STARTER', 'PRO', 'ENTERPRISE'] as const;
type Market = (typeof MARKETS)[number];
type Tier = (typeof TIERS)[number];

interface SeedProduct {
  lookupKey: string;
  name: string;
  description: string;
  metadata: Record<string, string>;
  monthly: number;
  annual: number;
}

interface SeedFile {
  currencyByMarket: Record<Market, string>;
  products: SeedProduct[];
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED_PATH = resolve(__dirname, 'products.seed.json');

async function loadSeed(): Promise<SeedFile> {
  const raw = await readFile(SEED_PATH, 'utf-8');
  const parsed = JSON.parse(raw) as SeedFile;
  for (const product of parsed.products) {
    const market = product.metadata.market as Market;
    const tier = product.metadata.tier as Tier;
    if (!MARKETS.includes(market)) {
      throw new Error(`${product.lookupKey}: invalid market "${market}"`);
    }
    if (!TIERS.includes(tier)) {
      throw new Error(`${product.lookupKey}: invalid tier "${tier}"`);
    }
    if (!parsed.currencyByMarket[market]) {
      throw new Error(`${product.lookupKey}: no currency defined for market ${market}`);
    }
  }
  return parsed;
}

async function upsertProduct(stripe: Stripe, seed: SeedProduct, currency: string): Promise<void> {
  const monthlyLookupKey = `${seed.lookupKey}-monthly`;
  const annualLookupKey = `${seed.lookupKey}-annual`;

  const existing = await stripe.products.search({
    query: `metadata['lookup_key']:'${seed.lookupKey}'`,
  });

  let product = existing.data[0];
  if (product) {
    log.info({ productId: product.id, lookupKey: seed.lookupKey }, 'updating product');
    product = await stripe.products.update(product.id, {
      name: seed.name,
      description: seed.description,
      metadata: { ...seed.metadata, lookup_key: seed.lookupKey },
      active: true,
    });
  } else {
    log.info({ lookupKey: seed.lookupKey }, 'creating product');
    product = await stripe.products.create({
      name: seed.name,
      description: seed.description,
      metadata: { ...seed.metadata, lookup_key: seed.lookupKey },
    });
  }

  for (const [periodKey, amount, interval, lookupKey] of [
    ['monthly', seed.monthly, 'month' as const, monthlyLookupKey],
    ['annual', seed.annual, 'year' as const, annualLookupKey],
  ] as const) {
    const existingPrices = await stripe.prices.list({
      product: product.id,
      lookup_keys: [lookupKey],
      active: true,
      limit: 5,
    });

    const matching = existingPrices.data.find(
      p =>
        p.unit_amount === amount && p.currency === currency && p.recurring?.interval === interval,
    );

    if (matching) {
      log.info({ priceId: matching.id, periodKey }, 'price up to date');
      continue;
    }

    for (const stale of existingPrices.data) {
      log.info({ priceId: stale.id, periodKey }, 'deactivating stale price');
      await stripe.prices.update(stale.id, { active: false, lookup_key: null });
    }

    const created = await stripe.prices.create({
      product: product.id,
      unit_amount: amount,
      currency,
      recurring: { interval },
      lookup_key: lookupKey,
      transfer_lookup_key: true,
      nickname: `${seed.lookupKey} ${periodKey}`,
    });
    log.info({ priceId: created.id, periodKey, amount, currency }, 'price created');
  }
}

async function main(): Promise<void> {
  const live = process.argv.includes('--live');
  const key = live
    ? process.env.STRIPE_SECRET_KEY
    : (process.env.STRIPE_SECRET_KEY_TEST ?? process.env.STRIPE_SECRET_KEY);

  if (!key) {
    throw new Error(
      live
        ? 'STRIPE_SECRET_KEY missing (live mode)'
        : 'STRIPE_SECRET_KEY_TEST or STRIPE_SECRET_KEY missing',
    );
  }

  if (live && process.env.CONFIRM !== 'YES') {
    throw new Error(
      'Refusing to seed against the live Stripe key without CONFIRM=YES. ' +
        'Re-run with CONFIRM=YES if you really mean to mutate live products.',
    );
  }

  const stripe = new Stripe(key, { apiVersion: '2026-04-22.dahlia' });
  const seed = await loadSeed();

  log.info({ count: seed.products.length, live }, 'starting seed');
  for (const product of seed.products) {
    const currency = seed.currencyByMarket[product.metadata.market as Market];
    await upsertProduct(stripe, product, currency!);
  }
  log.info({}, 'seed complete');
}

main().catch(err => {
  log.error({ err }, 'seed failed');
  process.exitCode = 1;
});
