/**
 * Anti-corruption layer for Hono public REST inputs.
 * Routers under packages/api/src/routers/public-api/* import from here only.
 */

import { z } from 'zod';

import {
  dateRangeInputSchema,
  entityIdSchema,
  entityIdsSchema,
  paginationSchema,
} from '../common-inputs.js';
import { contractStatusEnum } from '../contract.js';
import {
  contractorLifecycleStageEnum,
  contractorStatusEnum,
  contractorTypeEnum,
} from '../contractor.js';
import { equipmentStatusEnum, equipmentTypeEnum } from '../equipment.js';
import { invoiceStatusEnum } from '../invoice.js';

/**
 * Entity types a public-API consumer may filter documents by. Broader than the
 * internal `documentLinkEntityTypeEnum` (which omits INVOICE) — mirrors the
 * Prisma `EntityType` values that documents are actually linked to.
 */
export const publicApiDocumentEntityTypeEnum = z.enum(['CONTRACTOR', 'CONTRACT', 'INVOICE']);

export {
  contractorLifecycleStageEnum,
  contractorStatusEnum,
  contractStatusEnum,
  dateRangeInputSchema,
  entityIdSchema,
  entityIdsSchema,
  equipmentStatusEnum,
  equipmentTypeEnum,
  invoiceStatusEnum,
  paginationSchema,
};

// ---------------------------------------------------------------------------
// Cursor pagination base (public REST) — replaces offset for public lists.
// ---------------------------------------------------------------------------

/**
 * Shared `.strict()` base for every public list input: an opaque `cursor` token
 * + a bounded `limit`. Per-entity schemas extend this with a `.strict()`
 * `filter` allowlist and a `sort` enum (leading `-` = desc, JSON:API convention):
 *
 *   publicListBaseSchema.extend({
 *     filter: z.object({ status: fooStatusEnum.optional() }).strict().optional(),
 *     sort: z.enum(['createdAt', '-createdAt']).default('-createdAt'),
 *   }).strict()
 *
 * `.strict()` rejects unknown top-level + filter keys (mass-assignment / unknown
 * filter injection). The offset `paginationSchema` is retained only for the
 * legacy equipment list — do not reuse it for new public lists.
 */
export const publicListBaseSchema = z
  .object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();

export type PublicListBaseInput = z.infer<typeof publicListBaseSchema>;

/** Cursor-mode response meta — no `total` (COUNT is dropped in cursor mode). */
export const publicListMetaSchema = z.object({
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
});

/**
 * Builds the standard public list response envelope schema `{ data, meta }` for
 * a given item schema. Used by route `createRoute` response definitions.
 */
export function publicListEnvelope<T extends z.ZodTypeAny>(item: T) {
  return z.object({ data: z.array(item), meta: publicListMetaSchema });
}

export const publicApiContractorListInputSchema = publicListBaseSchema
  .extend({
    filter: z
      .object({
        status: contractorStatusEnum.optional(),
        lifecycleStage: contractorLifecycleStageEnum.optional(),
      })
      .strict()
      .optional(),
    sort: z
      .enum(['createdAt', '-createdAt', 'updatedAt', '-updatedAt', 'legalName', '-legalName'])
      .default('-createdAt'),
  })
  .strict();

export const publicApiContractListInputSchema = publicListBaseSchema
  .extend({
    filter: z
      .object({
        status: contractStatusEnum.optional(),
        contractorId: z.string().optional(),
      })
      .strict()
      .optional(),
    sort: z
      .enum([
        'createdAt',
        '-createdAt',
        'startDate',
        '-startDate',
        'endDate',
        '-endDate',
        'title',
        '-title',
      ])
      .default('-createdAt'),
  })
  .strict();

export const publicApiDocumentListInputSchema = publicListBaseSchema
  .extend({
    filter: z
      .object({
        entityType: publicApiDocumentEntityTypeEnum.optional(),
        entityId: z.string().optional(),
      })
      .strict()
      .optional(),
    sort: z.enum(['createdAt', '-createdAt']).default('-createdAt'),
  })
  .strict();

// ---------------------------------------------------------------------------
// Net-new public read list DTOs (payments, payment_runs, workflows,
// workflow_tasks, classifications, compliance_documents, audit_log).
//
// Filter VALUES are `z.string()` for the 0.x prerelease surface — the field set
// is still `.strict()`-allowlisted (unknown filters rejected), and the value is
// forwarded to a tenant-scoped Prisma `where`. Enum-tighten before SDK 1.0.
// ---------------------------------------------------------------------------

const cursorSort = z.enum(['createdAt', '-createdAt']).default('-createdAt');

export const publicApiPaymentListInputSchema = publicListBaseSchema
  .extend({
    filter: z
      .object({ status: z.string().optional(), contractorId: z.string().optional() })
      .strict()
      .optional(),
    sort: cursorSort,
  })
  .strict();

export const publicApiPaymentRunListInputSchema = publicListBaseSchema
  .extend({
    filter: z.object({ status: z.string().optional() }).strict().optional(),
    sort: cursorSort,
  })
  .strict();

export const publicApiWorkflowListInputSchema = publicListBaseSchema
  .extend({
    filter: z
      .object({ status: z.string().optional(), contractorId: z.string().optional() })
      .strict()
      .optional(),
    sort: cursorSort,
  })
  .strict();

export const publicApiWorkflowTaskListInputSchema = publicListBaseSchema
  .extend({
    filter: z
      .object({ status: z.string().optional(), workflowRunId: z.string().optional() })
      .strict()
      .optional(),
    sort: cursorSort,
  })
  .strict();

export const publicApiClassificationListInputSchema = publicListBaseSchema
  .extend({
    filter: z
      .object({ status: z.string().optional(), countryCode: z.string().optional() })
      .strict()
      .optional(),
    sort: cursorSort,
  })
  .strict();

