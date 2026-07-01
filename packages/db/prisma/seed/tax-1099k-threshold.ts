import type { PrismaClient } from '../../src/generated/prisma/client/client.js';

// 1099-K informational reporting threshold, keyed by tax year (USD minor units).
//
// NEVER a constant: OBBBA reverted the ARPA $600 threshold back to the pre-ARPA
// $20,000 gross + 200 transactions. The stale $5,000 / $600 figures from the
// backlog are WRONG. This tracker is informational only — the platform is not the
// TPSO / settlement entity and never files a 1099-K.
//
// PROVISIONAL — needs jurisdiction-specific legal/tax-adviser verification before
// any production reliance (LOCAL-ONLY posture). Re-verify each tax-year figure
// against the current IRS 1099-K guidance (FS-2025-08 / Instructions for Form 1099-K).
const ADVISER_VERIFY_NOTE =
  'PROVISIONAL — verify with a US tax adviser before production reliance; re-confirm per tax year.';

const thresholds = [
  {
    taxYear: 2026,
    amountThresholdMinor: 2_000_000,
    transactionCountThreshold: 200,
    currency: 'USD',
    note: `$20,000 gross + 200 transactions (OBBBA reverted ARPA $600). ${ADVISER_VERIFY_NOTE}`,
  },
];

export async function seedTax1099KThreshold(prisma: PrismaClient): Promise<void> {
  for (const threshold of thresholds) {
    await prisma.tax1099KThreshold.upsert({
      where: { taxYear: threshold.taxYear },
      update: { ...threshold },
      create: { ...threshold },
    });
  }
}
