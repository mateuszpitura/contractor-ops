import type { PayoutInitiationAdapter, PayoutOrderStatus } from '@contractor-ops/integrations';
import { createLogger } from '@contractor-ops/logger';
import { orgBankInfoSchema } from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import * as E from '../../errors';
import {
  clear as clearIdempotency,
  complete as completeIdempotency,
  reserve as reserveIdempotency,
} from '../../lib/idempotency';
import { writeAuditLog } from '../../services/audit-writer';
import { decryptBankAccount } from '../../services/bank-account-crypto';
import { assertContractorPaymentEligibility } from '../../services/compliance-payment-gate';
import { StaleExchangeRateError } from '../../services/exchange-rate';
import type {
  ExportItem,
  NachaExportItem,
  NachaOrgBankInfo,
  OrgBankInfo,
} from '../../services/payment-export';
import {
  generateCsv,
  generateElixir,
  generateFedwirePacs008,
  generateNachaFile,
  generateSepaXml,
  generateSwiftXml,
  resolveTransferTitle,
} from '../../services/payment-export';
import type { ExportFormat } from '../../services/payment-format-detection';
import { groupItemsByFormat } from '../../services/payment-format-detection';
import { convertForSettlement, resolveSettlementCurrency } from '../../services/payment-settlement';
import { calculateWht } from '../../services/tax-rate.service';
import { enqueueWebhookEvent } from '../../services/webhooks/enqueue';
import { applyTreaty } from '../../services/treaty-rate.service';
import type { DbClient } from '../../services/types';

export const log = createLogger({ service: 'payment-router' });

/** Transaction client derived from the tenant-scoped DbClient. */
export type TxClient = Parameters<Parameters<DbClient['$transaction']>[0]>[0];

// ---------------------------------------------------------------------------
// Idempotency key cache for payment run creation (24-hour window)
// Payment runs persist much longer than a few minutes, so the cache TTL
// must cover the realistic window in which duplicate requests may arrive.
//
// Backed by Upstash Redis (see packages/api/src/lib/idempotency.ts) so the
// reservation is shared across all Render instances. The previous in-memory
// Map was process-local — a duplicate retry hitting a different pod could
// create a second payment run, leading to real-money double-spend.
// ---------------------------------------------------------------------------

export const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;

/**
 * Shape of an invoice loaded for payment-run creation. Captured as a type
 * alias so helpers can express intent without re-deriving the Prisma include
 * payload at every signature.
 */
export type EligibleInvoice = Awaited<ReturnType<TxClient['invoice']['findMany']>>[number] & {
  billingProfile: { id: string; preferredCurrency: string } | null;
};

/**
 * Fetches all invoices in the given id list scoped to the organization,
 * pulling the minimum data needed for downstream validation + item seeding.
 */
export async function loadEligibleInvoices(
  tx: TxClient,
  organizationId: string,
  invoiceIds: readonly string[],
): Promise<EligibleInvoice[]> {
  return (await tx.invoice.findMany({
    where: {
      id: { in: [...invoiceIds] },
      organizationId,
      deletedAt: null,
    },
    include: {
      billingProfile: { select: { id: true, preferredCurrency: true } },
    },
  })) as EligibleInvoice[];
}

/**
 * Validates that the loaded invoices are usable for a new payment run.
 * Throws TRPCError on any failure; returns void on success.
 *
 * Checks (in this order, matching the original inline flow):
 *   1. Every invoice must have `paymentStatus === 'READY'`.
 *   2. Every requested id must be present (no missing/cross-tenant rows).
 */
export function validateInvoicesForRun(
  invoices: EligibleInvoice[],
  requestedIds: readonly string[],
): void {
  if (invoices.some(inv => inv.paymentStatus !== 'READY')) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: E.PAYMENT_INVOICES_NOT_READY,
    });
  }

  if (invoices.length !== requestedIds.length) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: E.PAYMENT_INVOICES_NOT_FOUND,
    });
  }
}

/**
 * Partitions invoices into per-currency groups when `groupByCurrency` is set,
 * otherwise returns a single group keyed on the explicit currency override
 * (falling back to the invoices' shared currency). Throws BAD_REQUEST when
 * invoices span multiple currencies and grouping is disabled.
 */
export function groupInvoicesByCurrency(
  invoices: EligibleInvoice[],
  options: { groupByCurrency: boolean; currencyOverride?: string },
): Map<string, EligibleInvoice[]> {
  const groups = new Map<string, EligibleInvoice[]>();

  if (options.groupByCurrency) {
    for (const inv of invoices) {
      const bucket = groups.get(inv.currency) ?? [];
      bucket.push(inv);
      groups.set(inv.currency, bucket);
    }
    return groups;
  }

  const currencies = new Set(invoices.map(inv => inv.currency));
  if (currencies.size > 1) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: E.PAYMENT_MIXED_CURRENCIES,
    });
  }

  const currency = options.currencyOverride ?? invoices[0]?.currency ?? 'PLN';
  groups.set(currency, invoices);
  return groups;
}

/**
 * Persists payment-run items for the given run and flips the source invoices
 * to `IN_RUN`. Also applies withholding deductions when the organization is in
 * a jurisdiction that requires it (Saudi cross-border WHT, US backup
 * withholding, or 1042-S treaty withholding).
 *
 * All writes are routed through `tx` so they participate in the caller's
 * transaction — no behavior change from the previous inline implementation.
 */
