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

function normalizeSellerName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Computes a duplicate-check hash for invoice creation/update when sellerTaxId
 * is missing. Falls back to sellerName as the seller identifier.
 *
 * Returns null when the input does not provide enough information to form a
 * stable key.
 */
export function computeDuplicateCheckHashForInvoice(input: {
  invoiceNumber: string | null | undefined;
  sellerTaxId: string | null | undefined;
  sellerName: string | null | undefined;
  totalMinor: number;
}): string | null {
  const invoiceNumber = input.invoiceNumber?.trim();
  if (!invoiceNumber) return null;

  const sellerKey = input.sellerTaxId?.trim()
    ? `tax:${input.sellerTaxId.trim()}`
    : input.sellerName?.trim()
      ? `name:${normalizeSellerName(input.sellerName)}`
      : null;
  if (!sellerKey) return null;

  return createHash('sha256')
    .update(`${invoiceNumber.toLowerCase()}|${sellerKey}|${input.totalMinor}`)
    .digest('hex');
}

// ---------------------------------------------------------------------------
// Internal pipeline types
// ---------------------------------------------------------------------------

interface MatchState {
  flags: string[];
  score: number;
  matchedContractorId: string | null;
  matchedContractId: string | null;
  expectedAmountMinor: number | null;
  amountDeltaMinor: number | null;
  amountDeltaPercent: number | null;
  duplicateInvoiceId: string | null;
}

type InvoiceInput = {
  id?: string;
  sellerTaxId: string | null;
  totalMinor: number;
  currency: string;
  duplicateCheckHash: string | null;
  issueDate?: Date | null;
  servicePeriodStart?: Date | null;
  servicePeriodEnd?: Date | null;
};

// ---------------------------------------------------------------------------
// Pipeline step helpers
// ---------------------------------------------------------------------------

const UNMATCHED_RESULT: MatchResult = {
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

/**
 * Selects the contract whose rate is closest to the invoice total.
 * Falls back to the first contract if none have rates.
 */
function pickBestContract<T extends { rateValueMinor: number | null }>(
  contracts: T[],
  invoiceTotalMinor: number,
): T | null {
  let bestContract: T | null = null;
  let bestDelta = Infinity;

  for (const contract of contracts) {
    const rateMinor = contract.rateValueMinor ?? 0;
    if (rateMinor > 0) {
      const delta = Math.abs(invoiceTotalMinor - rateMinor);
      if (delta < bestDelta) {
        bestDelta = delta;
        bestContract = contract;
      }
    } else if (!bestContract) {
      bestContract = contract;
    }
  }

  return bestContract ?? contracts[0] ?? null;
}

/**
 * Calculates amount deviation between invoice total and expected contract rate.
 * Returns updated score increment and deviation values.
 */
function computeDeviation(
  invoiceTotalMinor: number,
  expectedAmount: number | null,
  thresholdPercent: number,
): {
  scoreIncrement: number;
  expectedAmountMinor: number | null;
  deltaMinor: number | null;
  deltaPercent: number | null;
} {
  if (!expectedAmount || expectedAmount <= 0) {
    return { scoreIncrement: 0, expectedAmountMinor: null, deltaMinor: null, deltaPercent: null };
  }

  const deltaMinor = invoiceTotalMinor - expectedAmount;
  const deltaPercent = (deltaMinor / expectedAmount) * 100;
  const scoreIncrement = Math.abs(deltaPercent) <= thresholdPercent ? 20 : 0;

  return { scoreIncrement, expectedAmountMinor: expectedAmount, deltaMinor, deltaPercent };
}

/**
 * Checks for time-based reconciliation deviation on hourly/daily contracts.
 */
async function checkTimeDeviation(
  db: DbClient,
  organizationId: string,
  contract: { id: string; rateType: string },
  invoice: InvoiceInput,
): Promise<boolean> {
  if (contract.rateType !== 'PER_HOUR' && contract.rateType !== 'PER_DAY') {
    return false;
  }

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
    contract.id,
    periodStart,
    periodEnd,
    invoice.totalMinor,
  );

  return timeRecon != null && !timeRecon.withinThreshold;
}

/**
 * Checks for a duplicate invoice by hash, excluding the current invoice.
 */
