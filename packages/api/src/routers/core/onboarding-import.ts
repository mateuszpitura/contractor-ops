import { randomUUID } from 'node:crypto';
import { authApi } from '@contractor-ops/auth';
import type { Prisma } from '@contractor-ops/db';
import {
  decryptCredentials,
  fetchJiraProjects,
  fetchLinearTeams,
} from '@contractor-ops/integrations';
import { createIntegrationLogger } from '@contractor-ops/logger';
import type {
  FetchPeopleSourceError,
  ImportedProject,
  InvitableMemberRole,
  StartImportInput,
} from '@contractor-ops/validators';
import {
  fetchPeopleInputSchema,
  fetchPeopleOutputSchema,
  fetchProjectsInputSchema,
  fetchProjectsOutputSchema,
  importProgressOutputSchema,
  listSourcesOutputSchema,
  retryItemInputSchema,
  retryItemOutputSchema,
  startImportInputSchema,
} from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import * as E from '../../errors';
import { router } from '../../init';
import type { TenantScopedDb } from '../../lib/tenant-db';
import { requirePermission } from '../../middleware/rbac';
import { tenantProcedure } from '../../middleware/tenant';
import { requireTier } from '../../middleware/tier';
import type { SourcePerson } from '../../services/onboarding-import-service';
import {
  createWorkflowTemplatesFromProjects,
  fetchUsersFromSource,
  mergeByEmail,
} from '../../services/onboarding-import-service';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALL_PROVIDERS = ['JIRA', 'LINEAR', 'GOOGLE_WORKSPACE', 'SLACK'] as const;

const fetchPeopleLog = createIntegrationLogger('onboarding-import.fetchPeople');
const fetchProjectsLog = createIntegrationLogger('onboarding-import.fetchProjects');

const SOURCE_NOT_CONNECTED_MESSAGE = 'Integration not connected';
const SOURCE_FETCH_FAILED_MESSAGE = 'Failed to fetch from this source';

function isIntegrationReady(
  connection: { status: string; credentialsRef: string | null } | null | undefined,
): connection is { status: string; credentialsRef: string } {
  return connection?.status === 'CONNECTED' && !!connection.credentialsRef;
}

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
  failedItems: Array<{ email: string; error: string; role: InvitableMemberRole }>;
}

interface OrgSettings {
  importJobs?: Record<string, ImportJob>;
  importJobsRevision?: number;
  [key: string]: unknown;
}

async function readOrgSettings(db: TenantScopedDb, organizationId: string): Promise<OrgSettings> {
  const org = await db.organization.findFirst({
    where: { id: organizationId },
    select: { settingsJson: true },
  });
  return (org?.settingsJson as OrgSettings) ?? {};
}

async function patchImportJobsSettings(
  db: TenantScopedDb,
  organizationId: string,
  mutate: (settings: OrgSettings) => OrgSettings,
  options?: { expectedRevision?: number },
): Promise<OrgSettings> {
  return db.$transaction(async tx => {
    const org = await tx.organization.findFirstOrThrow({
      where: { id: organizationId },
      select: { settingsJson: true },
    });
    const current = (org.settingsJson as OrgSettings) ?? {};
    const revision = current.importJobsRevision ?? 0;

    if (options?.expectedRevision !== undefined && revision !== options.expectedRevision) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: E.IMPORT_JOB_STATE_CONFLICT,
      });
    }

    const next = mutate(current);
    next.importJobsRevision = revision + 1;

    await tx.organization.update({
      where: { id: organizationId },
      data: {
        settingsJson: next as unknown as Prisma.InputJsonValue,
      },
    });

    return next;
  });
}

async function upsertImportJob(
  db: TenantScopedDb,
  organizationId: string,
  job: ImportJob,
  expectedRevision?: number,
): Promise<void> {
  await patchImportJobsSettings(
    db,
    organizationId,
    settings => {
      const jobs = { ...(settings.importJobs ?? {}) };
      jobs[job.jobId] = job;
      return { ...settings, importJobs: jobs };
    },
    expectedRevision === undefined ? undefined : { expectedRevision },
  );
}