export async function seedRunItems(
  tx: TxClient,
  args: {
    organizationId: string;
    runId: string;
    invoices: EligibleInvoice[];
  },
): Promise<void> {
  await tx.paymentRunItem.createMany({
    data: args.invoices.map(inv => ({
      organizationId: args.organizationId,
      paymentRunId: args.runId,
      invoiceId: inv.id,
      contractorId: inv.contractorId as string,
      billingProfileId: inv.billingProfileId ?? null,
      amountMinor: inv.amountToPayMinor,
      currency: inv.currency,
      status: 'PENDING' as const,
    })),
  });

  // Withholding deductions must run after items exist (they update items in-place).
  await applyWithholdingToRun(tx, args.organizationId, args.runId);

  await tx.invoice.updateMany({
    where: { id: { in: args.invoices.map(inv => inv.id) } },
    data: { paymentStatus: 'IN_RUN' },
  });
}

/**
 * Allocates the next sequential run number for a payment run within the
 * current year (e.g., `PR-2026-001`). Caller MUST hold the per-org payment
 * advisory lock before invoking — the read-then-format pattern is not safe
 * under concurrent allocation otherwise.
 */
export async function allocateRunNumber(tx: TxClient, organizationId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `PR-${year}-`;

  const lastRuns = await tx.paymentRun.findMany({
    where: { organizationId, runNumber: { startsWith: prefix } },
    select: { runNumber: true },
  });

  const seq =
    lastRuns.reduce((max, run) => {
      const runNumber = run.runNumber;
      if (!runNumber) return max;
      const parsed = Number.parseInt(runNumber.slice(prefix.length), 10);
      return Number.isFinite(parsed) && parsed > max ? parsed : max;
    }, 0) + 1;

  return `${prefix}${String(seq).padStart(3, '0')}`;
}

/**
 * Maps an {@link ExportItem} to the NACHA per-entry shape. Routing/account must
 * already be decrypted by `_buildExportItems` — masked values are never emitted.
 */
function toNachaItem(item: ExportItem): NachaExportItem {
  if (!(item.usRoutingNumber && item.usAccountNumber)) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: `ACH export requires US bank details for ${item.contractorName}`,
    });
  }
  return {
    receiverName: item.contractorName,
    routingNumber: item.usRoutingNumber,
    accountNumber: item.usAccountNumber,
    amountMinor: item.amountMinor,
    individualId: item.invoiceNumber,
  };
}

/** Maps org bank info to the NACHA origination shape (hand-set ODFI fields). */
function toNachaOrgBank(orgBank: OrgBankInfo): NachaOrgBankInfo {
  return {
    immediateDestination: orgBank.achImmediateDestination ?? '',
    immediateOrigin: orgBank.achImmediateOrigin ?? '',
    companyName: orgBank.name,
    companyId: orgBank.achCompanyId ?? '',
    odfiRoutingPrefix: orgBank.achOdfiRoutingPrefix ?? '',
  };
}

/**
 * Generates an export file buffer and extension based on the format. Returns any
 * generator warnings (currently NACHA receiver-name transliteration/truncation)
 * so the caller can surface them rather than silently dropping them.
 */
export async function _generateExportFileForFormat(
  format: string,
  exportItems: ExportItem[],
  orgBank: OrgBankInfo,
  runRef: string,
): Promise<{ fileBuffer: Buffer; ext: string; warnings?: string[] }> {
  if (format === 'CSV') {
    return { fileBuffer: await generateCsv(exportItems), ext: 'csv' };
  }
  if (format === 'BANK_FILE') {
    return { fileBuffer: generateElixir(exportItems, orgBank), ext: 'txt' };
  }
  if (format === 'SWIFT_XML') {
    return { fileBuffer: generateSwiftXml(exportItems, orgBank, runRef), ext: 'xml' };
  }
  if (format === 'ACH_NACHA') {
    const result = generateNachaFile(exportItems.map(toNachaItem), toNachaOrgBank(orgBank));
    const warnings = result.warnings.flatMap(w => w.warnings);
    if (warnings.length > 0) {
      log.warn(
        { count: warnings.length },
        'NACHA export produced receiver-name warnings — review before submission',
      );
    }
    return { fileBuffer: result.fileBuffer, ext: result.ext, warnings };
  }
  if (format === 'FEDWIRE') {
    return { fileBuffer: generateFedwirePacs008(exportItems, orgBank, runRef), ext: 'xml' };
  }
  return { fileBuffer: generateSepaXml(exportItems, orgBank, runRef), ext: 'xml' };
}

/**
 * Checks if all items in a payment run are terminal and auto-completes the run.
 */
export async function autoCompleteRunIfTerminal(tx: TxClient, paymentRunId: string): Promise<void> {
  const remaining = await tx.paymentRunItem.count({
    where: { paymentRunId, status: { in: ['PENDING', 'EXPORTED'] } },
  });

  if (remaining > 0) return;

  const failedCount = await tx.paymentRunItem.count({
    where: { paymentRunId, status: 'FAILED' },
  });

  const completedRun = await tx.paymentRun.update({
    where: { id: paymentRunId },
    data: {
      status: failedCount > 0 ? 'FAILED' : 'COMPLETED',
      completedAt: new Date(),
    },
  });

  // A run that finished with a failed item is FAILED, not completed — only the
  // clean-completion transition is surfaced to subscribers of this event.
  if (completedRun.status === 'COMPLETED') {
    await enqueueWebhookEvent(tx, completedRun.organizationId, {
      eventType: 'payment_run.completed',
      aggregateId: completedRun.id,
      data: completedRun,
    });
  }
}

/** Source kinds accepted by {@link applyInvoicePaymentOutcome}. */
export type InvoicePaymentSource = 'PAYMENT_RUN' | 'BANK_STATEMENT' | 'MANUAL';

/**
 * Records an {@link InvoicePayment} row and syncs {@link InvoiceStatus} /
 * {@link PaymentStatus} from cumulative paid amount vs `amountToPayMinor`.
 */
