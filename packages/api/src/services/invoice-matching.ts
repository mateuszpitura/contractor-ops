import { createHash } from 'node:crypto';
import { computeTimeReconciliation } from './time-reconciliation.js';
import type { DbClient } from './types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MatchResult {
  matchStatus: 'UNMATCHED' | 'PARTIAL' | 'MATCHED' | 'DISCREPANCY';
  contractorId: string | null;
  contractId: string | null;
  score: number;
  expectedAmountMinor: number | null;
  amountDeltaMinor: number | null;
  amountDeltaPercent: number | null;
  flags: string[];
  duplicateInvoiceId: string | null;
}

// ---------------------------------------------------------------------------
// Duplicate check hash
// ---------------------------------------------------------------------------

/**
 * Computes a deterministic SHA-256 hash for duplicate invoice detection.
 * Based on normalized invoice number + seller tax ID + total amount.
 */
export function computeDuplicateCheckHash(
  invoiceNumber: string,
  sellerTaxId: string,
  totalMinor: number,
): string {
  return createHash('sha256')
    .update(`${invoiceNumber.trim().toLowerCase()}|${sellerTaxId.trim()}|${totalMinor}`)
    .digest('hex');
}

// ---------------------------------------------------------------------------
// Auto-matching engine
// ---------------------------------------------------------------------------

/**
 * Runs the automatic invoice matching pipeline:
 * 1. NIP-based contractor lookup
 * 2. Active contract discovery
 * 3. Score calculation (NIP match + contract + amount proximity)
 * 4. Deviation calculation (amount delta vs expected)
 * 5. Flag generation (no contract, expired, currency mismatch)
 * 6. Duplicate check
 */
