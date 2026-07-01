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
import { convertForSettlement, resolveSettlementCurrency } from '../../services/payment-settlement';
import { calculateWht } from '../../services/tax-rate.service';
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

  const lastRun = await tx.paymentRun.findFirst({
    where: { organizationId, runNumber: { startsWith: prefix } },
    orderBy: { runNumber: 'desc' },
    select: { runNumber: true },
  });

  const seq = lastRun?.runNumber ? parseInt(lastRun.runNumber.replace(prefix, ''), 10) + 1 : 1;

  return `${prefix}${String(seq).padStart(3, '0')}`;
}

/**
 * Maps an {@link ExportItem} to the NACHA per-entry shape. Routing/account come
 * from the decrypted US bank fields when present; the masked account is the
 * fallback so the dispatch never emits an empty account field.
 */
function toNachaItem(item: ExportItem): NachaExportItem {
  return {
    receiverName: item.contractorName,
    routingNumber: item.usRoutingNumber ?? '',
    accountNumber: item.usAccountNumber ?? item.iban,
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

  await tx.paymentRun.update({
    where: { id: paymentRunId },
    data: {
      status: failedCount > 0 ? 'FAILED' : 'COMPLETED',
      completedAt: new Date(),
    },
  });
}

/**
 * Builds the ExportItem array from payment-run items with resolved transfer
 * titles, applying the per-payout settlement conversion BEFORE the export buffer
 * is generated (the file must carry the settled amount, not the raw run amount).
 *
 * For each item the settlement currency is resolved (a per-run override wins,
 * else the contractor's own currency) and the gross is converted at the
 * payment-date ECB rate. A missing rate throws rather than emitting a zeroed
 * amount — the payout is never silently settled to nothing.
 */
export async function _buildExportItems(
  db: DbClient,
  items: Array<{
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
      swiftBic: string | null;
      bankName: string | null;
      usRoutingNumberEncrypted?: string | null;
      usAccountNumberEncrypted?: string | null;
    } | null;
  }>,
  transferTitleTemplate: string,
  settlement: { paymentDate: Date; perRunOverride?: string },
): Promise<ExportItem[]> {
  const exportItems: ExportItem[] = [];

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

    const settled = await convertForSettlement(
      db,
      item.amountMinor,
      item.currency,
      settlementCurrency,
      settlement.paymentDate,
    );

    if (!settled) {
      throw new TRPCError({
        code: 'UNPROCESSABLE_CONTENT',
        message: E.PAYMENT_SETTLEMENT_RATE_UNAVAILABLE,
      });
    }

    // Decrypt the US routing/account only when both are present. The plaintext
    // stays inside this function and reaches only the export file buffer — it is
    // never logged, and the export audit trail carries no routing/account.
    const usRoutingEncrypted = item.billingProfile?.usRoutingNumberEncrypted;
    const usAccountEncrypted = item.billingProfile?.usAccountNumberEncrypted;
    const usRoutingNumber =
      usRoutingEncrypted && usAccountEncrypted ? decryptBankAccount(usRoutingEncrypted) : undefined;
    const usAccountNumber =
      usRoutingEncrypted && usAccountEncrypted ? decryptBankAccount(usAccountEncrypted) : undefined;

    exportItems.push({
      contractorName: item.contractor.legalName,
      iban: item.billingProfile?.bankAccountMasked ?? '',
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

  return exportItems;
}

/**
 * US backup-withholding rate under IRC §3406. A recipient whose TIN fails IRS
 * matching has 24% of each payout withheld until the mismatch is resolved.
 *
 * LOCAL-ONLY: the figure is adviser-verify before production (legal sign-off is
 * deferred for the US payout rail). It is a flat statutory rate, not a
 * per-recipient lookup.
 */
const US_BACKUP_WITHHOLDING_RATE = 24;

/** Which legal basis produced a withholding deduction, for the audit trail. */
export type WithholdingBasis = 'sa_wht' | 'us_backup' | 'treaty_1042s';

export interface WithholdingOrgInput {
  countryCode: string | null;
  /** Regional data residency (`US` marks the US source even when countryCode is unset). */
  dataRegion?: string | null;
}

export interface WithholdingContractorInput {
  countryCode: string;
  backupWithholdingFlagged?: boolean | null;
}

export interface WithholdingItemInput {
  grossAmountMinor: number;
  contractor: WithholdingContractorInput;
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

  // 1042-S withholding on a foreign recipient: the resolved treaty rate, or the
  // 30% statutory default when no treaty row applies.
  if (item.contractor.countryCode !== 'US') {
    const treaty = await applyTreaty({ contractorResidency: item.contractor.countryCode });
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

  // US domestic recipient, not backup-flagged → no withholding.
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

  for (const item of items) {
    const decision = await applyWithholding({
      org: { countryCode: org.countryCode, dataRegion: org.dataRegion },
      item: {
        grossAmountMinor: item.amountMinor,
        contractor: {
          countryCode: item.contractor.countryCode,
          backupWithholdingFlagged: item.contractor.backupWithholdingFlagged,
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
    // Tenant-scoped item load. The Plaid advisory reads the per-item profile the
    // run actually pays out to (via billingProfileId) — never contractor.billingProfiles[].
    const items = await db.paymentRunItem.findMany({
      where: { paymentRunId: args.runId, organizationId: args.organizationId },
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
      throw new TRPCError({ code: 'NOT_FOUND', message: E.PAYMENT_RUN_NOT_FOUND });
    }

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
      const settled = await convertForSettlement(
        db,
        item.amountMinor,
        item.currency,
        settlementCurrency,
        paymentDate,
      );
      if (!settled) {
        throw new TRPCError({
          code: 'UNPROCESSABLE_CONTENT',
          message: E.PAYMENT_SETTLEMENT_RATE_UNAVAILABLE,
        });
      }

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
