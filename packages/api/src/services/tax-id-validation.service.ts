// ---------------------------------------------------------------------------
// Phase 57 · Plan 03 · Task 1 — tax-id-validation.service (orchestrator)
// ---------------------------------------------------------------------------
//
// Single entry point for HMRC VAT + VIES USt-IdNr validation:
//
//   1. Pre-flight format check (Phase 56 `isValidGbVat` / `isValidUstIdNr`)
//      — shortcircuits malformed input BEFORE any network call. Writes an
//      `invalid` TaxIdValidation row with `apiProvider='local-checksum'` so
//      the audit trail captures the rejected attempt.
//
//   2. Dispatch to the correct gov-api client based on `taxIdType`:
//        - GB_VAT      → HmrcVatClient.checkVatNumber(vrn, { useVerifiedLookup: true })
//        - DE_USTIDNR  → ViesClient.checkVatNumber('DE', vat, { qualified: true })
//
//   3. Atomic dual-write (D-04, D-05, Pitfall 9): `prisma.$transaction([
//        taxIdValidation.create({...}),
//        contractor.update({ latestVatValidatedAt, latestVatValidationStatus }),
//      ])` guarantees the summary columns on `Contractor` never drift from
//      the append-only audit row.
//
//   4. Soft-fail (D-08): on HmrcApiError / ViesApiError / schema violation,
//      look up the latest valid row. If one exists within the 90-day
//      freshness window, persist a new `stale` row (preserving the prior
//      `confirmationRef` + recording the upstream error message); otherwise
//      persist `unavailable`. The caller always sees a deterministic
//      `ValidationStatus` — the orchestrator never surfaces upstream errors
//      as exceptions to tRPC (that would surface raw HMRC/VIES text to users
//      and violate T-57-03-06).
//
//   5. PII safety (T-57-03-02): `maskTaxId()` is applied to every log line
//      containing the raw VAT value. Pino redact paths (packages/logger)
//      cover structured log bodies; the orchestrator never writes the raw
//      `taxIdValue` to console directly.
//
// All reads and writes are scoped to `organizationId`:
//   - `taxIdValidation.create` writes `organizationId` from `input`
//   - `getLatestValidation` filters by `contractorId` (tRPC caller has
//     already enforced tenant scope on the contractor lookup). This
//     matches T-57-03-05 — no cross-tenant read path exists.
// ---------------------------------------------------------------------------

import type { HmrcVatClient, ViesClient } from '@contractor-ops/gov-api';
import type { Prisma, PrismaClient, TaxIdType, ValidationStatus } from '@contractor-ops/db';

import { maskTaxId } from './tax-id-pii.js';

// Pre-flight validators — canonical Phase 56 implementations. These run
// BEFORE any network I/O (RESEARCH Pattern 3).
import { isValidGbVat } from '@contractor-ops/validators';
import { isValidUstIdNr } from '@contractor-ops/validators';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** 90-day freshness window (D-06). */
export const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

// Supported tax-id types — explicit whitelist (dispatch guard).
const SUPPORTED_TAX_ID_TYPES = new Set<TaxIdType>(['GB_VAT', 'DE_USTIDNR']);

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface TaxIdValidationInput {
  organizationId: string;
  contractorId: string;
  taxIdType: TaxIdType;
  taxIdValue: string;
  actor: { userId?: string };
}

export interface TaxIdValidationResult {
  responseStatus: ValidationStatus;
  confirmationRef: string | null;
  source: 'local-checksum' | 'api' | 'stale-cache';
  requestedAt: Date;
  taxIdValidationId: string;
}

export interface TaxIdValidationDeps {
  prisma: PrismaClient;
  hmrcClient: HmrcVatClient;
  viesClient: ViesClient;
  now?: () => Date;
}