export async function runAutoMatch(
  db: DbClient,
  organizationId: string,
  invoice: {
    id?: string;
    sellerTaxId: string | null;
    totalMinor: number;
    currency: string;
    duplicateCheckHash: string | null;
    issueDate?: Date | null;
    servicePeriodStart?: Date | null;
    servicePeriodEnd?: Date | null;
  },
  deviationThresholdPercent = 10,
): Promise<MatchResult> {
  const flags: string[] = [];
  let score = 0;
  let matchedContractorId: string | null = null;
  let matchedContractId: string | null = null;
  let expectedAmountMinor: number | null = null;
  let amountDeltaMinor: number | null = null;
  let amountDeltaPercent: number | null = null;
  let duplicateInvoiceId: string | null = null;

  // -------------------------------------------------------------------------
  // Step 1: Match contractor by NIP
  // -------------------------------------------------------------------------

  if (!invoice.sellerTaxId) {
    return {
      matchStatus: 'UNMATCHED',
      contractorId: null,
      contractId: null,
      score: 0,
      expectedAmountMinor: null,
      amountDeltaMinor: null,
      amountDeltaPercent: null,
      flags: [],
      duplicateInvoiceId: null,
    };
  }

  const contractor = await db.contractor.findFirst({
    where: {
      taxId: invoice.sellerTaxId,
      organizationId,
      deletedAt: null,
    },
  });

  if (!contractor) {
    return {
      matchStatus: 'UNMATCHED',
      contractorId: null,
      contractId: null,
      score: 0,
      expectedAmountMinor: null,
      amountDeltaMinor: null,
      amountDeltaPercent: null,
      flags: [],
      duplicateInvoiceId: null,
    };
  }

  // Exact NIP match: +50 points
  matchedContractorId = contractor.id;
  score += 50;

  // -------------------------------------------------------------------------
  // Step 2: Find active contracts
  // -------------------------------------------------------------------------

  const contracts = await db.contract.findMany({
    where: {
      contractorId: contractor.id,
      organizationId,
      status: { in: ['ACTIVE', 'EXPIRING'] },
      deletedAt: null,
    },
  });

  if (contracts.length === 0) {
    flags.push('NO_ACTIVE_CONTRACT');

    // Check for expired contracts as a hint
    const expiredContract = await db.contract.findFirst({
      where: {
        contractorId: contractor.id,
        organizationId,
        status: 'EXPIRED',
        deletedAt: null,
      },
    });

    if (expiredContract) {
      flags.push('EXPIRED_CONTRACT');
    }
  }

  // -------------------------------------------------------------------------
  // Step 3: Score calculation — pick best contract
  // -------------------------------------------------------------------------

  let bestContract: (typeof contracts)[number] | null = null;
  let bestDelta = Infinity;

  if (contracts.length > 0) {
    // Has active contract: +30 points
    score += 30;

    for (const contract of contracts) {
      const rateMinor = contract.rateValueMinor ?? 0;
      if (rateMinor > 0) {
        const delta = Math.abs(invoice.totalMinor - rateMinor);
        if (delta < bestDelta) {
          bestDelta = delta;
          bestContract = contract;
        }
      } else if (!bestContract) {
        // Use contract even without rate if it's the only option
        bestContract = contract;
      }
    }

    // If no contract has a rate, just use the first one
    if (!bestContract && contracts.length > 0) {
      bestContract = contracts[0] ?? null;
    }
  }

  if (bestContract) {
    matchedContractId = bestContract.id;

    // -----------------------------------------------------------------------
    // Step 4: Deviation calculation
    // -----------------------------------------------------------------------

    const expectedAmount = bestContract.rateValueMinor;
    if (expectedAmount && expectedAmount > 0) {
      expectedAmountMinor = expectedAmount;
      amountDeltaMinor = invoice.totalMinor - expectedAmount;
      amountDeltaPercent = (amountDeltaMinor / expectedAmount) * 100;

      // Amount within threshold: +20 points
      if (Math.abs(amountDeltaPercent) <= deviationThresholdPercent) {
        score += 20;
      }
    }

    // -----------------------------------------------------------------------
    // Step 5: Flag generation
    // -----------------------------------------------------------------------

    if (bestContract.currency !== invoice.currency) {
      flags.push('CURRENCY_MISMATCH');
    }

    // Time-based reconciliation (Phase 18 - D-13)
    // Warning only: does NOT change matchStatus or block approval (D-15)
    if (bestContract.rateType === 'PER_HOUR' || bestContract.rateType === 'PER_DAY') {
      const anchor = invoice.servicePeriodStart ?? invoice.issueDate ?? new Date();
      const periodStart =
        invoice.servicePeriodStart ??
        new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
      const periodEnd =
        invoice.servicePeriodEnd ??
        new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0));

      const timeRecon = await computeTimeReconciliation(
        db,
        organizationId,
        bestContract.id,
        periodStart,
        periodEnd,
        invoice.totalMinor,
      );

      if (timeRecon && !timeRecon.withinThreshold) {
        flags.push('TIME_DEVIATION');
      }
    }
  }

  // -------------------------------------------------------------------------
  // Step 6: Duplicate check
  // -------------------------------------------------------------------------

  if (invoice.duplicateCheckHash) {
    const duplicateWhere: Record<string, unknown> = {
      duplicateCheckHash: invoice.duplicateCheckHash,
      organizationId,
    };

    if (invoice.id) {
      duplicateWhere.id = { not: invoice.id };
    }

    const duplicate = await db.invoice.findFirst({
      where: duplicateWhere,
      select: { id: true },
    });

    if (duplicate) {
      flags.push('DUPLICATE_SUSPECTED');
      duplicateInvoiceId = duplicate.id;
    }
  }

  // -------------------------------------------------------------------------
  // Determine match status from score
  // -------------------------------------------------------------------------

  let matchStatus: MatchResult['matchStatus'];

  // Check deviation override first
  if (amountDeltaPercent !== null && Math.abs(amountDeltaPercent) > deviationThresholdPercent) {
    matchStatus = 'DISCREPANCY';
  } else if (score >= 80) {
    matchStatus = 'MATCHED';
  } else if (score >= 50) {
    matchStatus = 'PARTIAL';
  } else {
    matchStatus = 'UNMATCHED';
  }

  return {
    matchStatus,
    contractorId: matchedContractorId,
    contractId: matchedContractId,
    score,
    expectedAmountMinor,
    amountDeltaMinor,
    amountDeltaPercent,
    flags,
    duplicateInvoiceId,
  };
}
