import { z } from "zod";

// ---------------------------------------------------------------------------
// Prisma enum mirrors (string unions — validators package has no Prisma dep)
// ---------------------------------------------------------------------------

export const equipmentTypeEnum = z.enum([
  "LAPTOP",
  "MONITOR",
  "PHONE",
  "HEADSET",
  "KEYBOARD",
  "MOUSE",
  "OTHER",
]);

export const equipmentStatusEnum = z.enum([
  "AVAILABLE",
  "ASSIGNED",
  "IN_TRANSIT",
  "DELIVERED",
  "RETURN_REQUESTED",
  "RETURN_IN_TRANSIT",
  "RETURNED",
  "RETIRED",
]);

export const shipmentStatusEnum = z.enum([
  "CREATED",
  "LABEL_GENERATED",
  "PICKED_UP",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "FAILED",
  "RETURNED",
]);

export const shipmentDirectionEnum = z.enum(["OUTBOUND", "RETURN"]);

// ---------------------------------------------------------------------------
// Equipment CRUD schemas
// ---------------------------------------------------------------------------

/**
 * Schema for creating a new equipment item.
 */
export const equipmentCreateSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  serialNumber: z.string().max(100).optional(),
  type: equipmentTypeEnum,
  customType: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
  purchaseDate: z.coerce.date().optional(),
});

export type EquipmentCreateInput = z.infer<typeof equipmentCreateSchema>;

/**
 * Schema for updating equipment (PATCH semantics with required id).
 */
export const equipmentUpdateSchema = equipmentCreateSchema.partial().extend({
  id: z.string().min(1),
});

export type EquipmentUpdateInput = z.infer<typeof equipmentUpdateSchema>;

/**
 * Schema for listing equipment with pagination, sorting, and filtering.
 */
export const equipmentListSchema = z.object({
  page: z.number().min(1).default(1),
  perPage: z.number().min(1).max(100).default(25),
  search: z.string().optional(),
  status: z.array(equipmentStatusEnum).optional(),
  type: z.array(equipmentTypeEnum).optional(),
  assignedContractorId: z.string().optional(),
  sortBy: z
    .enum(["name", "type", "status", "createdAt"])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type EquipmentListInput = z.infer<typeof equipmentListSchema>;

// ---------------------------------------------------------------------------
// Assignment schemas
// ---------------------------------------------------------------------------

/**
 * Schema for assigning equipment to a contractor.
 */
export const equipmentAssignSchema = z.object({
  equipmentId: z.string().min(1),
  contractorId: z.string().min(1),
  notes: z.string().max(2000).optional(),
});

export type EquipmentAssignInput = z.infer<typeof equipmentAssignSchema>;

/**
 * Schema for unassigning equipment from a contractor.
 */
export const equipmentUnassignSchema = z.object({
  equipmentId: z.string().min(1),
  notes: z.string().max(2000).optional(),
});

export type EquipmentUnassignInput = z.infer<typeof equipmentUnassignSchema>;

// ---------------------------------------------------------------------------
// Shipment schemas
// ---------------------------------------------------------------------------

/**
 * Schema for creating a shipment for equipment.
 */
export const shipmentCreateSchema = z.object({
  equipmentId: z.string().min(1),
  direction: shipmentDirectionEnum,
  carrier: z.string().min(1, "Carrier is required"),
  carrierCustom: z.string().max(100).optional(),
  trackingNumber: z.string().max(100).optional(),
  expectedDeliveryAt: z.coerce.date().optional(),
  workflowTaskRunId: z.string().optional(),
  notes: z.string().max(2000).optional(),
});

export type ShipmentCreateInput = z.infer<typeof shipmentCreateSchema>;

/**
 * Schema for adding a shipment event (status update).
 */
export const shipmentEventCreateSchema = z.object({
  shipmentId: z.string().min(1),
  status: shipmentStatusEnum,
  notes: z.string().max(2000).optional(),
});

export type ShipmentEventCreateInput = z.infer<
  typeof shipmentEventCreateSchema
>;

// ---------------------------------------------------------------------------
// Workflow task config schema
// ---------------------------------------------------------------------------

/**
 * Schema for equipment workflow task configuration stored in configJson.
 */
export const equipmentTaskConfigSchema = z.object({
  equipmentEnabled: z.boolean().default(false),
  direction: shipmentDirectionEnum.optional(),
});

export type EquipmentTaskConfig = z.infer<typeof equipmentTaskConfigSchema>;
