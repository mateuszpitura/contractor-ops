import { z } from 'zod';
import { invitableMemberRoleEnum } from './roles.js';

// ---------------------------------------------------------------------------
// Source provider enum
// ---------------------------------------------------------------------------

export const sourceProviderSchema = z.enum(['JIRA', 'LINEAR', 'GOOGLE_WORKSPACE', 'SLACK']);

export type SourceProvider = z.infer<typeof sourceProviderSchema>;

// ---------------------------------------------------------------------------
// listSources output
// ---------------------------------------------------------------------------

export const listSourcesOutputSchema = z.array(
  z.object({
    provider: sourceProviderSchema,
    connected: z.boolean(),
    selected: z.boolean(),
  }),
);

export type ListSourcesOutput = z.infer<typeof listSourcesOutputSchema>;

// ---------------------------------------------------------------------------
// fetchPeople input / output
// ---------------------------------------------------------------------------

export const fetchPeopleInputSchema = z.object({
  sources: z.array(sourceProviderSchema).min(1),
});

export type FetchPeopleInput = z.infer<typeof fetchPeopleInputSchema>;

export const sourceEntrySchema = z.object({
  source: sourceProviderSchema,
  name: z.string(),
  avatarUrl: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const conflictSchema = z.object({
  field: z.string(),
  values: z.array(
    z.object({
      source: z.string(),
      value: z.string(),
    }),
  ),
  resolved: z.string().optional(),
});

export const mergedPersonSchema = z.object({
  email: z.email(),
  name: z.string(),
  sources: z.array(sourceEntrySchema),
  status: z.enum(['new', 'conflict', 'exists']),
  conflicts: z.array(conflictSchema).optional(),
});

export type MergedPerson = z.infer<typeof mergedPersonSchema>;

export const fetchPeopleSourceErrorCodeSchema = z.enum(['not_connected', 'fetch_failed']);

export type FetchPeopleSourceErrorCode = z.infer<typeof fetchPeopleSourceErrorCodeSchema>;

export const fetchPeopleSourceErrorSchema = z.object({
  source: sourceProviderSchema,
  code: fetchPeopleSourceErrorCodeSchema,
  error: z.string(),
});

export type FetchPeopleSourceError = z.infer<typeof fetchPeopleSourceErrorSchema>;

export const fetchPeopleOutputSchema = z.object({
  people: z.array(mergedPersonSchema),
  sourceErrors: z.array(fetchPeopleSourceErrorSchema),
});

export type FetchPeopleOutput = z.infer<typeof fetchPeopleOutputSchema>;

// ---------------------------------------------------------------------------
// fetchProjects input / output
// ---------------------------------------------------------------------------

export const fetchProjectsInputSchema = z.object({
  sources: z.array(z.enum(['JIRA', 'LINEAR'])).min(1),
});

export type FetchProjectsInput = z.infer<typeof fetchProjectsInputSchema>;

// ---------------------------------------------------------------------------
// batchImport input
// ---------------------------------------------------------------------------

export const batchImportInputSchema = z.object({
  people: z.array(
    z.object({
      email: z.email(),
      name: z.string(),
      role: invitableMemberRoleEnum,
      skip: z.boolean().default(false),
    }),
  ),
});

export type BatchImportInput = z.infer<typeof batchImportInputSchema>;

// ---------------------------------------------------------------------------
// fetchProjects output
// ---------------------------------------------------------------------------

export const importedProjectSchema = z.object({
  sourceProvider: sourceProviderSchema,
  externalId: z.string(),
  name: z.string(),
  statuses: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      color: z.string().optional(),
    }),
  ),
});

export type ImportedProject = z.infer<typeof importedProjectSchema>;

export const fetchProjectsOutputSchema = z.object({
  projects: z.array(importedProjectSchema),
  sourceErrors: z.array(fetchPeopleSourceErrorSchema),
});

export type FetchProjectsOutput = z.infer<typeof fetchProjectsOutputSchema>;

// ---------------------------------------------------------------------------
// importProjects input
// ---------------------------------------------------------------------------

export const importProjectInputSchema = z.object({
  projects: z.array(
    z.object({
      sourceProvider: sourceProviderSchema,
      externalId: z.string(),
      name: z.string(),
      skip: z.boolean().default(false),
      steps: z.array(
        z.object({
          name: z.string(),
          sortOrder: z.number(),
        }),
      ),
    }),
  ),
});

export type ImportProjectInput = z.infer<typeof importProjectInputSchema>;

// ---------------------------------------------------------------------------
// startImport input
// ---------------------------------------------------------------------------

export const startImportInputSchema = z.object({
  people: batchImportInputSchema.shape.people,
  projects: importProjectInputSchema.shape.projects,
});

export type StartImportInput = z.infer<typeof startImportInputSchema>;

// ---------------------------------------------------------------------------
// Import progress output
// ---------------------------------------------------------------------------

export const importProgressOutputSchema = z.object({
  jobId: z.string(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  totalItems: z.number(),
  completedItems: z.number(),
  failedItems: z.array(
    z.object({
      email: z.string(),
      error: z.string(),
      role: invitableMemberRoleEnum,
    }),
  ),
});

export type ImportProgressOutput = z.infer<typeof importProgressOutputSchema>;

// ---------------------------------------------------------------------------
// Retry failed item input
// ---------------------------------------------------------------------------

const retryItemKeySchema = z
  .string()
  .min(1)
  .refine(
    value => z.email().safeParse(value).success || value.startsWith('project:'),
    { message: 'itemKey must be an email or project:externalId' },
  );

export const retryItemInputSchema = z.object({
  jobId: z.string(),
  itemKey: retryItemKeySchema,
});

export type RetryItemInput = z.infer<typeof retryItemInputSchema>;

export const retryItemOutputSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
});

export type RetryItemOutput = z.infer<typeof retryItemOutputSchema>;
