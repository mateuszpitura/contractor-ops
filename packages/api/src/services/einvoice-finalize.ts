// packages/api/src/services/einvoice-finalize.ts
//
// Phase 61 · Plan 61-06 Task 1 — orchestration spine for EINV-01 + EINV-04 +
// EINV-07. Consumes Plan 02's generator + Plan 03's KoSIT three-layer
// validator + Plan 04's Leitweg-ID resolver; persists the canonical XML to
// R2, the redacted summary to `EInvoiceLifecycle`, and writes the GENERATED
// + VALIDATED audit rows atomically.
//
// Flow (per PLAN.md §Task 1 behaviour):
//   1. Load Invoice (+ lines, contractor, contract, organization) scoped by
//      orgId → NOT_FOUND on cross-tenant mismatch.
//   2. Short-circuit: if a lifecycle already exists and `force === false`
//      throw CONFLICT (callers pass `{ force: true }` to re-finalize).
//   3. Build an EInvoice envelope from the Prisma invoice row (local mapper;
//      peppol-orchestrator has a jurisdiction-specific one but the shape is
//      the same canonical EInvoice type).
//   4. Resolve Leitweg-ID via `resolveLeitwegIdForInvoice`. Tag warnings:
//      - `LEITWEG_ID_MISSING` when DE public-sector buyer has no resolver
//        hit (D-08 soft-gate).
//      - `BR_DE_17_NON_EUR_CURRENCY` when DE public-sector buyer + invoice
//        currency ≠ EUR (RESEARCH Pitfall 6). KoSIT layer-3 echoes this in
//        the actual validation report; we surface it earlier so Plan 07's
//        UI can render an inline hint before the user clicks Finalize.
//   5. Call `profile.generateAndValidate` (produces XML + typed report).
//   6. Compute SHA-256 over the XML, build content-addressed R2 key, put
//      the object.
//   7. Inside a Prisma `$transaction`:
//        - upsert EInvoiceLifecycle on (orgId, invoiceId),
//        - FSM-transition validationStatus (NOT_VALIDATED → validate_*),
//        - insert GENERATED + VALIDATED events.
//   8. Sign a 300-second download URL for the stored XML and return.
//
// Transactional safety: every state mutation + event insert is inside the
// same `$transaction`. The R2 put happens BEFORE the transaction (R2 is not
// transactional anyway, and we'd rather leak an orphan R2 object than write
// a lifecycle row pointing at a non-existent key).
//
// Multi-tenant: every query filters by `organizationId`. Cross-tenant
// invoice access resolves to NOT_FOUND, never FORBIDDEN (avoids the
// response-code oracle documented in Plan 61-04 T-61-04-06).
//
// No `console.*` — `@contractor-ops/logger` only.

import { createHash } from 'node:crypto';

import type {
  EInvoiceLifecycle,
  EInvoiceValidationStatus,
  Prisma,
} from '@contractor-ops/db/generated/prisma/client';
import type {
  EInvoice,
  SkontoTermInput,
  XRechnungGenerateOptions,
  XRechnungValidationReport,
} from '@contractor-ops/einvoice';
import { KOSIT_RULE_SET_VERSION, XRECHNUNG_DE_PROFILE_ID } from '@contractor-ops/einvoice';
import { writeAuditLog } from './audit-writer';
import type { ValidationEvent } from './einvoice-lifecycle-fsm';
import { transitionValidation } from './einvoice-lifecycle-fsm';
import type { ResolvedLeitwegId } from './leitweg-id-resolver';
import { resolveLeitwegIdForInvoice } from './leitweg-id-resolver';
import type { SkontoTermData } from './skonto';
import { resolveSkontoTerm } from './skonto';
import type { DbClient } from './types';

// ---------------------------------------------------------------------------
// Error codes / warning codes surfaced to Plan 07 UI (kept in lockstep with
// the `EInvoice.Errors` i18n namespace). `NOT_FOUND` / `CONFLICT` use the
// standard tRPC codes at the router boundary.
// ---------------------------------------------------------------------------

export const EINVOICE_INVOICE_NOT_FOUND = 'EINVOICE_INVOICE_NOT_FOUND' as const;
export const EINVOICE_ALREADY_FINALIZED = 'EINVOICE_ALREADY_FINALIZED' as const;

