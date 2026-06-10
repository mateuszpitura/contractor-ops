import { z } from 'zod';

/** Single entity lookup by id (tRPC detail/delete/get-by-id procedures). */
export const entityIdSchema = z.object({
  id: z.string().min(1),
});

/** Bulk operation on multiple entity ids. */
export const entityIdsSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
});

/** Offset pagination shared across list procedures. */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

/** Report-style pagination (slightly smaller default page size). */
export const reportPaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

/** Optional inclusive date range for reports and exports. */
export const dateRangeInputSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type EntityIdInput = z.infer<typeof entityIdSchema>;
export type EntityIdsInput = z.infer<typeof entityIdsSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
export type DateRangeInput = z.infer<typeof dateRangeInputSchema>;

/** PATCH-style input: entity id + nested data object. */
export function entityWithDataSchema<T extends z.ZodType>(dataSchema: T) {
  return entityIdSchema.extend({ data: dataSchema });
}
