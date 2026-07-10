import type { PrismaClient } from '@contractor-ops/db';

import { isUniqueConstraintViolation, makeError } from './shared.js';
import type {
  AcknowledgeValidationInput,
  ConvertToInvoiceInput,
  ConvertToInvoiceResult,
  IntakeServiceDeps,
  RejectInput,
} from './types.js';

export async function acknowledgeValidation(
  db: PrismaClient,
  input: AcknowledgeValidationInput,
  deps: IntakeServiceDeps = {},
): Promise<void> {
  const now = deps.now ?? (() => new Date());
  const intake = await db.invoiceIntakeRequest.findFirst({
    where: { id: input.intakeId, organizationId: input.orgId },
    select: {
      id: true,
      validationStatus: true,
    },
  });
  if (!intake) {
    throw makeError('NOT_FOUND', `Intake ${input.intakeId} not found`);
  }
  if (intake.validationStatus !== 'WARNINGS' && intake.validationStatus !== 'INVALID') {
    throw makeError(
      'VALIDATION_NOT_REQUIRED',
      `Intake ${input.intakeId} validationStatus=${intake.validationStatus} requires no acknowledgement`,
    );
  }

  await db.invoiceIntakeRequest.update({
    where: { id: input.intakeId, organizationId: input.orgId },
    data: {
      validationAcknowledgedAt: now(),
      validationAcknowledgedByUserId: input.userId,
    },
  });
}

interface ParsedIntakeInvoice {
  id?: string;
  issueDate?: string;
  dueDate?: string;
  currencyCode?: string;
  taxExclusiveAmount?: number;
  taxInclusiveAmount?: number;
  payableAmount?: number;
  supplier?: { id?: string; name?: string };
  customer?: { id?: string };
  lines?: Array<{
    lineNumber: number;
    description: string;
    quantity?: number;
    unit?: string;
    unitPriceMinor?: number;
    netAmountMinor?: number;
    vatRate?: string;
    vatAmountMinor?: number;
    grossAmountMinor?: number;
  }>;
  taxBreakdown?: Array<{ taxAmountMinor?: number }>;
}

/** Intake row fields consumed by {@link buildInvoiceFieldsFromIntake}. */
interface IntakeInvoiceSource {
  id: string;
  parsedInvoiceJson: unknown;
  extractedInvoiceNumber: string | null;
  extractedSupplierVatId: string | null;
  extractedSupplierName: string | null;
  rawFileSha256: string | null;
}

/**
 * Pure mapping from the parsed intake payload + intake fallbacks to the scalar
 * invoice fields and line rows. No DB access, no throws.
 */
function buildInvoiceFieldsFromIntake(intake: IntakeInvoiceSource, orgId: string, now: () => Date) {
  const parsed = intake.parsedInvoiceJson as unknown as ParsedIntakeInvoice;

  const issueDate = parsed.issueDate ? new Date(parsed.issueDate) : now();
  const dueDate = parsed.dueDate ? new Date(parsed.dueDate) : issueDate;
  const currency = (parsed.currencyCode ?? 'EUR').toUpperCase();
  const subtotalMinor = parsed.taxExclusiveAmount ?? 0;
  const totalMinor = parsed.taxInclusiveAmount ?? subtotalMinor;
  const amountToPayMinor = parsed.payableAmount ?? totalMinor;
  const vatAmountMinor =
    parsed.taxBreakdown && parsed.taxBreakdown.length > 0
      ? parsed.taxBreakdown.reduce((acc, row) => acc + (row.taxAmountMinor ?? 0), 0)
      : totalMinor - subtotalMinor;

  const invoiceNumber = parsed.id || intake.extractedInvoiceNumber || `INTAKE-${intake.id}`;
  const sellerTaxId = parsed.supplier?.id ?? intake.extractedSupplierVatId ?? null;
  const sellerName = parsed.supplier?.name ?? intake.extractedSupplierName ?? null;
  const buyerTaxId = parsed.customer?.id ?? null;
  const duplicateCheckHash = intake.rawFileSha256;

  const linesData = (parsed.lines ?? []).map((line, idx) => ({
    organizationId: orgId,
    lineNumber: line.lineNumber ?? idx + 1,
    description: line.description ?? '',
    quantity: line.quantity == null ? null : line.quantity,
    unit: line.unit ?? null,
    unitPriceMinor: line.unitPriceMinor ?? null,
    netAmountMinor: line.netAmountMinor ?? null,
    vatRate: line.vatRate ?? null,
    vatAmountMinor: line.vatAmountMinor ?? null,
    grossAmountMinor: line.grossAmountMinor ?? null,
  }));

  return {
    issueDate,
    dueDate,
    currency,
    subtotalMinor,
    totalMinor,
    amountToPayMinor,
    vatAmountMinor,
    invoiceNumber,
    sellerTaxId,
    sellerName,
    buyerTaxId,
    duplicateCheckHash,
    linesData,
  };
}