export async function applyInvoicePaymentOutcome(
  tx: TxClient,
  args: {
    organizationId: string;
    invoiceId: string;
    amountMinor: number;
    paidAt: Date;
    sourceKind: InvoicePaymentSource;
    sourcePaymentRunItemId?: string;
    createdByUserId?: string;
  },
): Promise<void> {
  await tx.invoicePayment.create({
    data: {
      organizationId: args.organizationId,
      invoiceId: args.invoiceId,
      amountMinor: args.amountMinor,
      paidAt: args.paidAt,
      sourceKind: args.sourceKind,
      sourcePaymentRunItemId: args.sourcePaymentRunItemId ?? null,
      createdByUserId: args.createdByUserId ?? null,
    },
  });

  const invoice = await tx.invoice.findUnique({
    where: { id: args.invoiceId },
    select: { amountToPayMinor: true },
  });
  if (!invoice) return;

  const paidAgg = await tx.invoicePayment.aggregate({
    where: { invoiceId: args.invoiceId },
    _sum: { amountMinor: true },
  });
  const totalPaidMinor = paidAgg._sum.amountMinor ?? 0;

  if (totalPaidMinor >= invoice.amountToPayMinor) {
    const paidInvoice = await tx.invoice.update({
      where: { id: args.invoiceId },
      data: {
        status: 'PAID',
        paymentStatus: 'PAID',
        paidAt: args.paidAt,
      },
    });

    await enqueueWebhookEvent(tx, args.organizationId, {
      eventType: 'invoice.paid',
      aggregateId: paidInvoice.id,
      data: paidInvoice,
    });
    return;
  }

  await tx.invoice.update({
    where: { id: args.invoiceId },
    data: {
      status: 'PARTIALLY_PAID',
      paymentStatus: 'PARTIALLY_PAID',
      paidAt: args.paidAt,
    },
  });
}

/**
 * Reverses a payment-run item's {@link InvoicePayment} row and re-syncs invoice
 * status when an ACH return (or similar reversal) voids a settled payout.
 */
export async function revertInvoicePaymentOutcome(
  tx: TxClient,
  args: {
    organizationId: string;
    invoiceId: string;
    sourcePaymentRunItemId: string;
  },
): Promise<void> {
  await tx.invoicePayment.deleteMany({
    where: {
      organizationId: args.organizationId,
      invoiceId: args.invoiceId,
      sourcePaymentRunItemId: args.sourcePaymentRunItemId,
    },
  });

  const invoice = await tx.invoice.findUnique({
    where: { id: args.invoiceId },
    select: { amountToPayMinor: true },
  });
  if (!invoice) return;

  const paidAgg = await tx.invoicePayment.aggregate({
    where: { invoiceId: args.invoiceId },
    _sum: { amountMinor: true },
  });
  const totalPaidMinor = paidAgg._sum.amountMinor ?? 0;

  if (totalPaidMinor >= invoice.amountToPayMinor) {
    await tx.invoice.update({
      where: { id: args.invoiceId },
      data: {
        status: 'PAID',
        paymentStatus: 'PAID',
      },
    });
    return;
  }

  if (totalPaidMinor > 0) {
    await tx.invoice.update({
      where: { id: args.invoiceId },
      data: {
        status: 'PARTIALLY_PAID',
        paymentStatus: 'PARTIALLY_PAID',
      },
    });
    return;
  }

  await tx.invoice.update({
    where: { id: args.invoiceId },
    data: {
      status: 'APPROVED',
      paymentStatus: 'READY',
      paidAt: null,
      readyForPaymentAt: new Date(),
    },
  });
}

const REQUESTED_EXPORT_TO_DETECTED: Record<string, ExportFormat> = {
  BANK_FILE: 'BANK_FILE',
  SEPA_XML: 'SEPA_XML',
  SWIFT_XML: 'SWIFT_XML',
  ACH_NACHA: 'ACH_NACHA',
  FEDWIRE: 'FEDWIRE',
};

const FORMAT_REQUIRED_CURRENCY: Partial<Record<string, string>> = {
  SEPA_XML: 'EUR',
  BANK_FILE: 'PLN',
  ACH_NACHA: 'USD',
  FEDWIRE: 'USD',
};

/**
 * Ensures every export item matches the requested bank-file format and currency
 * rail (defence-in-depth beyond BACS-only gating).
 */
export function assertExportItemsMatchRequestedFormat(format: string, items: ExportItem[]): void {
  if (format === 'CSV' || items.length === 0) return;

  const requiredCurrency = FORMAT_REQUIRED_CURRENCY[format];
  if (requiredCurrency) {
    const mismatch = items.find(item => item.currency !== requiredCurrency);
    if (mismatch) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: E.PAYMENT_EXPORT_FORMAT_MISMATCH,
      });
    }
  }

  const groups = groupItemsByFormat(items);
  if (groups.size > 1) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: E.PAYMENT_EXPORT_FORMAT_MISMATCH,
    });
  }

  const expected = REQUESTED_EXPORT_TO_DETECTED[format];
  if (!expected) return;

  const detected = [...groups.keys()][0];
  if (detected !== expected) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: E.PAYMENT_EXPORT_FORMAT_MISMATCH,
    });
  }
}

/**
 * Verifies all non-skipped run items share the run's settlement currency.
 */
export function assertRunItemCurrenciesMatchRun(
  runCurrency: string,
  itemCurrencies: Array<{ currency: string }>,
): void {
  const mismatched = itemCurrencies.filter(item => item.currency !== runCurrency);
  if (mismatched.length > 0) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: E.PAYMENT_MIXED_CURRENCIES,
    });
  }
}

/**
 * Settle one payout item into `settlementCurrency` at the payment-date ECB rate.
 * A rate that is missing entirely and a rate that is older than the FX max-age
 * floor both surface `PAYMENT_SETTLEMENT_RATE_UNAVAILABLE` (UNPROCESSABLE_CONTENT)
 * — a payout is never settled to a silently zeroed or silently stale amount. The
 * distinct staleness cause is preserved in the thrown `StaleExchangeRateError`'s
 * message (logged) even though the client-facing key is shared.
 */
