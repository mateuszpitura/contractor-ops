/**
 * Async export registry.
 *
 * Single typed source of truth for every long-running export the app can
 * produce. Each entry declares:
 *
 *   - `type` — stable identifier persisted as `Export.type`.
 *   - `paramsSchema` — Zod schema validated on both insert (mutation
 *     enqueues the export) and on consumer-side claim (defense-in-depth
 *     against tampered QStash payloads).
 *   - `mimeType` + `filename(params)` — surfaced to the user via the
 *     "your export is ready" email and the download route's
 *     `Content-Disposition` header.
 *   - `maxAgeDays` — retention window for the R2 object + DB row.
 *
 * The handler implementations live alongside this registry but in the
 * `index.ts` entry point. The `defineExport` helper is the only way to
 * register a new export — direct mutation of the registry is rejected at
 * compile time via `Object.freeze` and the `as const` cast.
 *
 * NOTE: changing a `type` value is a breaking change — pending exports
 * persisted with the old key will fail on consumer claim. Bump the type
 * (e.g. `spend-by-contractor-v2`) and keep the old definition handler-only
 * for backfill if you need to evolve the params shape.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Type contract
// ---------------------------------------------------------------------------

/**
 * Internal export type discriminator — the union of every key in
 * {@link EXPORT_REGISTRY}. New exports must extend this list AND be
 * declared in the registry below; the type and the registry stay in sync
 * by construction.
 */
export type ExportType = keyof typeof EXPORT_REGISTRY;

/**
 * A single export definition. The `paramsSchema` is the contract between
 * the producer (mutation) and the consumer (QStash callback handler).
 */
export interface ExportDefinition<TParams extends z.ZodTypeAny = z.ZodTypeAny> {
  /** Stable identifier persisted in `Export.type`. */
  readonly type: string;
  /** Zod schema for the JSON `Export.params` blob. */
  readonly paramsSchema: TParams;
  /** Human display label (used in the export-ready email subject). */
  readonly displayName: string;
  /** MIME type for the produced artefact (`text/csv`, `application/pdf`, …). */
  readonly mimeType: string;
  /** Filename builder — receives the validated params, returns the basename. */
  readonly filename: (params: z.infer<TParams>) => string;
  /** R2 retention in days; defaults to 7 for all exports. */
  readonly maxAgeDays: number;
  /**
   * Permission scope required to enqueue this export. Mirrors the
   * `requirePermission(...)` keys; the export-routes that wrap
   * `requestExport` re-check this scope so the caller cannot bypass it
   * by hitting the consumer route directly.
   */
  readonly requiredPermission: { readonly [resource: string]: readonly string[] };
}

/**
 * Helper for declaring an entry — preserves the inferred Zod type so
 * `params` is typed end-to-end. The cast through `as const` lets the
 * derived `ExportType` union reflect every registered key.
 */
export function defineExport<TParams extends z.ZodTypeAny>(
  def: ExportDefinition<TParams>,
): ExportDefinition<TParams> {
  return def;
}

// ---------------------------------------------------------------------------
// Common parameter shapes
// ---------------------------------------------------------------------------

const dateRangeSchema = z.object({
  dateFrom: z.string().min(1), // ISO yyyy-mm-dd or ISO datetime
  dateTo: z.string().min(1),
});

const expiringContractsParamsSchema = z.object({
  days: z.enum(['30', '60', '90']).default('30'),
});

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/**
 * The complete catalogue of supported exports. The const assertion
 * narrows {@link ExportType} to the registered keys.
 */
