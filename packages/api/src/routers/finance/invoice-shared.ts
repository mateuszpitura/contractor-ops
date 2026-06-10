/**
 * Shared helpers for invoice sub-routers.
 */

import type { TaxIdType, ValidationStatus } from '@contractor-ops/db';
import { TRPCError } from '@trpc/server';
import { getHmrcVatClient, getViesClient } from '../../gov-api-clients';
import type { TenantScopedDb } from '../../lib/tenant-db';
import { computeDuplicateCheckHash } from '../../services/invoice-matching';
import { applyKleinunternehmerOverride } from '../../services/kleinunternehmer.service';
import type { DE13bServiceType } from '../../services/reverse-charge.service';
import {
  detectReverseCharge,
  resolveReverseChargeDecision,
} from '../../services/reverse-charge.service';
import { isValidationFresh, validateTaxId } from '../../services/tax-id-validation.service';
import { getDefaultRateCode } from '../../services/tax-rate.service';
import * as E from '../../errors';

export async function getFinanceTeamUserIds(db: TenantScopedDb, orgId: string): Promise<string[]> {
  const members = await db.member.findMany({
    where: {
      organizationId: orgId,
      role: 'FINANCE_ADMIN',
    },
    select: { userId: true },
  });
  return members.map((m: { userId: string }) => m.userId);
}

export const INVOICE_DATE_FIELDS = [
  'issueDate',
  'dueDate',
  'servicePeriodStart',
  'servicePeriodEnd',
] as const;

export function coerceInvoiceDateFields(data: Record<string, unknown>) {
  for (const field of INVOICE_DATE_FIELDS) {
    if (data[field]) {
      data[field] = new Date(data[field] as string);
    }
  }
}

export function validateServicePeriod(
  updateData: Record<string, unknown>,
  existing: { servicePeriodStart: Date | null; servicePeriodEnd: Date | null },
) {
  const effectiveStart =
    (updateData.servicePeriodStart as Date | undefined) ?? existing.servicePeriodStart;
  const effectiveEnd =
    (updateData.servicePeriodEnd as Date | undefined) ?? existing.servicePeriodEnd;

  if (effectiveStart && effectiveEnd && effectiveEnd < effectiveStart) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: E.SERVICE_PERIOD_END_BEFORE_START,
    });
  }
}

export function validateInvoiceAmounts(
  updateData: Record<string, unknown>,
  existing: {
    subtotalMinor: number;
    vatAmountMinor: number | null;
    totalMinor: number;
    withholdingMinor: number | null;
    amountToPayMinor: number;
  },
) {
  const hasAmountChange =
    updateData.subtotalMinor !== undefined ||
    updateData.vatAmountMinor !== undefined ||
    updateData.totalMinor !== undefined ||
    updateData.withholdingMinor !== undefined ||
    updateData.amountToPayMinor !== undefined;

  if (!hasAmountChange) return;

  const effective = {
    subtotalMinor: (updateData.subtotalMinor as number) ?? existing.subtotalMinor,
    vatAmountMinor: (updateData.vatAmountMinor as number) ?? existing.vatAmountMinor ?? 0,
    totalMinor: (updateData.totalMinor as number) ?? existing.totalMinor,
    withholdingMinor: (updateData.withholdingMinor as number) ?? existing.withholdingMinor ?? 0,
    amountToPayMinor: (updateData.amountToPayMinor as number) ?? existing.amountToPayMinor,
  };

  const expectedTotal =
    effective.subtotalMinor + effective.vatAmountMinor - effective.withholdingMinor;

  if (effective.totalMinor !== expectedTotal) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: E.INVOICE_AMOUNT_MISMATCH,
    });
  }
  if (effective.amountToPayMinor !== effective.totalMinor) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: E.INVOICE_AMOUNT_MISMATCH,
    });
  }
}

export function recomputeDuplicateHash(
  updateData: Record<string, unknown>,
  existing: { invoiceNumber: string | null; sellerTaxId: string | null; totalMinor: number },
) {
  if (
    !(updateData.invoiceNumber || updateData.sellerTaxId) &&
    updateData.totalMinor === undefined
  ) {
    return;
  }

  const effectiveNumber = (updateData.invoiceNumber as string) ?? existing.invoiceNumber;
  const effectiveTaxId = (updateData.sellerTaxId as string) ?? existing.sellerTaxId;
  const effectiveTotal = (updateData.totalMinor as number) ?? existing.totalMinor;

  if (effectiveNumber && effectiveTaxId) {
    updateData.duplicateCheckHash = computeDuplicateCheckHash(
      effectiveNumber,
      effectiveTaxId,
      effectiveTotal,
    );
  }
}

export type ContractorTaxSnapshot = {
  id: string;
  countryCode: string;
  vatId: string | null;
  type: string;
  latestVatValidatedAt: Date | null;
  latestVatValidationStatus: ValidationStatus | null;
};

export async function revalidateStaleVatIfNeeded(
  contractor: ContractorTaxSnapshot,
  ctx: { organizationId: string; db: TenantScopedDb; userId: string },
): Promise<void> {
  if (!contractor.vatId) return;

  const fresh = isValidationFresh(
    contractor.latestVatValidatedAt
      ? {
          responseStatus: contractor.latestVatValidationStatus ?? 'UNAVAILABLE',
          requestedAt: contractor.latestVatValidatedAt,
        }
      : null,
  );
  if (fresh) return;

  const taxIdType: TaxIdType | null =
    contractor.countryCode === 'GB'
      ? 'GB_VAT'
      : contractor.countryCode === 'DE'
        ? 'DE_USTIDNR'
        : null;
  if (!taxIdType) return;

  await validateTaxId(
    {
      organizationId: ctx.organizationId,
      contractorId: contractor.id,
      taxIdType,
      taxIdValue: contractor.vatId,
      actor: { userId: ctx.userId },
    },
    {
      db: ctx.db,
      hmrcClient: getHmrcVatClient(),
      viesClient: getViesClient(),
    },
  );
}

export function resolveReverseCharge(
  contractor: ContractorTaxSnapshot | null,
  orgCountryCode: string | null,
  serviceType: string | undefined,
  userOverride: boolean | null | undefined,
): boolean {
  let rcShouldApply = false;
  if (contractor && orgCountryCode) {
    const rc = detectReverseCharge({
      sellerCountry: contractor.countryCode,
      buyerCountry: orgCountryCode,
      buyerHasVatId: !!contractor.vatId,
      isB2B: contractor.type === 'COMPANY' || contractor.type === 'SOLE_TRADER',
      serviceType: serviceType as DE13bServiceType | undefined,
    });
    rcShouldApply = rc.shouldApply;
  }
  return resolveReverseChargeDecision(rcShouldApply, userOverride).isReverseCharge;
}

export async function resolveEffectiveVatRate(
  suppliedRate: string | null | undefined,
  isReverseCharge: boolean,
  org: { countryCode: string | null; isKleinunternehmer: boolean },
  db: TenantScopedDb,
): Promise<string | null> {
  let rate: string | null = suppliedRate ?? null;

  if (!rate) {
    if (isReverseCharge) {
      rate = 'RC';
    } else if (org.countryCode) {
      rate = await getDefaultRateCode(org.countryCode, db);
    }
  }

  if (org.countryCode) {
    const ku = applyKleinunternehmerOverride(
      { vatRate: rate },
      { countryCode: org.countryCode, isKleinunternehmer: org.isKleinunternehmer },
    );
    rate = ku.vatRate || rate;
  }

  return rate;
}
