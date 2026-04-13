import { randomUUID } from 'node:crypto';
import { authApi } from '@contractor-ops/auth';
import type { Prisma } from '@contractor-ops/db';
import { decryptCredentials } from '@contractor-ops/integrations';
import {
  fetchPeopleInputSchema,
  retryItemInputSchema,
  sourceProviderSchema,
  startImportInputSchema,
} from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { router } from '../init.js';
import type { TenantScopedDb } from '../lib/tenant-db.js';
import { tenantProcedure } from '../middleware/tenant.js';
import { requireTier } from '../middleware/tier.js';
import { linearGraphQL } from '../services/linear-issue-sync.js';
import {
  createWorkflowTemplatesFromProjects,
  fetchUsersFromSource,
  mergeByEmail,
} from '../services/onboarding-import-service.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALL_PROVIDERS = ['JIRA', 'LINEAR', 'GOOGLE_WORKSPACE', 'SLACK'] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ConnectionConfig {
  cloudId?: string;
  statusMappings?: Record<string, unknown[]>;
  [key: string]: unknown;
}

export interface ImportJob {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  totalItems: number;
  completedItems: number;
  failedItems: Array<{ email: string; error: string; role: string }>;
}

interface OrgSettings {
  importJobs?: Record<string, ImportJob>;
  [key: string]: unknown;
}

/**
 * Reads the org settingsJson and extracts import job data.
 */
async function getOrgSettings(
  db: TenantScopedDb,
  organizationId: string,
): Promise<{ orgId: string; settings: OrgSettings }> {
  const org = await db.organization.findFirst({
    where: { id: organizationId },
    select: { id: true, settingsJson: true },
  });

  return {
    orgId: organizationId,
    settings: (org?.settingsJson as OrgSettings) ?? {},
  };
}

/**
 * Updates a specific import job in org settingsJson.
 */
async function updateImportJob(
  db: TenantScopedDb,
  organizationId: string,
  currentSettings: OrgSettings,
  job: ImportJob,
): Promise<void> {
  const jobs = currentSettings.importJobs ?? {};
  jobs[job.jobId] = job;

  await db.organization.update({
    where: { id: organizationId },
    data: {
      settingsJson: {
        ...currentSettings,
        importJobs: jobs,
      } as unknown as Prisma.InputJsonValue,
    },
  });
}

// ---------------------------------------------------------------------------
// onboardingImport Router
// ---------------------------------------------------------------------------