export interface LatestValidationRow {
  responseStatus: ValidationStatus;
  requestedAt: Date;
  confirmationRef: string | null;
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Computes the 90-day freshness predicate (D-06).
 *
 * @param validation - most-recent TaxIdValidation row (nullable)
 * @param now        - injected clock; defaults to `new Date()`
 * @returns          - true iff `validation.responseStatus === 'valid'` AND
 *                     the row is younger than 90 days
 */
export function isValidationFresh(
  validation: { responseStatus: ValidationStatus; requestedAt: Date } | null,
  now: Date = new Date(),
): boolean {
  if (!validation) return false;
  if (validation.responseStatus !== 'valid') return false;
  return now.getTime() - validation.requestedAt.getTime() < NINETY_DAYS_MS;
}

/** Strip 2-letter country-code prefix. Idempotent for already-stripped input. */
function stripCountryPrefix(value: string, country: 'GB' | 'DE'): string {
  const upper = value.trim().toUpperCase().replace(/[\s-]/g, '');
  return upper.startsWith(country) ? upper.slice(2) : upper;
}

// ---------------------------------------------------------------------------
// getLatestValidation — tenant-safe read of the most-recent row
// ---------------------------------------------------------------------------

/**
 * Fetches the most-recent TaxIdValidation row for `(contractorId, taxIdType)`.
 * Contractor scoping is handled by the tRPC caller — this function is
 * intentionally not aware of `organizationId` because the contractor row
 * itself carries the FK and the tRPC tenant middleware guarantees the
 * caller only ever sees contractors inside their own org (T-57-03-05).
 */
export async function getLatestValidation(
  params: { contractorId: string; taxIdType: TaxIdType },
  deps: { prisma: PrismaClient },
): Promise<LatestValidationRow | null> {
  const row = await deps.prisma.taxIdValidation.findFirst({
    where: { contractorId: params.contractorId, taxIdType: params.taxIdType },
    orderBy: { requestedAt: 'desc' },
    select: { responseStatus: true, requestedAt: true, confirmationRef: true },
  });
  return row;
}

// ---------------------------------------------------------------------------
// validateTaxId — main orchestrator
// ---------------------------------------------------------------------------

/**
 * Validate a contractor's tax identifier against the appropriate government
 * API. See module header for the full contract. Returns a deterministic
 * `TaxIdValidationResult` — never throws on upstream failure (soft-fails to
 * `stale` / `unavailable`).
 *
 * @throws `Error('Unsupported taxIdType: …')` when `input.taxIdType` is not
 *   in the `SUPPORTED_TAX_ID_TYPES` whitelist. This is a programmer error
 *   (caller routed an unknown type), not a business-level failure.
 */
export async function validateTaxId(
  input: TaxIdValidationInput,
  deps: TaxIdValidationDeps,
): Promise<TaxIdValidationResult> {
  const now = (deps.now ?? (() => new Date()))();
  const maskedValue = maskTaxId(input.taxIdValue);

  // ---- Dispatch guard (fail-fast on unsupported types) -------------------
  if (!SUPPORTED_TAX_ID_TYPES.has(input.taxIdType)) {
    throw new Error(`Unsupported taxIdType: ${String(input.taxIdType)}`);
  }

  // ---- Pre-flight checksum short-circuit ---------------------------------
  const preflightOk = runPreflight(input.taxIdType, input.taxIdValue);
  if (!preflightOk) {
    return persistAndUpdate(
      {
        input,
        apiProvider: 'local-checksum',
        responseStatus: 'invalid',
        confirmationRef: null,
        responseBody: { source: 'local-checksum' } as Prisma.InputJsonValue,
        errorMessage: null,
        source: 'local-checksum',
        now,
      },
      deps,
    );
  }

  // ---- Dispatch + network call (soft-fail on any upstream/schema error) --
  try {
    if (input.taxIdType === 'GB_VAT') {
      const result = await deps.hmrcClient.checkVatNumber(
        stripCountryPrefix(input.taxIdValue, 'GB'),
        { organizationId: input.organizationId, useVerifiedLookup: true },
      );
      return persistAndUpdate(
        {
          input,
          apiProvider: 'hmrc',
          responseStatus: result.status === 'valid' ? 'valid' : 'invalid',
          confirmationRef: result.status === 'valid' ? result.confirmationRef : null,
          responseBody: (result.status === 'valid'
            ? (result.raw as unknown as Prisma.InputJsonValue)
            : ({ status: 'invalid' } as Prisma.InputJsonValue)),
          errorMessage: null,
          source: 'api',
          now,
        },
        deps,
      );
    }

    // input.taxIdType === 'DE_USTIDNR'
    const viesResult = await deps.viesClient.checkVatNumber(
      'DE',
      stripCountryPrefix(input.taxIdValue, 'DE'),
      { organizationId: input.organizationId, qualified: true },
    );

    // ViesClient can internally soft-fail to 'unavailable' without throwing —
    // thread that through as-is (no stale promotion, no error message).
    if (viesResult.status === 'unavailable') {
      return softFail({
        input,
        apiProvider: 'vies',
        errorMessage: `VIES unavailable: ${viesResult.userError}`,
        now,
        responseBody: viesResult.raw as unknown as Prisma.InputJsonValue,
        deps,
      });
    }

    return persistAndUpdate(
      {
        input,
        apiProvider: 'vies',
        responseStatus: viesResult.status === 'valid' ? 'valid' : 'invalid',
        confirmationRef: viesResult.status === 'valid' ? viesResult.confirmationRef : null,
        responseBody: viesResult.raw as unknown as Prisma.InputJsonValue,
        errorMessage: null,
        source: 'api',
        now,
      },
      deps,
    );
  } catch (err) {
    // Any thrown error — HmrcApiError, ViesApiError, schema violation, TCP
    // reset — maps to the D-08 soft-fail branch. Logs are PII-masked.
    const message = err instanceof Error ? err.message : 'Unknown upstream error';
    // eslint-disable-next-line no-console
    console.error(
      `[tax-id-validation] upstream error for ${input.taxIdType} ${maskedValue}: ${message}`,
    );
    return softFail({
      input,
      apiProvider: input.taxIdType === 'GB_VAT' ? 'hmrc' : 'vies',
      errorMessage: message,
      now,
      responseBody: { error: message } as Prisma.InputJsonValue,
      deps,
    });
  }
}

// ---------------------------------------------------------------------------
// Internal: pre-flight router
// ---------------------------------------------------------------------------

function runPreflight(taxIdType: TaxIdType, value: string): boolean {
  if (taxIdType === 'GB_VAT') return isValidGbVat(value);
  if (taxIdType === 'DE_USTIDNR') return isValidUstIdNr(value);
  // Unreachable — dispatch guard already rejected other types.
  return false;
}

// ---------------------------------------------------------------------------
// Internal: persist + contractor summary update (atomic)
// ---------------------------------------------------------------------------

interface PersistArgs {
  input: TaxIdValidationInput;
  apiProvider: string;
  responseStatus: ValidationStatus;
  confirmationRef: string | null;
  responseBody: Prisma.InputJsonValue;
  errorMessage: string | null;
  source: TaxIdValidationResult['source'];
  now: Date;
}

async function persistAndUpdate(
  args: PersistArgs,
  deps: TaxIdValidationDeps,
): Promise<TaxIdValidationResult> {
  const {
    input,
    apiProvider,
    responseStatus,
    confirmationRef,
    responseBody,
    errorMessage,
    source,
    now,
  } = args;

  const [created] = await deps.prisma.$transaction([
    deps.prisma.taxIdValidation.create({
      data: {
        organizationId: input.organizationId,
        contractorId: input.contractorId,
        taxIdType: input.taxIdType,
        taxIdValue: input.taxIdValue,
        apiProvider,
        requestedAt: now,
        responseStatus,
        responseBody,
        confirmationRef: confirmationRef ?? undefined,
        errorMessage: errorMessage ?? undefined,
      },
    }),
    deps.prisma.contractor.update({
      where: { id: input.contractorId },
      data: {
        latestVatValidatedAt: now,
        latestVatValidationStatus: responseStatus,
      },
    }),
  ]);

  return {
    responseStatus,
    confirmationRef,
    source,
    requestedAt: now,
    taxIdValidationId: (created as { id: string }).id,
  };
}

// ---------------------------------------------------------------------------
// Internal: soft-fail handler (D-08)
// ---------------------------------------------------------------------------

interface SoftFailArgs {
  input: TaxIdValidationInput;
  apiProvider: string;
  errorMessage: string;
  responseBody: Prisma.InputJsonValue;
  now: Date;
  deps: TaxIdValidationDeps;
}

async function softFail(args: SoftFailArgs): Promise<TaxIdValidationResult> {
  const { input, apiProvider, errorMessage, responseBody, now, deps } = args;

  const prior = await getLatestValidation(
    { contractorId: input.contractorId, taxIdType: input.taxIdType },
    { prisma: deps.prisma },
  );

  if (isValidationFresh(prior, now)) {
    // Prior valid within 90d → persist `stale` preserving the prior
    // confirmationRef so downstream UI / invoicing can still quote it.
    return persistAndUpdate(
      {
        input,
        apiProvider,
        responseStatus: 'stale',
        confirmationRef: prior!.confirmationRef,
        responseBody,
        errorMessage,
        source: 'stale-cache',
        now,
      },
      deps,
    );
  }

  // No prior valid, OR prior is older than 90d → `unavailable`.
  return persistAndUpdate(
    {
      input,
      apiProvider,
      responseStatus: 'unavailable',
      confirmationRef: null,
      responseBody,
      errorMessage,
      source: 'api',
      now,
    },
    deps,
  );
}