async function settleItemAmount(
  db: DbClient,
  amountMinor: number,
  fromCurrency: string,
  settlementCurrency: string,
  paymentDate: Date,
): Promise<{ amountMinor: number; rate: number; rateDate: Date }> {
  let settled: Awaited<ReturnType<typeof convertForSettlement>>;
  try {
    settled = await convertForSettlement(
      db,
      amountMinor,
      fromCurrency,
      settlementCurrency,
      paymentDate,
    );
  } catch (err) {
    if (err instanceof StaleExchangeRateError) {
      log.warn({ err: err.message }, 'settlement rate stale — refusing payout');
      throw new TRPCError({
        code: 'UNPROCESSABLE_CONTENT',
        message: E.PAYMENT_SETTLEMENT_RATE_UNAVAILABLE,
      });
    }
    throw err;
  }
  if (!settled) {
    throw new TRPCError({
      code: 'UNPROCESSABLE_CONTENT',
      message: E.PAYMENT_SETTLEMENT_RATE_UNAVAILABLE,
    });
  }
  return settled;
}

/**
 * Persist the FX provenance of a settled cross-currency payout onto its
 * `PaymentRunItem` so any audit/row can reconstruct the settled amount
 * (`round(amountMinor * settlementRate)`) and the as-of date. Same-currency
 * settlements (rate 1, nothing to reconstruct) are skipped, matching the
 * schema's "populated only for converted payouts" contract.
 */
async function persistSettlementProvenance(
  db: DbClient,
  itemId: string,
  fromCurrency: string,
  settlementCurrency: string,
  settled: { rate: number; rateDate: Date },
): Promise<void> {
  if (fromCurrency === settlementCurrency) return;
  await db.paymentRunItem.update({
    where: { id: itemId },
    data: { settlementRate: settled.rate, settlementRateDate: settled.rateDate },
  });
}

/**
 * FX provenance of one settled export item, surfaced by `_buildExportItems` so
 * the caller can persist it AFTER the export-race is decided — only the caller
 * that won the DRAFT/LOCKED → EXPORTED transition should write settlement rates.
 * A race loser must not repeat the (idempotent) write. Same-currency items carry
 * no provenance and are never included.
 */
export interface ExportSettlementProvenance {
  itemId: string;
  fromCurrency: string;
  settlementCurrency: string;
  rate: number;
  rateDate: Date;
}

/**
 * Persist the FX provenance for the settled cross-currency items of a WON export
 * (see {@link ExportSettlementProvenance}). Called on the transition winner only,
 * so the loser's file-build no longer repeats these writes.
 */
export async function persistExportSettlements(
  db: DbClient,
  settlements: ExportSettlementProvenance[],
): Promise<void> {
  for (const s of settlements) {
    await persistSettlementProvenance(db, s.itemId, s.fromCurrency, s.settlementCurrency, {
      rate: s.rate,
      rateDate: s.rateDate,
    });
  }
}

/**
 * Builds the ExportItem array from payment-run items with resolved transfer
 * titles, applying the per-payout settlement conversion BEFORE the export buffer
 * is generated (the file must carry the settled amount, not the raw run amount).
 *
 * For each item the settlement currency is resolved (a per-run override wins,
 * else the contractor's own currency) and the gross is converted at the
 * payment-date ECB rate. A missing or stale rate throws rather than emitting a
 * zeroed amount — the payout is never silently settled to nothing.
 *
 * The applied rate + ECB observation date are NOT persisted here — they are
 * returned as `settlements` so the caller can persist them ONLY after winning the
 * export-race transition (`persistExportSettlements`). Persisting inline would
 * make a race loser repeat the idempotent write for a file it never returns.
 */
export async function _buildExportItems(
  db: DbClient,
  items: Array<{
    id: string;
    amountMinor: number;
    currency: string;
    invoice: {
      invoiceNumber: string | null;
      dueDate: Date | null;
      servicePeriodStart: Date | null;
      servicePeriodEnd: Date | null;
    };
    contractor: { legalName: string; taxId: string | null; currency: string };
    billingProfile: {
      bankAccountMasked: string | null;
      bankAccountEncrypted?: string | null;
      swiftBic: string | null;
      bankName: string | null;
      usRoutingNumberEncrypted?: string | null;
      usAccountNumberEncrypted?: string | null;
    } | null;
  }>,
  transferTitleTemplate: string,
  settlement: { paymentDate: Date; perRunOverride?: string },
): Promise<{ items: ExportItem[]; settlements: ExportSettlementProvenance[] }> {
  const exportItems: ExportItem[] = [];
  const settlements: ExportSettlementProvenance[] = [];

  for (const item of items) {
    const billingPeriod =
      item.invoice.servicePeriodStart && item.invoice.servicePeriodEnd
        ? `${item.invoice.servicePeriodStart.toISOString().slice(0, 10)} - ${item.invoice.servicePeriodEnd.toISOString().slice(0, 10)}`
        : undefined;

    const invoiceNumber = item.invoice.invoiceNumber ?? '';

    const transferTitle = resolveTransferTitle(transferTitleTemplate, {
      invoiceNumber,
      billingPeriod,
      contractorName: item.contractor.legalName,
    });

    const settlementCurrency = resolveSettlementCurrency({
      contractorCurrency: item.contractor.currency,
      perRunOverride: settlement.perRunOverride,
    });

    const settled = await settleItemAmount(
      db,
      item.amountMinor,
      item.currency,
      settlementCurrency,
      settlement.paymentDate,
    );

    if (item.currency !== settlementCurrency) {
      settlements.push({
        itemId: item.id,
        fromCurrency: item.currency,
        settlementCurrency,
        rate: settled.rate,
        rateDate: settled.rateDate,
      });
    }

    // Decrypt bank credentials only inside this function — plaintext reaches the
    // export file buffer alone; it is never logged and the audit trail omits it.
    const bankAccountEncrypted = item.billingProfile?.bankAccountEncrypted;
    const usRoutingEncrypted = item.billingProfile?.usRoutingNumberEncrypted;
    const usAccountEncrypted = item.billingProfile?.usAccountNumberEncrypted;
    let usRoutingNumber: string | undefined;
    let usAccountNumber: string | undefined;
    if (usRoutingEncrypted && usAccountEncrypted) {
      usRoutingNumber = decryptBankAccount(usRoutingEncrypted);
      usAccountNumber = decryptBankAccount(usAccountEncrypted);
    }

    let iban = '';
    if (bankAccountEncrypted) {
      iban = decryptBankAccount(bankAccountEncrypted);
    } else if (!(usRoutingNumber && usAccountNumber)) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: `Export requires bank account details for ${item.contractor.legalName}`,
      });
    }

    exportItems.push({
      contractorName: item.contractor.legalName,
      iban,
      amountMinor: settled.amountMinor,
      currency: settlementCurrency,
      invoiceNumber,
      taxId: item.contractor.taxId,
      bankName: item.billingProfile?.bankName ?? null,
      swiftBic: item.billingProfile?.swiftBic ?? null,
      dueDate: item.invoice.dueDate ?? new Date(),
      transferTitle,
      usRoutingNumber,
      usAccountNumber,
    });
  }

  return { items: exportItems, settlements };
}