// onboardingImport: Cross-tool import wizard -- source discovery, user merge, project import, async progress
export const onboardingImportRouter = router({
  /**
   * Lists all 4 supported integration sources with their connection status.
   */
  listSources: tenantProcedure.use(requireTier('PRO')).query(async ({ ctx }) => {
    const connections = await ctx.db.integrationConnection.findMany({
      where: { organizationId: ctx.organizationId },
      select: { provider: true, status: true, credentialsRef: true },
    });

    const connMap = new Map(connections.map(c => [c.provider, c]));

    return ALL_PROVIDERS.map(provider => {
      const conn = connMap.get(provider);
      return {
        provider,
        connected: conn?.status === 'CONNECTED' && !!conn.credentialsRef,
        selected: false,
      };
    });
  }),

  /**
   * Fetches users from selected sources, merges by email, detects conflicts.
   */
  fetchPeople: tenantProcedure
    .use(requireTier('PRO'))
    .input(fetchPeopleInputSchema)
    .query(async ({ ctx, input }) => {
      const allSourcePeople: Array<{
        email: string;
        name: string;
        source: 'JIRA' | 'LINEAR' | 'GOOGLE_WORKSPACE' | 'SLACK';
        avatarUrl?: string;
        metadata?: Record<string, unknown>;
      }> = [];

      // Fetch from each requested source using Promise.allSettled
      const results = await Promise.allSettled(
        input.sources.map(async source => {
          const connection = await ctx.db.integrationConnection.findFirst({
            where: {
              organizationId: ctx.organizationId,
              provider: source,
              status: 'CONNECTED',
            },
          });

          if (!connection) return [];

          const credentials = decryptCredentials(
            connection.credentialsRef,
            connection.provider.toLowerCase(),
          );

          return fetchUsersFromSource(source, credentials.accessToken, connection.configJson);
        }),
      );

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          allSourcePeople.push(...result.value);
        }
      }

      // Get existing org members
      const org = await authApi.getFullOrganization({
        headers: ctx.headers,
        query: { organizationId: ctx.organizationId },
      });

      const existingEmails = new Set(
        (org?.members ?? []).map(
          (m: Record<string, unknown>) =>
            ((m.user as Record<string, unknown>)?.email as string)?.toLowerCase() ?? '',
        ),
      );

      return mergeByEmail(allSourcePeople, existingEmails);
    }),

  /**
   * Fetches projects from Jira and teams from Linear with their statuses.
   */
  fetchProjects: tenantProcedure
    .use(requireTier('PRO'))
    .input(z.object({ sources: z.array(sourceProviderSchema) }))
    .query(async ({ ctx, input }) => {
      const projects: Array<{
        sourceProvider: string;
        externalId: string;
        name: string;
        statuses: Array<{ id: string; name: string; color?: string }>;
      }> = [];

      for (const source of input.sources) {
        const connection = await ctx.db.integrationConnection.findFirst({
          where: {
            organizationId: ctx.organizationId,
            provider: source,
            status: 'CONNECTED',
          },
        });

        if (!connection) continue;

        const credentials = decryptCredentials(
          connection.credentialsRef,
          connection.provider.toLowerCase(),
        );

        if (source === 'JIRA') {
          const config = connection.configJson as ConnectionConfig;
          if (!config?.cloudId) continue;

          const baseUrl = `https://api.atlassian.com/ex/jira/${config.cloudId}/rest/api/3`;
          const headers = {
            Authorization: `Bearer ${credentials.accessToken}`,
            Accept: 'application/json',
          };

          // Fetch projects
          const projResponse = await fetch(`${baseUrl}/project`, { headers });
          if (!projResponse.ok) continue;

          const jiraProjects = (await projResponse.json()) as Array<{
            id: string;
            key: string;
            name: string;
          }>;

          // Fetch statuses per project
          for (const proj of jiraProjects) {
            const statusResponse = await fetch(`${baseUrl}/project/${proj.id}/statuses`, {
              headers,
            });

            if (!statusResponse.ok) continue;

            const statusData = (await statusResponse.json()) as Array<{
              id: string;
              statuses: Array<{
                id: string;
                name: string;
                statusCategory?: { colorName?: string };
              }>;
            }>;

            // Flatten and deduplicate statuses across issue types
            const statusMap = new Map<string, { id: string; name: string; color?: string }>();

            for (const issueType of statusData) {
              for (const status of issueType.statuses) {
                if (!statusMap.has(status.id)) {
                  statusMap.set(status.id, {
                    id: status.id,
                    name: status.name,
                    color: status.statusCategory?.colorName,
                  });
                }
              }
            }

            projects.push({
              sourceProvider: 'JIRA',
              externalId: proj.id,
              name: proj.name,
              statuses: [...statusMap.values()],
            });
          }
        } else if (source === 'LINEAR') {
          const data = await linearGraphQL<{
            teams: {
              nodes: Array<{
                id: string;
                name: string;
                key: string;
                states: {
                  nodes: Array<{
                    id: string;
                    name: string;
                    type: string;
                    color: string;
                    position: number;
                  }>;
                };
              }>;
            };
          }>(
            credentials.accessToken,
            `{
              teams {
                nodes {
                  id name key
                  states { nodes { id name type color position } }
                }
              }
            }`,
          );

          for (const team of data.teams.nodes) {
            projects.push({
              sourceProvider: 'LINEAR',
              externalId: team.id,
              name: team.name,
              statuses: team.states.nodes.map(s => ({
                id: s.id,
                name: s.name,
                color: s.color,
              })),
            });
          }
        }
      }

      return projects;
    }),

  /**
   * Starts the import process: creates invitations for people and
   * workflow templates from projects. Tracks progress in settings metadata.
   */
  startImport: tenantProcedure
    .use(requireTier('PRO'))
    .input(startImportInputSchema)
    .mutation(async ({ ctx, input }) => {
      const jobId = randomUUID();
      const nonSkippedPeople = input.people.filter(p => !p.skip);
      const nonSkippedProjects = input.projects.filter(p => !p.skip);
      const totalItems = nonSkippedPeople.length + nonSkippedProjects.length;

      const { settings } = await getOrgSettings(ctx.db, ctx.organizationId);

      const job: ImportJob = {
        jobId,
        status: 'processing',
        totalItems,
        completedItems: 0,
        failedItems: [],
      };

      await updateImportJob(ctx.db, ctx.organizationId, settings, job);

      // Process people - create invitations
      for (const person of nonSkippedPeople) {
        try {
          await authApi.createInvitation({
            headers: ctx.headers,
            body: {
              email: person.email,
              role: person.role as
                | 'admin'
                | 'owner'
                | 'finance_admin'
                | 'ops_manager'
                | 'team_manager'
                | 'legal_compliance_viewer'
                | 'it_admin'
                | 'external_accountant'
                | 'readonly',
              organizationId: ctx.organizationId,
            },
          });
          job.completedItems++;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          job.failedItems.push({ email: person.email, error: message, role: person.role });
        }
      }

      // Process projects - create workflow templates
      if (nonSkippedProjects.length > 0) {
        try {
          await createWorkflowTemplatesFromProjects({
            projects: nonSkippedProjects,
            organizationId: ctx.organizationId,
            createdByUserId: ctx.user?.id,
          });
          job.completedItems += nonSkippedProjects.length;
        } catch (error) {
          // Count project failures individually
          for (const proj of nonSkippedProjects) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            job.failedItems.push({
              email: `project:${proj.externalId}`,
              error: message,
              role: 'readonly',
            });
          }
        }
      }

      // Determine final status
      if (job.failedItems.length === totalItems) {
        job.status = 'failed';
      } else {
        job.status = 'completed';
      }

      // Re-read settings to avoid overwriting concurrent changes
      const { settings: freshSettings } = await getOrgSettings(ctx.db, ctx.organizationId);
      await updateImportJob(ctx.db, ctx.organizationId, freshSettings, job);

      return { jobId };
    }),

  /**
   * Returns the progress of an import job by jobId.
   */
  getProgress: tenantProcedure
    .use(requireTier('PRO'))
    .input(z.object({ jobId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { settings } = await getOrgSettings(ctx.db, ctx.organizationId);
      const job = settings.importJobs?.[input.jobId];

      if (!job) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Import job ${input.jobId} not found`,
        });
      }

      return job;
    }),

  /**
   * Retries a single failed item from an import job.
   */
  retryFailedItem: tenantProcedure
    .use(requireTier('PRO'))
    .input(retryItemInputSchema)
    .mutation(async ({ ctx, input }) => {
      const { settings } = await getOrgSettings(ctx.db, ctx.organizationId);

      const job = settings.importJobs?.[input.jobId];

      if (!job) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Import job ${input.jobId} not found`,
        });
      }

      const failedIndex = job.failedItems.findIndex(item => item.email === input.email);

      if (failedIndex === -1) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Failed item ${input.email} not found in job ${input.jobId}`,
        });
      }

      // Retry the invitation with the original role
      const failedItem = job.failedItems[failedIndex]!;
      try {
        await authApi.createInvitation({
          headers: ctx.headers,
          body: {
            email: input.email,
            role: (failedItem.role || 'readonly') as
              | 'admin'
              | 'owner'
              | 'finance_admin'
              | 'ops_manager'
              | 'team_manager'
              | 'legal_compliance_viewer'
              | 'it_admin'
              | 'external_accountant'
              | 'readonly',
            organizationId: ctx.organizationId,
          },
        });

        // Remove from failed, increment completed
        job.failedItems.splice(failedIndex, 1);
        job.completedItems++;

        await updateImportJob(ctx.db, ctx.organizationId, settings, job);

        return { success: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';

        // Update the error message
        job.failedItems[failedIndex]!.error = message;
        await updateImportJob(ctx.db, ctx.organizationId, settings, job);

        return { success: false, error: message };
      }
    }),
});