export const publicApiComplianceDocumentListInputSchema = publicListBaseSchema
  .extend({
    filter: z
      .object({ kind: z.string().optional(), classificationAssessmentId: z.string().optional() })
      .strict()
      .optional(),
    sort: cursorSort,
  })
  .strict();

export const publicApiAuditLogListInputSchema = publicListBaseSchema
  .extend({
    filter: z
      .object({ action: z.string().optional(), resourceType: z.string().optional() })
      .strict()
      .optional(),
    sort: cursorSort,
  })
  .strict();

export const publicApiEquipmentListInputSchema = paginationSchema.extend({
  status: equipmentStatusEnum.optional(),
  type: equipmentTypeEnum.optional(),
  assignedContractorId: z.string().optional(),
  sortBy: z.enum(['name', 'serialNumber', 'type', 'status', 'createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const publicApiInvoiceListInputSchema = publicListBaseSchema
  .extend({
    filter: z
      .object({
        status: invoiceStatusEnum.optional(),
        contractorId: z.string().optional(),
      })
      .strict()
      .optional(),
    sort: z
      .enum([
        'createdAt',
        '-createdAt',
        'issueDate',
        '-issueDate',
        'dueDate',
        '-dueDate',
        'totalMinor',
        '-totalMinor',
      ])
      .default('-createdAt'),
  })
  .strict();

// ---------------------------------------------------------------------------
// Write DTOs (.strict()) — the public WRITE surface (double-dark until P100).
//
// Every write DTO is `.strict()` and OMITS `organizationId`, `workerType`, and
// any server-derived money field. Tenant + attribution actor come from the API
// key, never the body. A key carrying an extra `organizationId`/`workerType`
// field is rejected (mass-assignment defense).
// ---------------------------------------------------------------------------

const currencyCode = z.string().length(3);
const countryCode2 = z.string().length(2);

export const publicApiContractorCreateInputSchema = z
  .object({
    legalName: z.string().min(1).max(200),
    displayName: z.string().min(1).max(200).optional(),
    type: contractorTypeEnum,
    taxId: z.string().max(100).optional(),
    vatId: z.string().max(100).optional(),
    registrationNumber: z.string().max(100).optional(),
    email: z.string().email().max(255).optional(),
    phone: z.string().max(50).optional(),
    countryCode: countryCode2,
    currency: currencyCode,
    addressLine1: z.string().max(200).optional(),
    addressLine2: z.string().max(200).optional(),
    city: z.string().max(120).optional(),
    postalCode: z.string().max(20).optional(),
  })
  .strict();

export const publicApiContractorUpdateInputSchema = z
  .object({
    id: z.string().min(1),
    legalName: z.string().min(1).max(200).optional(),
    displayName: z.string().min(1).max(200).optional(),
    email: z.string().email().max(255).optional(),
    phone: z.string().max(50).optional(),
    addressLine1: z.string().max(200).optional(),
    addressLine2: z.string().max(200).optional(),
    city: z.string().max(120).optional(),
    postalCode: z.string().max(20).optional(),
    status: contractorStatusEnum.optional(),
  })
  .strict();

export const publicApiInvoiceCreateInputSchema = z
  .object({
    contractorId: z.string().min(1),
    invoiceNumber: z.string().min(1).max(100),
    issueDate: z.coerce.date(),
    dueDate: z.coerce.date(),
    currency: currencyCode,
    // An invoice's amounts are legitimate client content (server-derived money is
    // a payment-run concern, not an invoice one).
    subtotalMinor: z.number().int().nonnegative(),
    totalMinor: z.number().int().nonnegative(),
    vatMinor: z.number().int().nonnegative().optional(),
    sellerTaxId: z.string().max(100).optional(),
    description: z.string().max(1000).optional(),
  })
  .strict();

export const publicApiInvoiceVoidInputSchema = entityIdSchema;

export const publicApiPaymentUpdateInputSchema = z
  .object({
    itemId: z.string().min(1),
    status: z.enum(['PENDING', 'EXPORTED', 'PAID', 'FAILED']),
    paymentReference: z.string().max(140).optional(),
    failureReason: z.string().max(500).optional(),
  })
  .strict();

export const publicApiPaymentRunCreateInputSchema = z
  .object({
    // Money is server-derived from the eligible invoices — the DTO omits it.
    invoiceIds: z.array(z.string().min(1)).min(1).max(500),
    name: z.string().max(140).optional(),
    notes: z.string().max(1000).optional(),
    currency: currencyCode.optional(),
    groupByCurrency: z.boolean().optional(),
  })
  .strict();

export const publicApiPaymentRunTransitionInputSchema = z
  .object({
    id: z.string().min(1),
    status: z.enum(['CANCELLED', 'COMPLETED']),
  })
  .strict();

export const publicApiPaymentRunExportInputSchema = z
  .object({
    id: z.string().min(1),
    format: z.enum(['CSV', 'BANK_FILE', 'SWIFT_XML', 'SEPA_XML', 'ACH_NACHA', 'FEDWIRE']),
  })
  .strict();

export const publicApiWorkflowCreateInputSchema = z
  .object({
    templateId: z.string().min(1),
    contractorId: z.string().min(1),
    contractId: z.string().min(1).optional(),
  })
  .strict();

export const publicApiWorkflowExecuteInputSchema = publicApiWorkflowCreateInputSchema;

export const publicApiWorkflowTaskTransitionInputSchema = z
  .object({
    taskRunId: z.string().min(1),
    status: z.enum(['DONE', 'SKIPPED']),
    reason: z.string().max(500).optional(),
  })
  .strict();
