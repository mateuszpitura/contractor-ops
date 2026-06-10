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

export const publicApiContractorListInputSchema = paginationSchema.extend({
  status: contractorStatusEnum.optional(),
  lifecycleStage: contractorLifecycleStageEnum.optional(),
  sortBy: z.enum(['legalName', 'createdAt', 'updatedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const publicApiContractListInputSchema = paginationSchema.extend({
  status: contractStatusEnum.optional(),
  contractorId: z.string().optional(),
  sortBy: z.enum(['title', 'startDate', 'endDate', 'createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const publicApiDocumentListInputSchema = paginationSchema.extend({
  entityType: publicApiDocumentEntityTypeEnum.optional(),
  entityId: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const publicApiEquipmentListInputSchema = paginationSchema.extend({
  status: equipmentStatusEnum.optional(),
  type: equipmentTypeEnum.optional(),
  assignedContractorId: z.string().optional(),
  sortBy: z.enum(['name', 'serialNumber', 'type', 'status', 'createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const publicApiInvoiceListInputSchema = paginationSchema.extend({
  status: invoiceStatusEnum.optional(),
  contractorId: z.string().optional(),
  sortBy: z.enum(['issueDate', 'dueDate', 'createdAt', 'totalMinor']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