export async function convertToInvoice(
  db: PrismaClient,
  input: ConvertToInvoiceInput,
  deps: IntakeServiceDeps = {},
): Promise<ConvertToInvoiceResult> {
  const now = deps.now ?? (() => new Date());

  const intake = await db.invoiceIntakeRequest.findFirst({
    where: { id: input.intakeId, organizationId: input.orgId },
  });
  if (!intake) {
    throw makeError('NOT_FOUND', `Intake ${input.intakeId} not found`);
  }

  if (intake.status === 'CONVERTED' && intake.convertedInvoiceId) {
    return { invoiceId: intake.convertedInvoiceId };
  }

  if (intake.status !== 'MATCHED') {
    throw makeError(
      'INVALID_STATE_TRANSITION',
      `Cannot convert intake in status ${intake.status}; MATCHED required`,
    );
  }

  const needsAck = intake.validationStatus !== 'VALID';
  if (needsAck && !intake.validationAcknowledgedAt) {
    throw makeError(
      'INVALID_STATE_TRANSITION',
      `Intake ${input.intakeId} requires validation acknowledgement before conversion`,
    );
  }

  if (!intake.matchedContractorId) {
    throw makeError(
      'INVALID_STATE_TRANSITION',
      `Intake ${input.intakeId} has no matched contractor`,
    );
  }

  const {
    issueDate,
    dueDate,
    currency,
    subtotalMinor,
    totalMinor,
    amountToPayMinor,
    vatAmountMinor,
    invoiceNumber,
    sellerTaxId,
    sellerName,
    buyerTaxId,
    duplicateCheckHash,
    linesData,
  } = buildInvoiceFieldsFromIntake(intake, input.orgId, now);

  return db.$transaction(async tx => {
    let invoice: { id: string };
    try {
      invoice = await tx.invoice.create({
        data: {
          organizationId: input.orgId,
          contractorId: intake.matchedContractorId,
          contractId: intake.matchedContractId,
          invoiceNumber,
          source: 'PEPPOL',
          sourceReference: `intake:${intake.id}`,
          issueDate,
          dueDate,
          currency,
          subtotalMinor,
          vatAmountMinor: Number.isFinite(vatAmountMinor) ? vatAmountMinor : null,
          totalMinor,
          amountToPayMinor,
          sellerTaxId,
          sellerName,
          buyerTaxId,
          duplicateCheckHash,
          lines: {
            create: linesData.map(({ organizationId: _omit, ...rest }) => ({
              organizationId: input.orgId,
              ...rest,
            })),
          },
        },
        select: { id: true },
      });
    } catch (err) {
      if (isUniqueConstraintViolation(err)) {
        throw makeError(
          'DUPLICATE_INVOICE_NUMBER',
          `Invoice ${invoiceNumber} already exists for this contractor`,
          { invoiceNumber },
        );
      }
      throw err;
    }

    await tx.invoiceIntakeRequest.update({
      where: { id: intake.id, organizationId: input.orgId },
      data: {
        status: 'CONVERTED',
        convertedInvoiceId: invoice.id,
      },
    });

    return { invoiceId: invoice.id };
  });
}

export async function reject(db: PrismaClient, input: RejectInput): Promise<void> {
  if (input.reason.trim().length < 3) {
    throw makeError('REASON_TOO_SHORT', `Rejection reason must be at least 3 characters`);
  }

  const intake = await db.invoiceIntakeRequest.findFirst({
    where: { id: input.intakeId, organizationId: input.orgId },
    select: { id: true, status: true },
  });
  if (!intake) {
    throw makeError('NOT_FOUND', `Intake ${input.intakeId} not found`);
  }
  if (intake.status === 'CONVERTED') {
    throw makeError('INVALID_STATE_TRANSITION', `Cannot reject intake in status ${intake.status}`);
  }

  await db.invoiceIntakeRequest.update({
    where: { id: input.intakeId, organizationId: input.orgId },
    data: {
      status: 'REJECTED',
      rejectionReason: input.reason,
    },
  });
}