async function findDuplicateInvoice(
  db: DbClient,
  organizationId: string,
  duplicateCheckHash: string | null,
  excludeId?: string,
): Promise<string | null> {
  if (!duplicateCheckHash) return null;

  const duplicateWhere: Record<string, unknown> = {
    duplicateCheckHash,
    organizationId,
  };
  if (excludeId) {
    duplicateWhere.id = { not: excludeId };
  }

  const duplicate = await db.invoice.findFirst({
    where: duplicateWhere,
    select: { id: true },
  });

  return duplicate?.id ?? null;
}

/**
 * Derives the final match status from the accumulated score and deviation.
 */
function deriveMatchStatus(
  score: number,
  amountDeltaPercent: number | null,
  thresholdPercent: number,
): MatchResult['matchStatus'] {
  if (amountDeltaPercent !== null && Math.abs(amountDeltaPercent) > thresholdPercent) {
    return 'DISCREPANCY';
  }
  if (score >= 80) return 'MATCHED';
  if (score >= 50) return 'PARTIAL';
  return 'UNMATCHED';
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
  invoice: InvoiceInput,
  deviationThresholdPercent = 10,
): Promise<MatchResult> {
  // Step 1: Match contractor by NIP
  if (!invoice.sellerTaxId) return UNMATCHED_RESULT;

  const contractor = await db.contractor.findFirst({
    where: { taxId: invoice.sellerTaxId, organizationId, deletedAt: null },
  });
  if (!contractor) return UNMATCHED_RESULT;

  const state: MatchState = {
    flags: [],
    score: 50, // Exact NIP match: +50 points
    matchedContractorId: contractor.id,
    matchedContractId: null,
    expectedAmountMinor: null,
    amountDeltaMinor: null,
    amountDeltaPercent: null,
    duplicateInvoiceId: null,
  };

  // Step 2: Find active contracts
  const contracts = await db.contract.findMany({
    where: {
      contractorId: contractor.id,
      organizationId,
      status: { in: ['ACTIVE', 'EXPIRING'] },
      deletedAt: null,
    },
  });

  if (contracts.length === 0) {
    state.flags.push('NO_ACTIVE_CONTRACT');
    const expired = await db.contract.findFirst({
      where: { contractorId: contractor.id, organizationId, status: 'EXPIRED', deletedAt: null },
    });
    if (expired) state.flags.push('EXPIRED_CONTRACT');
  }

  // Step 3: Pick best contract and score
  if (contracts.length > 0) {
    state.score += 30; // Has active contract: +30 points
    const bestContract = pickBestContract(contracts, invoice.totalMinor);

    if (bestContract) {
      state.matchedContractId = bestContract.id;

      // Step 4: Deviation calculation
      const deviation = computeDeviation(
        invoice.totalMinor,
        bestContract.rateValueMinor,
        deviationThresholdPercent,
      );
      state.score += deviation.scoreIncrement;
      state.expectedAmountMinor = deviation.expectedAmountMinor;
      state.amountDeltaMinor = deviation.deltaMinor;
      state.amountDeltaPercent = deviation.deltaPercent;

      // Step 5: Flag generation
      if (bestContract.currency !== invoice.currency) {
        state.flags.push('CURRENCY_MISMATCH');
      }

      const hasTimeDeviation = await checkTimeDeviation(db, organizationId, bestContract, invoice);
      if (hasTimeDeviation) state.flags.push('TIME_DEVIATION');
    }
  }

  // Step 6: Duplicate check
  const dupId = await findDuplicateInvoice(
    db,
    organizationId,
    invoice.duplicateCheckHash,
    invoice.id,
  );
  if (dupId) {
    state.flags.push('DUPLICATE_SUSPECTED');
    state.duplicateInvoiceId = dupId;
  }

  return {
    matchStatus: deriveMatchStatus(
      state.score,
      state.amountDeltaPercent,
      deviationThresholdPercent,
    ),
    contractorId: state.matchedContractorId,
    contractId: state.matchedContractId,
    score: state.score,
    expectedAmountMinor: state.expectedAmountMinor,
    amountDeltaMinor: state.amountDeltaMinor,
    amountDeltaPercent: state.amountDeltaPercent,
    flags: state.flags,
    duplicateInvoiceId: state.duplicateInvoiceId,
  };
}
