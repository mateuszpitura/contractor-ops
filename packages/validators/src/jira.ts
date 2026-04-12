import { z } from "zod";

// ---------------------------------------------------------------------------
// Jira Webhook Payload (inbound)
// ---------------------------------------------------------------------------

export const jiraWebhookPayloadSchema = z.object({
  webhookEvent: z.literal("jira:issue_updated"),
  timestamp: z.number(),
  issue: z.object({
    id: z.string(),
    key: z.string(),
    fields: z.object({
      summary: z.string(),
      status: z.object({
        name: z.string(),
        statusCategory: z.object({
          key: z.enum(["new", "indeterminate", "done"]),
          name: z.string(),
        }),
      }),
      project: z.object({
        id: z.string(),
        key: z.string(),
        name: z.string(),
      }),
    }),
  }),
  changelog: z.object({
    items: z.array(
      z.object({
        field: z.string(),
        fieldtype: z.string(),
        from: z.string().nullable(),
        fromString: z.string().nullable(),
        to: z.string().nullable(),
        toString: z.string().nullable(),
      }),
    ),
  }),
});

export type JiraWebhookPayload = z.infer<typeof jiraWebhookPayloadSchema>;

// ---------------------------------------------------------------------------
// Task Template Jira Config (stored in WorkflowTaskTemplate.configJson)
// ---------------------------------------------------------------------------

export const jiraTaskConfigSchema = z.object({
  jiraEnabled: z.boolean().default(false),
  jiraProjectId: z.string().optional(),
  jiraProjectKey: z.string().optional(),
  jiraProjectName: z.string().optional(),
  jiraIssueTypeId: z.string().optional(),
  jiraIssueTypeName: z.string().optional(),
});

export type JiraTaskConfig = z.infer<typeof jiraTaskConfigSchema>;

// ---------------------------------------------------------------------------
// Status Mapping (stored in IntegrationConnection.configJson.statusMappings)
// ---------------------------------------------------------------------------

export const jiraStatusMappingEntrySchema = z.object({
  workflowStatus: z.string(),
  jiraTransitionId: z.string(),
  jiraTransitionName: z.string(),
  jiraTargetStatusName: z.string(),
  jiraTargetStatusCategory: z.enum(["new", "indeterminate", "done"]),
});

export const jiraStatusMappingSchema = z.record(
  z.string(), // Jira project ID
  z.array(jiraStatusMappingEntrySchema),
);

export type JiraStatusMappingEntry = z.infer<typeof jiraStatusMappingEntrySchema>;
export type JiraStatusMapping = z.infer<typeof jiraStatusMappingSchema>;

// ---------------------------------------------------------------------------
// ExternalLink metadataJson for JIRA_ISSUE
// ---------------------------------------------------------------------------

export const jiraIssueMetadataSchema = z.object({
  key: z.string(),
  summary: z.string(),
  status: z.string(),
  statusCategory: z.enum(["new", "indeterminate", "done"]),
  url: z.string().url(),
  lastSyncOrigin: z.enum(["APP", "JIRA"]).optional(),
  lastSyncAt: z.string().datetime().optional(),
});

export type JiraIssueMetadata = z.infer<typeof jiraIssueMetadataSchema>;

// ---------------------------------------------------------------------------
// Jira API Response Types
// ---------------------------------------------------------------------------

export const jiraProjectSchema = z.object({
  id: z.string(),
  key: z.string(),
  name: z.string(),
});

export const jiraIssueTypeSchema = z.object({
  id: z.string(),
  name: z.string(),
  subtask: z.boolean().optional(),
});

export const jiraTransitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  to: z.object({
    id: z.string(),
    name: z.string(),
    statusCategory: z.object({
      key: z.enum(["new", "indeterminate", "done"]),
      name: z.string(),
    }),
  }),
});

// ---------------------------------------------------------------------------
// Webhook Registration Response
// ---------------------------------------------------------------------------

export const jiraWebhookRegistrationSchema = z.object({
  webhookRegistrationResult: z.array(
    z.object({
      createdWebhookId: z.number(),
    }),
  ),
});

// ---------------------------------------------------------------------------
// Input Schemas for tRPC Mutations
// ---------------------------------------------------------------------------

export const saveJiraStatusMappingInputSchema = z.object({
  connectionId: z.string(),
  projectId: z.string(),
  mappings: z.array(jiraStatusMappingEntrySchema),
});

export const saveJiraTaskConfigInputSchema = z.object({
  taskTemplateId: z.string(),
  config: jiraTaskConfigSchema,
});
