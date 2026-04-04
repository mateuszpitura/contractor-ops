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

// ---------------------------------------------------------------------------
// Return request schemas
// ---------------------------------------------------------------------------

export const returnRequestStatusEnum = z.enum([
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "SHIPMENT_CREATED",
  "CANCELLED",
]);

export type ReturnRequestStatus = z.infer<typeof returnRequestStatusEnum>;

/**
 * Schema for creating a return request from the contractor portal.
 */
export const returnRequestCreateSchema = z.object({
  targetPointId: z.string().min(1),
  targetPointName: z.string().min(1),
  targetPointAddress: z.string().min(1),
});

export type ReturnRequestCreateInput = z.infer<
  typeof returnRequestCreateSchema
>;

/**
 * Schema for approving a return request (admin action).
 */
export const returnRequestApproveSchema = z.object({
  id: z.string().min(1),
  parcelSize: z.enum(["small", "medium", "large"]).default("large"),
});

export type ReturnRequestApproveInput = z.infer<
  typeof returnRequestApproveSchema
>;

/**
 * Schema for rejecting a return request (admin action).
 */
export const returnRequestRejectSchema = z.object({
  id: z.string().min(1),
  reason: z.string().max(2000).optional(),
});

export type ReturnRequestRejectInput = z.infer<
  typeof returnRequestRejectSchema
>;

// ---------------------------------------------------------------------------
// InPost / Courier schemas
// ---------------------------------------------------------------------------

/**
 * Schema for creating an InPost shipment via ShipX API.
 */
export const inpostShipmentCreateSchema = z.object({
  equipmentIds: z.array(z.string().min(1)).min(1),
  targetPointId: z.string().min(1),
  targetPointName: z.string().min(1),
  targetPointAddress: z.string().min(1),
  parcelSize: z.enum(["small", "medium", "large"]),
  direction: shipmentDirectionEnum,
  workflowTaskRunId: z.string().optional(),
  notes: z.string().max(2000).optional(),
});

export type InpostShipmentCreateInput = z.infer<
  typeof inpostShipmentCreateSchema
>;

/**
 * Schema for courier configuration (stored encrypted per org).
 */
export const courierConfigSchema = z.object({
  carrier: z.string().min(1),
  apiToken: z.string().min(1),
  organizationId: z.string().min(1),
  geowidgetToken: z.string().min(1),
  sandbox: z.boolean().default(true),
  webhookSecret: z.string().optional(),
});

export type CourierConfigInput = z.infer<typeof courierConfigSchema>;

/**
 * Schema for validating InPost webhook payloads (ShipX status push).
 */
export const inpostWebhookPayloadSchema = z.object({
  id: z.number(),
  shipment_id: z.string(),
  status: z.string(),
  tracking_number: z.string().optional(),
  created_at: z.string().optional(),
});

export type InpostWebhookPayload = z.infer<
  typeof inpostWebhookPayloadSchema
>;