export type FinalizeWarningCode = 'LEITWEG_ID_MISSING' | 'BR_DE_17_NON_EUR_CURRENCY';

/**
 * `EInvoiceInvoiceNotFoundError` signals a missing / cross-tenant invoice.
 * Router translates to `NOT_FOUND`.
 */
export class EInvoiceInvoiceNotFoundError extends Error {
  readonly code = EINVOICE_INVOICE_NOT_FOUND;
  constructor(invoiceId: string) {
    super(`Invoice ${invoiceId} not found`);
    this.name = 'EInvoiceInvoiceNotFoundError';
  }
}

/**
 * `EInvoiceAlreadyFinalizedError` signals a finalize attempt on an invoice
 * that already has an `EInvoiceLifecycle` row when the caller did NOT pass
 * `force: true`. Router translates to `CONFLICT`.
 */
export class EInvoiceAlreadyFinalizedError extends Error {
  readonly code = EINVOICE_ALREADY_FINALIZED;
  constructor(invoiceId: string) {
    super(`Invoice ${invoiceId} is already finalized. Pass force=true to re-finalize.`);
    this.name = 'EInvoiceAlreadyFinalizedError';
  }
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Minimal R2 surface the finalize service needs. `putObject` writes the
 * canonical XML at a content-addressed key; `signDownloadUrl` returns a
 * 300-second signed GET URL (Phase 56/59 convention).
 */
export interface R2Service {
  putObject(params: {
    key: string;
    body: Uint8Array | Buffer | string;
    contentType: string;
  }): Promise<void>;
  signDownloadUrl(
    key: string,
    ttlSeconds: number,
  ): Promise<{ signedUrl: string; expiresInSeconds: number }>;
}

/**
 * Structural mirror of `XRechnungDEProfile.generateAndValidate`. Declaring
 * this inline (rather than `Pick<XRechnungDEProfile, 'generateAndValidate'>`)
 * sidesteps a TypeScript quirk where `keyof` on a class-instance type does
 * not admit method names when the class is imported `type`-only.
 */
export interface FinalizeProfile {
  generateAndValidate(
    invoice: EInvoice,
    opts?: XRechnungGenerateOptions,
  ): Promise<{ xml: string; report: XRechnungValidationReport }>;
}

/**
 * Minimal logger surface the service needs. Matches the subset of
 * `pino.Logger` used at call-sites; tests pass `vi.fn()` stubs.
 */
export interface FinalizeLogger {
  info(obj: unknown, msg?: string): void;
  warn(obj: unknown, msg?: string): void;
  error(obj: unknown, msg?: string): void;
}

export interface FinalizeDeps {
  db: DbClient;
  r2: R2Service;
  profile: FinalizeProfile;
  logger: FinalizeLogger;
  /** Unit tests inject a deterministic clock. */
  now?: () => Date;
}

export interface FinalizeInput {
  organizationId: string;
  invoiceId: string;
  actorUserId: string | null;
  /** Re-generate even when a lifecycle already exists for this invoice. */
  force?: boolean;
}

/**
 * Redacted per-layer summary persisted to
 * `EInvoiceLifecycle.validationReportSummary` (D-14). Keeps the row small:
 * the full report is stored separately in R2 when present.
 */
export interface FinalizeValidationReportSummary {
  status: XRechnungValidationReport['status'];
  ruleSetVersion: string;
  /** First 20 issues total across all layers, oldest-first. */
  issues: Array<{
    layer: string;
    severity: string;
    ruleId: string;
    xpath: string;
    message: string;
  }>;
  perLayer: Array<{
    layer: string;
    status: string;
    errorCount: number;
    warningCount: number;
  }>;
}

export interface FinalizeResult {
  lifecycleId: string;
  validationStatus: EInvoiceValidationStatus;
  validationReport: XRechnungValidationReport;
  xmlSha256: string;
  xmlDownloadUrl: string;
  xmlDownloadExpiresInSeconds: number;
  warnings: FinalizeWarningCode[];
  resolvedLeitwegId: ResolvedLeitwegId | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Per T-61-06-06 — cap the XML we will persist. 5 MiB matches the validator
 * layer-1 guard (see `packages/einvoice/src/profiles/xrechnung-de/validator.ts`).
 * A legitimate XRechnung invoice with a few hundred lines is typically well
 * under 200 KiB; 5 MiB is a generous but bounded ceiling.
 */
export const FINALIZE_MAX_XML_BYTES = 5 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Public entrypoint
// ---------------------------------------------------------------------------

export async function finalizeEInvoice(
  deps: FinalizeDeps,
  input: FinalizeInput,
): Promise<FinalizeResult> {
  const { db, r2, profile, logger } = deps;
  const now = deps.now ?? (() => new Date());

  // ── Load invoice (tenant-scoped, eager-fetch the relations we need) ──────
  const invoice = await loadInvoiceWithRelations(db, input);
  if (!invoice) throw new EInvoiceInvoiceNotFoundError(input.invoiceId);

  // ── Short-circuit on existing lifecycle when force=false ─────────────────
  if (!input.force) {
    const existing = await db.eInvoiceLifecycle.findUnique({
      // F-DB-17 — compound (orgId, invoiceId) unique was redundant
      // (invoiceId is globally @unique). Use the field-level unique key.
      where: {
        invoiceId: input.invoiceId,
      },
      select: { id: true },
    });
    if (existing) throw new EInvoiceAlreadyFinalizedError(input.invoiceId);
  }

  // ── Resolve Leitweg-ID + pre-flight warnings ────────────────────────────
  const resolvedLeitwegId = await resolveLeitwegIdForInvoice(db, input.organizationId, {
    contractId: invoice.contractId,
    contractorId: invoice.contractorId,
  });

  const warnings = resolvePreflightWarnings(invoice, resolvedLeitwegId);

  // ── Resolve Skonto cascade (invoice → billing profile → null) ───────────
  // Phase 68 D-03/D-04 — the BG-20 Payment Terms block in the emitted CII
  // XML requires the resolved term as opts.skontoTerm. Cascade rule lives
  // in services/skonto.ts:resolveSkontoTerm (Phase 63 D-21 source-of-truth).
  const invoiceSkonto = toSkontoTermData(invoice.skontoTerms[0] ?? null);
  const profileSkonto = toSkontoTermData(
    invoice.contractor?.billingProfiles?.[0]?.skontoTerms?.[0] ?? null,
  );
  const effectiveSkonto: SkontoTermInput | null = resolveSkontoTerm(invoiceSkonto, profileSkonto);

  // ── Build envelope + run generate + validate ────────────────────────────
  const envelope = mapPrismaInvoiceToEInvoice(invoice);
  const { xml, report } = await profile.generateAndValidate(envelope, {
    leitwegId: resolvedLeitwegId?.value ?? null,
    skontoTerm: effectiveSkonto,
  });

  // T-61-06-06 — bound the bytes we will persist.
  const xmlBytes = Buffer.byteLength(xml, 'utf8');
  if (xmlBytes > FINALIZE_MAX_XML_BYTES) {
    logger.error(
      {
        invoiceId: input.invoiceId,
        organizationId: input.organizationId,
        xmlBytes,
      },
      'XRechnung generator produced an XML payload over the 5 MiB ceiling',
    );
    throw new Error(
      `XRechnung XML exceeds ${FINALIZE_MAX_XML_BYTES} bytes (got ${xmlBytes}); refusing to persist.`,
    );
  }

  // ── Compute SHA-256 and content-addressed R2 key (D-14) ─────────────────
  const xmlSha256 = createHash('sha256').update(xml).digest('hex');
  const xmlKey = buildXmlKey(input.organizationId, input.invoiceId, xmlSha256);

  await r2.putObject({ key: xmlKey, body: xml, contentType: 'application/xml' });

  // ── Persist lifecycle + append events atomically ────────────────────────
  const validationStatus = statusFromReport(report.status);
  const validationEvent = validationEventFromStatus(validationStatus);
  const summary = buildSummary(report);
  const generatedAt = now();

  const lifecycle = await db.$transaction(async tx => {
    // Upsert on (organizationId, invoiceId) so force=true replaces the row
    // in place (unique index) and force=false has already been rejected.
    const current = await tx.eInvoiceLifecycle.findUnique({
      // F-DB-17 — compound (orgId, invoiceId) unique was redundant
      // (invoiceId is globally @unique). Use the field-level unique key.
      where: {
        invoiceId: input.invoiceId,
      },
      select: { validationStatus: true },
    });
    const priorStatus: EInvoiceValidationStatus = current?.validationStatus ?? 'NOT_VALIDATED';
    // FSM assertion: the resulting status must be reachable from the prior
    // state via the validation event we are about to apply.
    transitionValidation(priorStatus, validationEvent);

    const upserted = await tx.eInvoiceLifecycle.upsert({
      // F-DB-17 — compound (orgId, invoiceId) unique was redundant
      // (invoiceId is globally @unique). Use the field-level unique key.
      where: {
        invoiceId: input.invoiceId,
      },
      create: {
        organizationId: input.organizationId,
        invoiceId: input.invoiceId,
        profileId: XRECHNUNG_DE_PROFILE_ID,
        xmlKey,
        xmlSha256,
        ruleSetVersion: KOSIT_RULE_SET_VERSION,
        validatedAt: generatedAt,
        validationStatus,
        validationReportSummary: summary as unknown as Prisma.InputJsonValue,
      },
      update: {
        profileId: XRECHNUNG_DE_PROFILE_ID,
        xmlKey,
        xmlSha256,
        ruleSetVersion: KOSIT_RULE_SET_VERSION,
        validatedAt: generatedAt,
        validationStatus,
        validationReportSummary: summary as unknown as Prisma.InputJsonValue,
      },
    });

    const isReFinalize = current != null;
    const baseEventDetails = {
      xmlSha256,
      ruleSetVersion: KOSIT_RULE_SET_VERSION,
      warnings,
      resolvedLeitwegIdSource: resolvedLeitwegId?.source ?? null,
    };

    await tx.eInvoiceLifecycleEvent.create({
      data: {
        organizationId: input.organizationId,
        lifecycleId: upserted.id,
        eventType: 'GENERATED',
        occurredAt: generatedAt,
        actorUserId: input.actorUserId,
        detailsJson: baseEventDetails as unknown as Prisma.InputJsonValue,
      },
    });

    await tx.eInvoiceLifecycleEvent.create({
      data: {
        organizationId: input.organizationId,
        lifecycleId: upserted.id,
        // On a force=true re-finalize we want the audit trail to show
        // RE_VALIDATED (not VALIDATED) so dashboards can count
        // finalizations vs re-validations accurately. The D-13
        // EInvoiceLifecycleEventType enum has RE_VALIDATED for exactly
        // this case.
        eventType: isReFinalize ? 'RE_VALIDATED' : 'VALIDATED',
        occurredAt: generatedAt,
        actorUserId: input.actorUserId,
        detailsJson: {
          ...baseEventDetails,
          reportStatus: report.status,
          perLayer: summary.perLayer,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    await writeAuditLog({
      tx,
      organizationId: input.organizationId,
      actorType: 'USER',
      actorId: input.actorUserId,
      action: isReFinalize ? 'einvoice.refinalize' : 'einvoice.finalize',
      resourceType: 'INVOICE',
      resourceId: input.invoiceId,
      newValues: { validationStatus, xmlKey, xmlSha256, ruleSetVersion: KOSIT_RULE_SET_VERSION },
    });

    return upserted;
  });

  // ── Sign download URL ────────────────────────────────────────────────────
  const download = await r2.signDownloadUrl(xmlKey, 300);

  logger.info(
    {
      invoiceId: input.invoiceId,
      organizationId: input.organizationId,
      lifecycleId: lifecycle.id,
      validationStatus,
      xmlSha256,
      warningCount: warnings.length,
    },
    'EInvoice finalized',
  );

  return {
    lifecycleId: lifecycle.id,
    validationStatus,
    validationReport: report,
    xmlSha256,
    xmlDownloadUrl: download.signedUrl,
    xmlDownloadExpiresInSeconds: download.expiresInSeconds,
    warnings,
    resolvedLeitwegId,
  };
}

// ---------------------------------------------------------------------------
// Sub-functions — each narrowly typed so tests can mock R2 + profile
// independently and the happy path reads top-to-bottom.
// ---------------------------------------------------------------------------

type InvoiceWithRelations = Awaited<ReturnType<typeof loadInvoiceWithRelations>>;

async function loadInvoiceWithRelations(db: DbClient, input: FinalizeInput) {
  return db.invoice.findFirst({
    where: {
      id: input.invoiceId,
      organizationId: input.organizationId,
    },
    include: {
      lines: { orderBy: { lineNumber: 'asc' } },
      // Phase 68 D-03 — eager-fetch SkontoTerm so finalizeEInvoice can
      // resolve the effective term (invoice-level → billing-profile default
      // → null) BEFORE calling profile.generateAndValidate. Include shape
      // copied verbatim from packages/api/src/routers/payment.ts:1213-1222
      // (single source-of-truth pattern; do NOT import from there).
      skontoTerms: { take: 1 },
      contractor: {
        include: {
          billingProfiles: {
            take: 1,
            include: { skontoTerms: { take: 1 } },
          },
        },
      },
      contract: true,
      organization: true,
    },
  });
}

/**
 * Map a Prisma `SkontoTerm` row (or null) into the structural shape consumed
 * by `services/skonto.ts:resolveSkontoTerm`.
 *
 * Per Phase 68 D-04 + RESEARCH.md Pitfall 2 — kept inline (NOT extracted to
 * services/skonto.ts) because there are exactly three call sites today
 * (this file, `routers/payment.ts:1239-1253`, and `routers/einvoice.ts`
 * `generateZugferdPdf` after Plan 05). Extracting a helper for two new
 * callers is premature DRY.
 *
 * Per RESEARCH.md Pitfall 3 — `Number(row.discountPercent)` is REQUIRED:
 * the Prisma column is Decimal; the cascade resolver expects a number.
 * Failing to coerce produces `#PROZENT=Decimal(3.00)#` instead of
 * `#PROZENT=3.00#` in the emitted CII XML.
 */
function toSkontoTermData(
  row:
    | { discountPercent: unknown; discountPeriodDays: number; netPeriodDays: number }
    | null
    | undefined,
): SkontoTermData | null {
  if (!row) return null;
  return {
    discountPercent: Number(row.discountPercent),
    discountPeriodDays: row.discountPeriodDays,
    netPeriodDays: row.netPeriodDays,
  };
}

function resolvePreflightWarnings(
  invoice: NonNullable<InvoiceWithRelations>,
  resolvedLeitwegId: ResolvedLeitwegId | null,
): FinalizeWarningCode[] {
  const warnings: FinalizeWarningCode[] = [];

  const contractor = invoice.contractor;
  const isDePublicSector =
    !!contractor && contractor.isPublicSectorBuyer === true && contractor.countryCode === 'DE';

  if (isDePublicSector && resolvedLeitwegId === null) {
    warnings.push('LEITWEG_ID_MISSING');
  }

  // RESEARCH Pitfall 6 — BR-DE-17 requires BT-5 = EUR for DE B2G.
  if (isDePublicSector && invoice.currency !== 'EUR') {
    warnings.push('BR_DE_17_NON_EUR_CURRENCY');
  }

  return warnings;
}

/**
 * Map a Prisma Invoice (with eager relations) to the canonical `EInvoice`
 * envelope consumed by `XRechnungDEProfile.generateAndValidate`.
 *
 * This mirrors the shape used by `peppol-orchestrator.ts` — the canonical
 * envelope is jurisdiction-neutral so one mapper suffices. Future phases
 * may extract this to a shared helper once more profiles consume it.
 */
export function mapPrismaInvoiceToEInvoice(invoice: NonNullable<InvoiceWithRelations>): EInvoice {
  const supplierOrg = invoice.organization;
  const contractor = invoice.contractor;
  const vatAmountMinor = invoice.vatAmountMinor ?? 0;

  // Tax category default per Phase 57 semantics: reverse-charge 'AE' when
  // the invoice is tagged reverse-charge; 'S' otherwise. Kleinunternehmer
  // edge (category 'E') is gated upstream by the invoice flags.
  const taxCategory = invoice.isReverseCharge ? 'AE' : 'S';

  return {
    id: invoice.invoiceNumber,
    issueDate: invoice.issueDate.toISOString().slice(0, 10),
    dueDate: invoice.dueDate.toISOString().slice(0, 10),
    invoiceTypeCode: '380',
    currencyCode: invoice.currency,
    supplier: {
      // Organization does not carry a dedicated taxId column in the v4
      // schema — the authoritative supplier tax identifier lives on the
      // invoice row (`sellerTaxId`). Falling back to empty string when
      // absent — the XRechnung generator surfaces its own KoSIT-compatible
      // error (BR-CO-26 seller VAT identifier) via layer-2 validation.
      id: invoice.sellerTaxId ?? '',
      name: invoice.sellerName ?? supplierOrg.name,
      country: supplierOrg.countryCode ?? 'DE',
    },
    customer: {
      id: invoice.buyerTaxId ?? contractor?.taxId ?? '',
      name: contractor?.legalName ?? '',
      country: contractor?.countryCode ?? 'DE',
    },
    lines: invoice.lines.map(line => ({
      lineNumber: line.lineNumber,
      description: line.description,
      quantity: line.quantity ? Number(line.quantity) : 1,
      unit: line.unit ?? undefined,
      unitPriceMinor: line.unitPriceMinor ?? 0,
      netAmountMinor: line.netAmountMinor ?? 0,
      vatRate: line.vatRate ?? invoice.vatRate ?? '0',
      vatAmountMinor: line.vatAmountMinor ?? 0,
      grossAmountMinor: line.grossAmountMinor ?? undefined,
    })),
    taxExclusiveAmount: invoice.subtotalMinor,
    taxInclusiveAmount: invoice.totalMinor,
    payableAmount: invoice.amountToPayMinor,
    taxBreakdown: [
      {
        taxableAmountMinor: invoice.subtotalMinor,
        taxAmountMinor: vatAmountMinor,
        taxCategory,
        percent: invoice.vatRate ? Number(invoice.vatRate) : 0,
      },
    ],
    profileId: XRECHNUNG_DE_PROFILE_ID,
  };
}

function statusFromReport(
  reportStatus: XRechnungValidationReport['status'],
): EInvoiceValidationStatus {
  switch (reportStatus) {
    case 'VALID':
      return 'VALID';
    case 'WARNINGS':
      return 'WARNINGS';
    case 'INVALID':
      return 'INVALID';
  }
}

function validationEventFromStatus(status: EInvoiceValidationStatus): ValidationEvent {
  switch (status) {
    case 'VALID':
      return 'validate_complete_valid';
    case 'WARNINGS':
      return 'validate_complete_warnings';
    case 'INVALID':
      return 'validate_complete_invalid';
    case 'NOT_VALIDATED':
      // Unreachable in practice — the validator always produces one of the
      // three non-pending statuses. Throw loudly if it ever happens.
      throw new Error('validationEventFromStatus: NOT_VALIDATED is not a result status');
  }
}

/**
 * Produce the redacted per-layer summary persisted on the lifecycle row.
 * Keeps the first 20 issues total, oldest-first — sufficient for Plan 07 UI
 * to render an inline hint without blowing up the Prisma JSON payload.
 */
function buildSummary(report: XRechnungValidationReport): FinalizeValidationReportSummary {
  const issues: FinalizeValidationReportSummary['issues'] = [];
  const perLayer: FinalizeValidationReportSummary['perLayer'] = [];

  for (const layer of report.layers) {
    perLayer.push({
      layer: layer.layer,
      status: layer.status,
      errorCount: layer.errors.length,
      warningCount: layer.warnings.length,
    });

    for (const issue of layer.errors) {
      if (issues.length < 20) {
        issues.push({
          layer: layer.layer,
          severity: issue.severity,
          ruleId: issue.ruleId,
          xpath: issue.xpath,
          message: issue.message,
        });
      }
    }
    for (const issue of layer.warnings) {
      if (issues.length < 20) {
        issues.push({
          layer: layer.layer,
          severity: issue.severity,
          ruleId: issue.ruleId,
          xpath: issue.xpath,
          message: issue.message,
        });
      }
    }
  }

  return {
    status: report.status,
    ruleSetVersion: report.ruleSetVersion,
    issues,
    perLayer,
  };
}

export function buildXmlKey(organizationId: string, invoiceId: string, xmlSha256: string): string {
  return `einvoice-xml/${organizationId}/${invoiceId}/${xmlSha256.slice(0, 16)}.xml`;
}

// Re-export the `EInvoiceLifecycle` type so router consumers don't need a
// second import from the generated client when they only want the FinalizeResult.
export type { EInvoiceLifecycle };