// ---------------------------------------------------------------------------
// Project fetching helpers
// ---------------------------------------------------------------------------
//
// The Jira / Linear HTTP fetchers used to live inline here. They were extracted
// into `@contractor-ops/integrations` (`jira-projects-client`, `linear-teams-
// client`) so the org-definitions sync job and this onboarding-import wizard
// share the same OAuth + rate-limit surface. Local wrappers below adapt the
// shared shape (`{ externalId, name, key, statuses }`) to the wizard's
// existing `{ sourceProvider, externalId, name, statuses }` payload so callers
// stay untouched.

async function fetchJiraProjectsForWizard(
  accessToken: string,
  cloudId: string,
): Promise<ImportedProject[]> {
  const projects = await fetchJiraProjects(
    accessToken,
    { cloudId },
    {
      includeStatuses: true,
    },
  );
  return projects.map(p => ({
    sourceProvider: 'JIRA' as const,
    externalId: p.externalId,
    name: p.name,
    statuses: p.statuses,
  }));
}

async function fetchLinearProjectsForWizard(accessToken: string): Promise<ImportedProject[]> {
  const teams = await fetchLinearTeams(accessToken, { includeStates: true });
  return teams.map(team => ({
    sourceProvider: 'LINEAR' as const,
    externalId: team.externalId,
    name: team.name,
    statuses: team.states.map(s => ({ id: s.id, name: s.name, color: s.color })),
  }));
}

// ---------------------------------------------------------------------------
// Import processing helpers
// ---------------------------------------------------------------------------

/**
 * Processes people invitations and tracks results on the job object.
 */
async function processPeopleImport(
  headers: Headers,
  organizationId: string,
  people: StartImportInput['people'],
  job: ImportJob,
) {
  // Issue invites in chunks of 10 in parallel rather than serial.
  // Onboarding 50 users used to take 50× single-call latency; chunked
  // parallelism stays well under Better Auth + Resend rate limits.
  const CHUNK = 10;
  const nonSkipped = people.filter(p => !p.skip);
  for (let i = 0; i < nonSkipped.length; i += CHUNK) {
    const slice = nonSkipped.slice(i, i + CHUNK);
    const results = await Promise.allSettled(
      slice.map(async person => {
        await authApi.createInvitation({
          headers,
          body: {
            email: person.email,
            role: person.role,
            organizationId,
          },
        });
        return person;
      }),
    );
    for (const [j, r] of results.entries()) {
      const person = slice[j];
      if (!person) continue;
      if (r.status === 'fulfilled') {
        job.completedItems++;
      } else {
        const message =
          r.reason instanceof Error ? r.reason.message : String(r.reason ?? 'Unknown error');
        job.failedItems.push({ email: person.email, error: message, role: person.role });
      }
    }
  }
}

/**
 * Processes project imports and tracks results on the job object.
 */
async function processProjectImport(
  db: TenantScopedDb,
  projects: StartImportInput['projects'],
  organizationId: string,
  createdByUserId: string,
  job: ImportJob,
) {
  const nonSkipped = projects.filter(p => !p.skip);
  for (const proj of nonSkipped) {
    try {
      await createWorkflowTemplatesFromProjects({
        db,
        projects: [proj],
        organizationId,
        createdByUserId,
      });
      job.completedItems++;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      job.failedItems.push({
        email: `project:${proj.externalId}`,
        error: message,
        role: 'readonly',
      });
    }
  }
}

// ---------------------------------------------------------------------------
// onboardingImport Router
// ---------------------------------------------------------------------------

