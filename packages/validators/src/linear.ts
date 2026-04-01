import { z } from "zod";

// ---------------------------------------------------------------------------
// Linear State Type Enum
// ---------------------------------------------------------------------------

export const linearStateTypeEnum = z.enum([
  "triage",
  "backlog",
  "unstarted",
  "started",
  "completed",
  "cancelled",
]);

export type LinearStateType = z.infer<typeof linearStateTypeEnum>;

// ---------------------------------------------------------------------------
// Linear Webhook Payload (inbound)
// ---------------------------------------------------------------------------

export const linearWebhookPayloadSchema = z.object({
  action: z.enum(["create", "update", "remove"]),
  type: z.literal("Issue"),
  organizationId: z.string(),
  webhookTimestamp: z.number(),
  webhookId: z.string(),
  url: z.string().url(),
  actor: z.object({
    id: z.string(),
    type: z.string(),
    name: z.string().optional(),
  }),
  data: z.object({
    id: z.string(),
    number: z.number(),
    identifier: z.string(),
    title: z.string(),
    description: z.string().optional(),
    stateId: z.string(),
    teamId: z.string(),
    assigneeId: z.string().nullable().optional(),
    url: z.string(),
  }),
  updatedFrom: z
    .object({
      stateId: z.string().optional(),
    })
    .optional(),
});

export type LinearWebhookPayload = z.infer<typeof linearWebhookPayloadSchema>;

// ---------------------------------------------------------------------------
// Task Template Linear Config (stored in WorkflowTaskTemplate.configJson)
// ---------------------------------------------------------------------------

export const linearTaskConfigSchema = z.object({
  linearEnabled: z.boolean().default(false),
  linearTeamId: z.string().optional(),
  linearTeamKey: z.string().optional(),
  linearTeamName: z.string().optional(),
});

export type LinearTaskConfig = z.infer<typeof linearTaskConfigSchema>;

// ---------------------------------------------------------------------------
// Status Mapping (stored in IntegrationConnection.configJson.statusMappings)
// ---------------------------------------------------------------------------

export const linearStatusMappingEntrySchema = z.object({
  workflowStatus: z.string(),
  linearStateId: z.string(),
  linearStateName: z.string(),
  linearStateType: linearStateTypeEnum,
});

export const linearStatusMappingSchema = z.record(
  z.string(), // Linear team ID
  z.array(linearStatusMappingEntrySchema),
);

export type LinearStatusMappingEntry = z.infer<
  typeof linearStatusMappingEntrySchema
>;
export type LinearStatusMapping = z.infer<typeof linearStatusMappingSchema>;

// ---------------------------------------------------------------------------
// ExternalLink metadataJson for LINEAR_ISSUE
// ---------------------------------------------------------------------------

export const linearIssueMetadataSchema = z.object({
  identifier: z.string(),
  linearIssueId: z.string(),
  title: z.string(),
  status: z.string(),
  statusType: linearStateTypeEnum,
  url: z.string().url(),
  lastSyncOrigin: z.enum(["APP", "LINEAR"]).optional(),
  lastSyncAt: z.string().datetime().optional(),
});

export type LinearIssueMetadata = z.infer<typeof linearIssueMetadataSchema>;

// ---------------------------------------------------------------------------
// Input Schemas for tRPC Mutations
// ---------------------------------------------------------------------------

export const saveLinearStatusMappingInputSchema = z.object({
  connectionId: z.string(),
  teamId: z.string(),
  mappings: z.array(linearStatusMappingEntrySchema),
});

export const saveLinearTaskConfigInputSchema = z.object({
  taskTemplateId: z.string(),
  config: linearTaskConfigSchema,
});