/**
 * US backup-withholding rate under IRC §3406. A recipient whose TIN fails IRS
 * matching has 24% of each payout withheld until the mismatch is resolved.
 *
 * LOCAL-ONLY: the figure is adviser-verify before production (legal sign-off is
 * deferred for the US payout rail). It is a flat statutory rate, not a
 * per-recipient lookup.
 */
/** Statutory IRC §3406 backup-withholding rate — exported for 1099 box-4 filtering. */
export const US_BACKUP_WITHHOLDING_RATE = 24;

/** Statutory US chapter-3 rate when no valid W-8 substantiates a treaty claim. */
const US_CHAPTER3_STATUTORY_RATE = 30;

/** Which legal basis produced a withholding deduction, for the audit trail. */
export type WithholdingBasis = 'sa_wht' | 'us_backup' | 'treaty_1042s';

/** W-8 chain state from the ACTIVE form on file (not contractor nationality). */
export interface WithholdingW8Input {
  /** Residency claimed on the ACTIVE W-8 (ISO-2); null when no form on file. */
  contractorResidency: string | null;
  /** Signed, unexpired W-8BEN / W-8BEN-E — required before a treaty rate applies. */
  w8ChainComplete: boolean;
}

/** A W-8 chain is complete when the form is signed and not past its expiry. */
export function isW8ChainComplete(submission: {
  signedAt: Date | null;
  expiresAt: Date | null;
}): boolean {
  if (!submission.signedAt) {
    return false;
  }
  return submission.expiresAt === null || submission.expiresAt.getTime() > Date.now();
}

export interface WithholdingOrgInput {
  countryCode: string | null;
  /** Regional data residency (`US` marks the US source even when countryCode is unset). */
  dataRegion?: string | null;
}

export interface WithholdingContractorInput {
  countryCode: string;
  backupWithholdingFlagged?: boolean | null;
}

/** ACTIVE W-form on file — drives US withholding routing (not countryCode alone). */
export type TaxFormOnFile = 'W9' | 'W8BEN' | 'W8BENE';

export interface WithholdingItemInput {
  grossAmountMinor: number;
  contractor: WithholdingContractorInput;
  /** ACTIVE W-8 on file — gates the 1042-S treaty branch (§875(d)). */
  w8?: WithholdingW8Input;
  /** ACTIVE W-9 / W-8 on file; mirrors `routeFormType` at payout time. */
  taxFormOnFile?: TaxFormOnFile | null;
}

export interface WithholdingDecision {
  grossAmountMinor: number;
  /** Net payout after the deduction (gross − whtAmountMinor). */
  amountMinor: number;
  whtAmountMinor: number;
  /** Applied rate in whole-number percent. */
  whtRate: number;
  whtTreatyApplied: boolean;
  whtTreatyReference: string | null;
  whtServiceType: string | null;
  basis: WithholdingBasis;
}

/**
 * Resolve the withholding deduction for a single payment-run item, generalizing
 * the former Saudi-only path into one jurisdiction-agnostic deduction. The
 * recorded `whtAmountMinor` is the single source of truth the 1099 box-4 /
 * 1042-S box-2 aggregates report — the deduction is computed here, never
 * recomputed in the forms.
 *
 * Branches, in precedence order:
 *   - Saudi org cross-border → the existing `calculateWht` path (unchanged).
 *   - US source + a backup-withholding-flagged recipient → 24% (IRC §3406).
 *   - US source + a foreign recipient → the resolved 1042-S treaty rate, or the
 *     30% statutory default when no treaty applies.
 *
 * Returns `null` when no withholding applies (domestic US recipient, a 0% treaty
 * outcome, or a non-withholding jurisdiction); the caller leaves such items
 * untouched. A single HALF-UP round is applied at the rate — amounts are never
 * chain-rounded, preserving the gross/net integer invariant.
 */
