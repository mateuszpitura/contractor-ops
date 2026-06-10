import { createLogger } from '@contractor-ops/logger';
import { orgBankInfoSchema } from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import * as E from '../../errors';
import type { ExportItem, OrgBankInfo } from '../../services/payment-export';
import {
  generateCsv,
  generateElixir,
  generateSepaXml,
  generateSwiftXml,
  resolveTransferTitle,
} from '../../services/payment-export';
import { calculateWht } from '../../services/tax-rate.service';
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
 * to `IN_RUN`. Also applies WHT calculations when the organization is in a
 * jurisdiction that requires it (Saudi cross-border).
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

  // WHT calculations must run after items exist (they update items in-place).
  await _applyWhtIfSaudi(tx, args.organizationId, args.runId);

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

  const lastRun = await tx.paymentRun.findFirst({
    where: { organizationId, runNumber: { startsWith: prefix } },
    orderBy: { runNumber: 'desc' },
    select: { runNumber: true },
  });

  const seq = lastRun?.runNumber ? parseInt(lastRun.runNumber.replace(prefix, ''), 10) + 1 : 1;

  return `${prefix}${String(seq).padStart(3, '0')}`;
}

/**
 * Generates an export file buffer and extension based on the format.
 */
export async function _generateExportFileForFormat(
  format: string,
  exportItems: ExportItem[],
  orgBank: OrgBankInfo,
  runRef: string,
): Promise<{ fileBuffer: Buffer; ext: string }> {
  if (format === 'CSV') {
    return { fileBuffer: await generateCsv(exportItems), ext: 'csv' };
  }
  if (format === 'BANK_FILE') {
    return { fileBuffer: generateElixir(exportItems, orgBank), ext: 'txt' };
  }
  if (format === 'SWIFT_XML') {
    return { fileBuffer: generateSwiftXml(exportItems, orgBank, runRef), ext: 'xml' };
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

  await tx.paymentRun.update({
    where: { id: paymentRunId },
    data: {
      status: failedCount > 0 ? 'FAILED' : 'COMPLETED',
      completedAt: new Date(),
    },
  });
}

/**
 * Builds ExportItem array from payment run items with resolved transfer titles.
 */
export function _buildExportItems(
  items: Array<{
    amountMinor: number;
    currency: string;
    invoice: {
      invoiceNumber: string | null;
      dueDate: Date | null;
      servicePeriodStart: Date | null;
      servicePeriodEnd: Date | null;
    };
    contractor: { legalName: string; taxId: string | null };
    billingProfile: {
      bankAccountMasked: string | null;
      swiftBic: string | null;
      bankName: string | null;
    } | null;
  }>,
  transferTitleTemplate: string,
): ExportItem[] {
  return items.map(item => {
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

    return {
      contractorName: item.contractor.legalName,
      iban: item.billingProfile?.bankAccountMasked ?? '',
      amountMinor: item.amountMinor,
      currency: item.currency,
      invoiceNumber,
      taxId: item.contractor.taxId,
      bankName: item.billingProfile?.bankName ?? null,
      swiftBic: item.billingProfile?.swiftBic ?? null,
      dueDate: item.invoice.dueDate ?? new Date(),
      transferTitle,
    };
  });
}

/**
 * Applies withholding tax calculations for Saudi organizations on cross-border payments.
 */
export async function _applyWhtIfSaudi(
  tx: TxClient,
  organizationId: string,
  paymentRunId: string,
): Promise<void> {
  const org = await tx.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { countryCode: true },
  });

  if (org.countryCode !== 'SA') return;

  const items = await tx.paymentRunItem.findMany({
    where: { paymentRunId },
    include: { contractor: { select: { countryCode: true } } },
  });

  for (const item of items) {
    const whtResult = await calculateWht(
      org.countryCode,
      item.contractor.countryCode,
      'technical_services',
      item.amountMinor,
    );
    if (!whtResult) continue;

    await tx.paymentRunItem.update({
      where: { id: item.id },
      data: {
        grossAmountMinor: item.amountMinor,
        amountMinor: whtResult.netAmountMinor,
        whtAmountMinor: whtResult.whtAmountMinor,
        whtRate: whtResult.whtRate,
        whtTreatyApplied: whtResult.treatyApplied,
        whtTreatyReference: whtResult.treatyReference,
        whtServiceType: 'technical_services',
      },
    });
    await tx.invoice.update({
      where: { id: item.invoiceId },
      data: { withholdingMinor: whtResult.whtAmountMinor },
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
    select: { name: true, metadata: true },
  });

  const parsedMetadata = org?.metadata
    ? (JSON.parse(org.metadata) as Record<string, unknown>)
    : null;
  const settingsJson = (parsedMetadata?.settingsJson ?? {}) as Record<string, unknown>;

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

  return {
    transferTitleTemplate:
      (settingsJson.paymentTransferTitleTemplate as string | undefined) ?? '{invoice_number}',
    orgBank: {
      name: org?.name ?? '',
      iban: bankAccount.iban ?? '',
      bic: bankAccount.bic ?? '',
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
