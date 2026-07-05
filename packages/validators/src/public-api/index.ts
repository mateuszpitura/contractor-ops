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
import { contractorLifecycleStageEnum, contractorStatusEnum } from '../contractor.js';
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