export async function applyWithholding(args: {
  org: WithholdingOrgInput;
  item: WithholdingItemInput;
}): Promise<WithholdingDecision | null> {
  const { org, item } = args;
  const gross = item.grossAmountMinor;

  // Saudi cross-border WHT — the original single-jurisdiction path, unchanged.
  if (org.countryCode === 'SA') {
    const wht = await calculateWht(
      org.countryCode,
      item.contractor.countryCode,
      'technical_services',
      gross,
    );
    if (!wht) return null;
    return {
      grossAmountMinor: gross,
      amountMinor: wht.netAmountMinor,
      whtAmountMinor: wht.whtAmountMinor,
      whtRate: wht.whtRate,
      whtTreatyApplied: wht.treatyApplied,
      whtTreatyReference: wht.treatyReference,
      whtServiceType: 'technical_services',
      basis: 'sa_wht',
    };
  }

  const isUsSource = org.countryCode === 'US' || org.dataRegion === 'US';
  if (!isUsSource) return null;

  // Backup withholding (IRC §3406): a flagged recipient's payout is reduced 24%.
  if (item.contractor.backupWithholdingFlagged === true) {
    const whtAmountMinor = Math.round((gross * US_BACKUP_WITHHOLDING_RATE) / 100);
    return {
      grossAmountMinor: gross,
      amountMinor: gross - whtAmountMinor,
      whtAmountMinor,
      whtRate: US_BACKUP_WITHHOLDING_RATE,
      whtTreatyApplied: false,
      whtTreatyReference: null,
      whtServiceType: null,
      basis: 'us_backup',
    };
  }

  const formOnFile = item.taxFormOnFile ?? null;

  // W-9 on file => domestic US-person path (1099-NEC); never chapter-3, even when
  // countryCode is foreign (a foreign national who filed W-9 is a US-person election).
  if (formOnFile === 'W9') {
    return null;
  }

  // Chapter-3 (1042-S): W-8 on file, or legacy fallback when no form and non-US countryCode.
  const isChapter3Recipient =
    formOnFile === 'W8BEN' ||
    formOnFile === 'W8BENE' ||
    (formOnFile === null && item.contractor.countryCode !== 'US');

  if (isChapter3Recipient) {
    const w8Complete = item.w8?.w8ChainComplete ?? false;
    if (!w8Complete) {
      const whtAmountMinor = Math.round((gross * US_CHAPTER3_STATUTORY_RATE) / 100);
      if (whtAmountMinor <= 0) return null;
      return {
        grossAmountMinor: gross,
        amountMinor: gross - whtAmountMinor,
        whtAmountMinor,
        whtRate: US_CHAPTER3_STATUTORY_RATE,
        whtTreatyApplied: false,
        whtTreatyReference: null,
        whtServiceType: null,
        basis: 'treaty_1042s',
      };
    }

    const residency = item.w8?.contractorResidency ?? 'XX';
    const treaty = await applyTreaty({ contractorResidency: residency });
    const whtAmountMinor = Math.round((gross * treaty.rate) / 100);
    if (whtAmountMinor <= 0) return null;
    return {
      grossAmountMinor: gross,
      amountMinor: gross - whtAmountMinor,
      whtAmountMinor,
      whtRate: treaty.rate,
      whtTreatyApplied: treaty.source === 'treaty',
      whtTreatyReference: treaty.article,
      whtServiceType: null,
      basis: 'treaty_1042s',
    };
  }

  // US domestic recipient with no W-8 on file, not backup-flagged → no withholding.
  return null;
}

/**
 * Applies the withholding deduction to every item in a payment run, recording
 * the withheld figure on each `PaymentRunItem` (the source of truth) and writing
 * an audit row per applied item.
 *
 * Non-withholding jurisdictions short-circuit before any item read, preserving
 * the original SA-only early return for every other org.
 */
export async function applyWithholdingToRun(
  tx: TxClient,
  organizationId: string,
  paymentRunId: string,
): Promise<void> {
  const org = await tx.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { countryCode: true, dataRegion: true },
  });

  const isSaudi = org.countryCode === 'SA';
  const isUsSource = org.countryCode === 'US' || org.dataRegion === 'US';
  if (!(isSaudi || isUsSource)) return;

  const items = await tx.paymentRunItem.findMany({
    where: { paymentRunId },
    include: {
      contractor: { select: { countryCode: true, backupWithholdingFlagged: true } },
    },
  });

  const contractorIds = [...new Set(items.map(i => i.contractorId))];
  const taxFormSubmissions =
    contractorIds.length === 0
      ? []
      : await tx.taxFormSubmission.findMany({
          where: {
            organizationId,
            contractorId: { in: contractorIds },
            formType: { in: ['W9', 'W8BEN', 'W8BENE'] },
            status: 'ACTIVE',
          },
          select: {
            contractorId: true,
            formType: true,
            contractorResidency: true,
            signedAt: true,
            expiresAt: true,
          },
        });

  const taxFormByContractor = new Map<string, TaxFormOnFile>();
  const w8ByContractor = new Map<
    string,
    {
      contractorResidency: string | null;
      signedAt: Date | null;
      expiresAt: Date | null;
    }
  >();
  for (const submission of taxFormSubmissions) {
    if (submission.formType === 'W9') {
      taxFormByContractor.set(submission.contractorId, 'W9');
      continue;
    }
    if (!taxFormByContractor.has(submission.contractorId)) {
      taxFormByContractor.set(submission.contractorId, submission.formType as 'W8BEN' | 'W8BENE');
    }
    w8ByContractor.set(submission.contractorId, submission);
  }

  for (const item of items) {
    const w8 = w8ByContractor.get(item.contractorId);
    const decision = await applyWithholding({
      org: { countryCode: org.countryCode, dataRegion: org.dataRegion },
      item: {
        grossAmountMinor: item.amountMinor,
        contractor: {
          countryCode: item.contractor.countryCode,
          backupWithholdingFlagged: item.contractor.backupWithholdingFlagged,
        },
        taxFormOnFile: taxFormByContractor.get(item.contractorId) ?? null,
        w8: {
          contractorResidency: w8?.contractorResidency ?? null,
          w8ChainComplete: w8 ? isW8ChainComplete(w8) : false,
        },
      },
    });
    if (!decision) continue;

    await tx.paymentRunItem.update({
      where: { id: item.id },
      data: {
        grossAmountMinor: decision.grossAmountMinor,
        amountMinor: decision.amountMinor,
        whtAmountMinor: decision.whtAmountMinor,
        whtRate: decision.whtRate,
        whtTreatyApplied: decision.whtTreatyApplied,
        whtTreatyReference: decision.whtTreatyReference,
        whtServiceType: decision.whtServiceType,
      },
    });

    // The Saudi path additionally records the withheld figure on the source
    // invoice; the US backup / 1042-S branches do not touch the invoice.
    if (decision.basis === 'sa_wht') {
      await tx.invoice.update({
        where: { id: item.invoiceId },
        data: { withholdingMinor: decision.whtAmountMinor },
      });
    }

    await writeAuditLog({
      tx,
      organizationId,
      actorType: 'SYSTEM',
      action: 'payment_run.withholding_applied',
      resourceType: 'PAYMENT_RUN',
      resourceId: paymentRunId,
      metadata: {
        paymentRunItemId: item.id,
        whtRate: decision.whtRate,
        whtAmountMinor: decision.whtAmountMinor,
        basis: decision.basis,
      },
    });
  }
}