// onboardingImport: Cross-tool import wizard -- source discovery, user merge, project import, async progress
export const onboardingImportRouter = router({
  /**
   * Lists all 4 supported integration sources with their connection status.
   */
  listSources: tenantProcedure
    .use(requireTier('PRO'))
    .use(requirePermission({ settings: ['read'] }))
    .output(listSourcesOutputSchema)
    .query(async ({ ctx }) => {
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
    .use(requirePermission({ settings: ['read'] }))
    .input(fetchPeopleInputSchema)
    .output(fetchPeopleOutputSchema)
    .query(async ({ ctx, input }) => {
      const allSourcePeople: SourcePerson[] = [];
      const sourceErrors: FetchPeopleSourceError[] = [];

      const fetchResults = await Promise.all(
        input.sources.map(async source => {
          try {
            const connection = await ctx.db.integrationConnection.findFirst({
              where: {
                organizationId: ctx.organizationId,
                provider: source,
                status: 'CONNECTED',
              },
            });

            if (!isIntegrationReady(connection)) {
              return {
                source,
                users: [] as SourcePerson[],
                error: {
                  code: 'not_connected' as const,
                  error: SOURCE_NOT_CONNECTED_MESSAGE,
                },
              };
            }

            const credentials = decryptCredentials(
              connection.credentialsRef,
              connection.provider.toLowerCase(),
            );

            const users = await fetchUsersFromSource(
              source,
              credentials.accessToken,
              connection.configJson,
            );
            return { source, users, error: undefined };
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            fetchPeopleLog.warn(
              { organizationId: ctx.organizationId, source, error: message },
              'fetchPeople source failed',
            );
            return {
              source,
              users: [] as SourcePerson[],
              error: { code: 'fetch_failed' as const, error: SOURCE_FETCH_FAILED_MESSAGE },
            };
          }
        }),
      );

      for (const result of fetchResults) {
        allSourcePeople.push(...result.users);
        if (result.error) {
          sourceErrors.push({
            source: result.source,
            code: result.error.code,
            error: result.error.error,
          });
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

      return {
        people: mergeByEmail(allSourcePeople, existingEmails),
        sourceErrors,
      };
    }),

  /**
   * Fetches projects from Jira and teams from Linear with their statuses.
   */
  fetchProjects: tenantProcedure
    .use(requireTier('PRO'))
    .use(requirePermission({ settings: ['read'] }))
    .input(fetchProjectsInputSchema)
    .output(fetchProjectsOutputSchema)
    .query(async ({ ctx, input }) => {
      const allProjects: ImportedProject[] = [];
      const sourceErrors: FetchPeopleSourceError[] = [];

      const pmSources = input.sources.filter(
        (s): s is 'JIRA' | 'LINEAR' => s === 'JIRA' || s === 'LINEAR',
      );

      const fetchResults = await Promise.all(
        pmSources.map(async source => {
          try {
            const connection = await ctx.db.integrationConnection.findFirst({
              where: {
                organizationId: ctx.organizationId,
                provider: source,
                status: 'CONNECTED',
              },
            });

            if (!isIntegrationReady(connection)) {
              return {
                source,
                projects: [] as ImportedProject[],
                error: {
                  code: 'not_connected' as const,
                  error: SOURCE_NOT_CONNECTED_MESSAGE,
                },
              };
            }

            const credentials = decryptCredentials(
              connection.credentialsRef,
              connection.provider.toLowerCase(),
            );

            if (source === 'JIRA') {
              const config = connection.configJson as ConnectionConfig;
              if (!config?.cloudId) {
                fetchProjectsLog.warn(
                  { organizationId: ctx.organizationId, source },
                  'fetchProjects Jira missing cloudId in connection config',
                );
                return {
                  source,
                  projects: [] as ImportedProject[],
                  error: {
                    code: 'fetch_failed' as const,
                    error: SOURCE_FETCH_FAILED_MESSAGE,
                  },
                };
              }
              const jiraResults = await fetchJiraProjectsForWizard(
                credentials.accessToken,
                config.cloudId,
              );
              return { source, projects: jiraResults, error: undefined };
            }

            const linearResults = await fetchLinearProjectsForWizard(credentials.accessToken);
            return { source, projects: linearResults, error: undefined };
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            fetchProjectsLog.warn(
              { organizationId: ctx.organizationId, source, error: message },
              'fetchProjects source failed',
            );
            return {
              source,
              projects: [] as ImportedProject[],
              error: { code: 'fetch_failed' as const, error: SOURCE_FETCH_FAILED_MESSAGE },
            };
          }
        }),
      );

      for (const result of fetchResults) {
        allProjects.push(...result.projects);
        if (result.error) {
          sourceErrors.push({
            source: result.source,
            code: result.error.code,
            error: result.error.error,
          });
        }
      }

      return { projects: allProjects, sourceErrors };
    }),

  /**
   * Starts the import process: creates invitations for people and
   * workflow templates from projects. Tracks progress in settings metadata.
   */
  startImport: tenantProcedure
    .use(requireTier('PRO'))
    .use(requirePermission({ member: ['create'], workflow: ['update'] }))
    .input(startImportInputSchema)
    .mutation(async ({ ctx, input }) => {
      const jobId = randomUUID();
      const nonSkippedPeople = input.people.filter(p => !p.skip);
      const nonSkippedProjects = input.projects.filter(p => !p.skip);
      const totalItems = nonSkippedPeople.length + nonSkippedProjects.length;

      const job: ImportJob = {
        jobId,
        status: 'processing',
        totalItems,
        completedItems: 0,
        failedItems: [],
      };

      await upsertImportJob(ctx.db, ctx.organizationId, job);

      // Process people and projects
      await processPeopleImport(ctx.headers, ctx.organizationId, input.people, job);

      if (nonSkippedProjects.length > 0) {
        const createdByUserId = ctx.user?.id;
        if (!createdByUserId) {
          throw new TRPCError({ code: 'UNAUTHORIZED' });
        }
        await processProjectImport(
          ctx.db,
          input.projects,
          ctx.organizationId,
          createdByUserId,
          job,
        );
      }

      // Determine final status
      if (job.failedItems.length === totalItems) {
        job.status = 'failed';
      } else {
        job.status = 'completed';
      }

      await upsertImportJob(ctx.db, ctx.organizationId, job);

      return { jobId };
    }),

  /**
   * Returns the progress of an import job by jobId.
   */
  getProgress: tenantProcedure
    .use(requireTier('PRO'))
    .use(requirePermission({ settings: ['read'] }))
    .input(z.object({ jobId: z.string() }))
    .output(importProgressOutputSchema)
    .query(async ({ ctx, input }) => {
      const settings = await readOrgSettings(ctx.db, ctx.organizationId);
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
    .use(requirePermission({ member: ['create'] }))
    .input(retryItemInputSchema)
    .output(retryItemOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const settings = await readOrgSettings(ctx.db, ctx.organizationId);
      const revision = settings.importJobsRevision ?? 0;
      const job = settings.importJobs?.[input.jobId];

      if (!job) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Import job ${input.jobId} not found`,
        });
      }

      const failedIndex = job.failedItems.findIndex(item => item.email === input.itemKey);

      if (failedIndex === -1) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Failed item ${input.itemKey} not found in job ${input.jobId}`,
        });
      }

      const failedItem = job.failedItems[failedIndex];
      if (!failedItem) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Failed item at index ${failedIndex} not found`,
        });
      }

      if (failedItem.email.startsWith('project:')) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: E.IMPORT_PROJECT_FAILURE_RETRY_VIA_WIZARD,
        });
      }

      try {
        await authApi.createInvitation({
          headers: ctx.headers,
          body: {
            email: input.itemKey,
            role: (failedItem.role || 'readonly') as InvitableMemberRole,
            organizationId: ctx.organizationId,
          },
        });

        // Remove from failed, increment completed
        job.failedItems.splice(failedIndex, 1);
        job.completedItems++;

        await upsertImportJob(ctx.db, ctx.organizationId, job, revision);

        return { success: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';

        const failedEntry = job.failedItems[failedIndex];
        if (failedEntry) failedEntry.error = message;
        await upsertImportJob(ctx.db, ctx.organizationId, job, revision);

        return { success: false, error: message };
      }
    }),
});