export const EXPORT_REGISTRY = {
  'spend-by-contractor': defineExport({
    type: 'spend-by-contractor',
    displayName: 'Spend by contractor',
    paramsSchema: dateRangeSchema.extend({
      contractorId: z.string().min(1).optional(),
    }),
    mimeType: 'text/csv',
    filename: () => `spend-by-contractor-${new Date().toISOString().slice(0, 10)}.csv`,
    maxAgeDays: 7,
    requiredPermission: { report: ['read'] as const },
  }),
  'spend-by-team': defineExport({
    type: 'spend-by-team',
    displayName: 'Spend by team',
    paramsSchema: dateRangeSchema,
    mimeType: 'text/csv',
    filename: () => `spend-by-team-${new Date().toISOString().slice(0, 10)}.csv`,
    maxAgeDays: 7,
    requiredPermission: { report: ['read'] as const },
  }),
  'expiring-contracts': defineExport({
    type: 'expiring-contracts',
    displayName: 'Expiring contracts',
    paramsSchema: expiringContractsParamsSchema,
    mimeType: 'text/csv',
    filename: () => `expiring-contracts-${new Date().toISOString().slice(0, 10)}.csv`,
    maxAgeDays: 7,
    requiredPermission: { report: ['read'] as const },
  }),
  'overdue-invoices': defineExport({
    type: 'overdue-invoices',
    displayName: 'Overdue invoices',
    paramsSchema: z.object({}).default({}),
    mimeType: 'text/csv',
    filename: () => `overdue-invoices-${new Date().toISOString().slice(0, 10)}.csv`,
    maxAgeDays: 7,
    requiredPermission: { report: ['read'] as const },
  }),
  'compliance-gaps': defineExport({
    type: 'compliance-gaps',
    displayName: 'Compliance gaps',
    paramsSchema: z.object({}).default({}),
    mimeType: 'text/csv',
    filename: () => `compliance-gaps-${new Date().toISOString().slice(0, 10)}.csv`,
    maxAgeDays: 7,
    requiredPermission: { report: ['read'] as const },
  }),
  'classification-document-sds': defineExport({
    type: 'classification-document-sds',
    displayName: 'IR35 SDS document',
    paramsSchema: z.object({
      classificationAssessmentId: z.string().min(1),
      classificationDocumentId: z.string().min(1).optional(),
    }),
    mimeType: 'application/pdf',
    filename: params => `SDS-${params.classificationAssessmentId.slice(-8)}.pdf`,
    maxAgeDays: 7,
    requiredPermission: { contractor: ['read'] as const },
  }),
  'drv-defense-bundle': defineExport({
    type: 'drv-defense-bundle',
    displayName: 'DRV defense bundle',
    paramsSchema: z.object({
      classificationAssessmentId: z.string().min(1),
      classificationDocumentId: z.string().min(1).optional(),
    }),
    mimeType: 'application/pdf',
    filename: params => `DRV-Defense-${params.classificationAssessmentId.slice(-8)}.pdf`,
    maxAgeDays: 7,
    requiredPermission: { contractor: ['read'] as const },
  }),
  'classification-document-us-determination-letter': defineExport({
    type: 'classification-document-us-determination-letter',
    displayName: 'US classification determination letter',
    paramsSchema: z.object({
      classificationAssessmentId: z.string().min(1),
      classificationDocumentId: z.string().min(1).optional(),
    }),
    mimeType: 'application/pdf',
    filename: params => `US-Determination-${params.classificationAssessmentId.slice(-8)}.pdf`,
    maxAgeDays: 7,
    requiredPermission: { contractor: ['read'] as const },
  }),
  'gdpr-privacy-notice': defineExport({
    type: 'gdpr-privacy-notice',
    displayName: 'GDPR privacy notice',
    paramsSchema: z.object({}).default({}),
    mimeType: 'application/pdf',
    filename: () => `privacy-notice-${new Date().toISOString().slice(0, 10)}.pdf`,
    maxAgeDays: 7,
    // Privacy notice download is open to any authenticated org member.
    requiredPermission: {} as const,
  }),
} as const satisfies Record<string, ExportDefinition>;

/**
 * Look up a registry entry, throwing on unknown type. Used by both the
 * mutation-side `requestExport` (validate before insert) and the consumer
 * (revalidate before dispatch).
 */
export function getExportDefinition(type: string): ExportDefinition {
  const def = (EXPORT_REGISTRY as Record<string, ExportDefinition | undefined>)[type];
  if (!def) {
    throw new Error(`Unknown export type: ${type}`);
  }
  return def;
}

/**
 * Validate untrusted params against the registry's schema. Both the
 * mutation (caller-side) and the consumer (after claim) must call this
 * before invoking the handler — defense-in-depth.
 *
 * The return type is `unknown` because TypeScript cannot narrow the
 * inferred Zod output when the registry is indexed by a generic key
 * (`EXPORT_REGISTRY[TType]['paramsSchema']` resolves to a union, not the
 * specific schema). Callers cast at the use-site since the handler
 * dispatcher already discriminates on `type`.
 */
export function parseExportParams<TType extends ExportType>(type: TType, params: unknown): unknown {
  const def = EXPORT_REGISTRY[type];
  return def.paramsSchema.parse(params);
}