/**
 * Resolves the organization's bank info and transfer title template from metadata.
 */
export async function _resolveOrgBankInfo(
  tx: TxClient,
  organizationId: string,
): Promise<{ orgBank: OrgBankInfo; transferTitleTemplate: string }> {
  const org = await tx.organization.findUnique({
    where: { id: organizationId },
    select: { name: true, metadata: true, settingsJson: true },
  });

  const parsedMetadata = org?.metadata
    ? (JSON.parse(org.metadata) as Record<string, unknown>)
    : null;
  const columnSettings = (org?.settingsJson as Record<string, unknown> | null) ?? {};
  const metadataSettings = (parsedMetadata?.settingsJson ?? {}) as Record<string, unknown>;
  const settingsJson = { ...metadataSettings, ...columnSettings };

  const bankAccountParse = orgBankInfoSchema.safeParse(settingsJson.bankAccount ?? {});
  if (!bankAccountParse.success) {
    // Malformed IBAN/BIC must not silently flow into the bank-file serializers;
    // treat invalid fields as absent (downstream export validation rejects empties).
    log.warn(
      { organizationId, issues: bankAccountParse.error.issues },
      'organization bank info failed IBAN/BIC validation; omitting from export',
    );
  }
  const bankAccount = bankAccountParse.success ? bankAccountParse.data : {};

  // US ACH origination fields are hand-set per the org's ODFI spec and read
  // defensively from org settings — absent for orgs that have not configured
  // ACH origination, in which case the NACHA origin fields serialize blank.
  const achOrigin = (settingsJson.achOrigin ?? {}) as Record<string, unknown>;
  const achString = (value: unknown): string | undefined =>
    typeof value === 'string' && value.trim() ? value.trim() : undefined;

  return {
    transferTitleTemplate:
      (settingsJson.paymentTransferTitleTemplate as string | undefined) ?? '{invoice_number}',
    orgBank: {
      name: org?.name ?? '',
      iban: bankAccount.iban ?? '',
      bic: bankAccount.bic ?? '',
      achImmediateDestination: achString(achOrigin.immediateDestination),
      achImmediateOrigin: achString(achOrigin.immediateOrigin),
      achCompanyId: achString(achOrigin.companyId),
      achOdfiRoutingPrefix: achString(achOrigin.odfiRoutingPrefix),
    },
  };
}

export const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['LOCKED', 'CANCELLED'],
  LOCKED: ['EXPORTED', 'CANCELLED'],
  EXPORTED: ['COMPLETED', 'FAILED', 'CANCELLED'],
  COMPLETED: [],
  FAILED: ['DRAFT'],
  CANCELLED: [],
};

// ---------------------------------------------------------------------------
// Opt-in programmatic-ACH payout initiation
// ---------------------------------------------------------------------------

/** The provider whose PayoutInitiationAdapter originates the payout. */
export type PayoutProvider = 'MODERN_TREASURY' | 'STRIPE_TREASURY';

/** The result of initiating a payout for a single run item. */
export interface PayoutItemResult {
  itemId: string;
  orderId: string;
  status: PayoutOrderStatus;
  settlementCurrency: string;
  settledAmountMinor: number;
  /** Present iff the item's bank account is not Plaid-VERIFIED (advisory only). */
  advisoryWarning?: string;
}

/** The result of initiating payouts for a whole payment run. */
export interface InitiatePayoutResult {
  runId: string;
  provider: PayoutProvider;
  orders: PayoutItemResult[];
  /** Every per-item advisory warning collected during the run (fail-open). */
  advisoryWarnings: string[];
}

export interface InitiatePayoutArgs {
  organizationId: string;
  userId: string;
  runId: string;
  idempotencyKey: string;
  provider: PayoutProvider;
  /** Optional per-run settlement-currency override (else the contractor's currency). */
  settlementCurrency?: string;
  /** The provider adapter (mock default; live is dark). Injected for testability. */
  adapter: PayoutInitiationAdapter;
  /** Payment date used for the settlement FX lookup (defaults to now). */
  paymentDate?: Date;
}

/**
 * Initiate a programmatic-ACH payout for every item in a locked payment run.
 *
 * Idempotent (no double-pay): the whole initiation is guarded by an Upstash
 * reservation keyed on the org + caller idempotency key — a duplicate retry
 * returns the cached result and never re-originates. The run's items are loaded
 * tenant-scoped (`where: { paymentRunId, organizationId }`) so no cross-tenant
 * profile is ever read.
 *
 * Plaid advisory is fail-open: an item whose billing profile is missing or whose
 * `plaidVerificationStatus` is not VERIFIED surfaces a per-item warning, but the
 * payout still proceeds — it WARNS, never blocks.
 *
 * Each item's amount is settled through the settlement seam (per-run override,
 * else the contractor's currency) at the payment-date ECB rate before it is sent
 * to the adapter; a missing rate surfaces UNPROCESSABLE_CONTENT rather than a
 * silently zeroed payout.
 *
 * Gating (US-expansion + the payments.ach-payouts flag) and permission checks
 * are the caller's responsibility — this helper assumes an already-authorised,
 * opted-in request.
 */
export async function _initiatePayoutForRun(
  db: DbClient,
  args: InitiatePayoutArgs,
): Promise<InitiatePayoutResult> {
  const cacheKey = `payout-init:${args.organizationId}:${args.idempotencyKey}`;

  const hit = await reserveIdempotency<InitiatePayoutResult>(cacheKey, IDEMPOTENCY_TTL_SECONDS);
  if (hit.kind === 'HIT') return hit.result;
  if (hit.kind === 'PENDING') {
    throw new TRPCError({ code: 'CONFLICT', message: E.PAYMENT_PAYOUT_IN_PROGRESS });
  }

  try {
    const run = await db.paymentRun.findFirst({
      where: { id: args.runId, organizationId: args.organizationId },
      select: { status: true },
    });
    if (!run) {
      throw new TRPCError({ code: 'NOT_FOUND', message: E.PAYMENT_RUN_NOT_FOUND });
    }
    if (run.status !== 'LOCKED') {
      throw new TRPCError({ code: 'BAD_REQUEST', message: E.PAYMENT_RUN_INVALID_STATUS });
    }

    // Tenant-scoped item load. The Plaid advisory reads the per-item profile the
    // run actually pays out to (via billingProfileId) — never contractor.billingProfiles[].
    const items = await db.paymentRunItem.findMany({
      where: {
        paymentRunId: args.runId,
        organizationId: args.organizationId,
        status: { in: ['PENDING'] },
      },
      include: {
        billingProfile: {
          select: {
            plaidVerificationStatus: true,
            usRoutingNumberMasked: true,
            usAccountNumberMasked: true,
          },
        },
        contractor: { select: { legalName: true, currency: true } },
      },
    });

    if (items.length === 0) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: E.PAYMENT_RUN_INVALID_STATUS });
    }

    const contractorIds = [
      ...new Set(items.map(i => i.contractorId).filter((x): x is string => Boolean(x))),
    ];
    await assertContractorPaymentEligibility(contractorIds, {
      organizationId: args.organizationId,
      tx: db,
    });

    const paymentDate = args.paymentDate ?? new Date();
    const orders: PayoutItemResult[] = [];
    const advisoryWarnings: string[] = [];

    for (const item of items) {
      const status = item.billingProfile?.plaidVerificationStatus ?? null;
      let advisoryWarning: string | undefined;
      if (item.billingProfile == null || status !== 'VERIFIED') {
        advisoryWarning = item.billingProfile
          ? `Payout item ${item.id}: bank account Plaid status is ${status ?? 'unknown'} (not VERIFIED) — proceeding advisory-only.`
          : `Payout item ${item.id}: no billing profile on file for Plaid verification — proceeding advisory-only.`;
        advisoryWarnings.push(advisoryWarning);
      }

      const contractorCurrency = item.contractor?.currency ?? item.currency;
      const settlementCurrency = resolveSettlementCurrency({
        contractorCurrency,
        perRunOverride: args.settlementCurrency,
      });
      const settled = await settleItemAmount(
        db,
        item.amountMinor,
        item.currency,
        settlementCurrency,
        paymentDate,
      );

      await persistSettlementProvenance(db, item.id, item.currency, settlementCurrency, settled);

      const order = await args.adapter.initiatePayout({
        idempotencyKey: `${args.idempotencyKey}:${item.id}`,
        amountMinor: settled.amountMinor,
        currency: settlementCurrency,
        receiverName: item.contractor?.legalName ?? '',
        // Masked-only — full routing/account are AES-256-GCM at rest and only
        // decrypted inside the live originator, never passed to the mock/audit.
        routingNumber: item.billingProfile?.usRoutingNumberMasked ?? '',
        accountNumber: item.billingProfile?.usAccountNumberMasked ?? '',
      });

      orders.push({
        itemId: item.id,
        orderId: order.id,
        status: order.status,
        settlementCurrency,
        settledAmountMinor: settled.amountMinor,
        advisoryWarning,
      });
    }

    await db.$transaction(async tx => {
      for (const order of orders) {
        await tx.paymentRunItem.update({
          where: { id: order.itemId, organizationId: args.organizationId },
          data: {
            status: 'EXPORTED',
            paymentReference: order.orderId,
          },
        });
      }
      await tx.paymentRun.update({
        where: { id: args.runId },
        data: { status: 'EXPORTED', exportedAt: new Date() },
      });
    });

    const result: InitiatePayoutResult = {
      runId: args.runId,
      provider: args.provider,
      orders,
      advisoryWarnings,
    };

    await writeAuditLog({
      tx: db,
      organizationId: args.organizationId,
      actorType: 'USER',
      actorId: args.userId,
      action: 'payment_run.payout_initiated',
      resourceType: 'PAYMENT_RUN',
      resourceId: args.runId,
      // Masked metadata only — never full routing/account numbers.
      metadata: {
        provider: args.provider,
        itemCount: orders.length,
        advisoryWarningCount: advisoryWarnings.length,
        orders: orders.map(o => ({
          itemId: o.itemId,
          orderId: o.orderId,
          status: o.status,
          settlementCurrency: o.settlementCurrency,
          settledAmountMinor: o.settledAmountMinor,
        })),
      },
    });

    await completeIdempotency(cacheKey, result, IDEMPOTENCY_TTL_SECONDS);
    return result;
  } catch (err) {
    await clearIdempotency(cacheKey);
    throw err;
  }
}
