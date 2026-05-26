// ---------------------------------------------------------------------------
// Organization Definitions — Project router
// ---------------------------------------------------------------------------
// CRUD over the Project table + integration-sync helpers used by the
// /organization/projects page (manual "Sync now" + Pending Merges inbox).

import {
  orgDefinitionArchiveSchema,
  projectCreateSchema,
  projectListSchema,
  projectMergeResolveSchema,
  projectSyncSchema,
  projectUpdateSchema,
} from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { router } from '../../init';
import { cursorClause, paginateByLastKept } from '../../lib/pagination';
import { requirePermission } from '../../middleware/rbac';
import { tenantProcedure } from '../../middleware/tenant';
import { writeAuditLog } from '../../services/audit-writer';
import type { SyncableIntegrationConnection } from '../../services/org-definition-sync';
import {
  syncJiraProjectsToOrgDefinitions,
  syncLinearTeamsToOrgDefinitions,
} from '../../services/org-definition-sync';

export const projectRouter = router({
  list: tenantProcedure
    .use(requirePermission({ project: ['read'] }))
    .input(projectListSchema.optional())
    .query(async ({ ctx, input }) => {
      const status = input?.status;
      const source = input?.source;
      const teamId = input?.teamId;
      const search = input?.search;

      const rows = await ctx.db.project.findMany({
        where: {
          ...(status ? { status } : {}),
          ...(source ? { source } : {}),
          ...(teamId ? { teamId } : {}),
          ...(search
            ? {
                OR: [
                  { name: { contains: search, mode: 'insensitive' as const } },
                  { code: { contains: search, mode: 'insensitive' as const } },
                ],
              }
            : {}),
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        ...cursorClause(input),
        select: {
          id: true,
          name: true,
          code: true,
          teamId: true,
          status: true,
          startDate: true,
          endDate: true,
          budgetMinor: true,
          budgetCurrency: true,
          source: true,
          externalId: true,
          updatedAt: true,
        },
      });

      return paginateByLastKept(rows, input);
    }),

  get: tenantProcedure
    .use(requirePermission({ project: ['read'] }))
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const project = await ctx.db.project.findFirst({ where: { id: input.id } });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      return project;
    }),

  create: tenantProcedure
    .use(requirePermission({ project: ['create'] }))
    .input(projectCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const created = await ctx.db.project.create({
        data: {
          organizationId: ctx.organizationId,
          name: input.name,
          code: input.code,
          teamId: input.teamId,
          status: input.status,
          startDate: input.startDate,
          endDate: input.endDate,
          budgetMinor: input.budgetMinor,
          budgetCurrency: input.budgetCurrency,
          source: 'MANUAL',
        },
      });
      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user?.id ?? null,
        action: 'project.create',
        resourceType: 'PROJECT',
        resourceId: created.id,
        resourceName: created.name,
        newValues: { name: created.name, code: created.code ?? null, status: created.status },
      });
      return created;
    }),

  update: tenantProcedure
    .use(requirePermission({ project: ['update'] }))
    .input(projectUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;
      const before = await ctx.db.project.findFirst({ where: { id } });
      if (!before) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });

      const updated = await ctx.db.project.update({
        where: { id },
        data: {
          ...rest,
          ...(rest.startDate === undefined ? {} : { startDate: rest.startDate }),
          ...(rest.endDate === undefined ? {} : { endDate: rest.endDate }),
        },
      });
      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user?.id ?? null,
        action: 'project.update',
        resourceType: 'PROJECT',
        resourceId: id,
        resourceName: updated.name,
        oldValues: { name: before.name, status: before.status, code: before.code ?? null },
        newValues: { name: updated.name, status: updated.status, code: updated.code ?? null },
      });
      return updated;
    }),

  archive: tenantProcedure
    .use(requirePermission({ project: ['archive'] }))
    .input(orgDefinitionArchiveSchema)
    .mutation(async ({ ctx, input }) => {
      const before = await ctx.db.project.findFirst({ where: { id: input.id } });
      if (!before) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });

      const updated = await ctx.db.project.update({
        where: { id: input.id },
        data: { status: 'ARCHIVED' },
      });
      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user?.id ?? null,
        action: 'project.archive',
        resourceType: 'PROJECT',
        resourceId: input.id,
        resourceName: updated.name,
        oldValues: { status: before.status },
        newValues: { status: updated.status },
      });
      return updated;
    }),

  // -------------------------------------------------------------------------
  // Integration sync — manual "Sync now"
  // -------------------------------------------------------------------------

  /** Connected Jira / Linear integrations for the "Sync now" button row. */
  listSyncableConnections: tenantProcedure
    .use(requirePermission({ project: ['read'] }))
    .query(async ({ ctx }) => {
      const rows = await ctx.db.integrationConnection.findMany({
        where: {
          status: 'CONNECTED',
          provider: { in: ['JIRA', 'LINEAR'] },
        },
        select: { id: true, provider: true, displayName: true, lastSyncAt: true },
        orderBy: { connectedAt: 'asc' },
      });
      return rows;
    }),

  sync: tenantProcedure
    .use(requirePermission({ project: ['create'] }))
    .input(projectSyncSchema)
    .mutation(async ({ ctx, input }) => {
      const connection = await ctx.db.integrationConnection.findFirst({
        where: {
          id: input.connectionId,
          organizationId: ctx.organizationId,
          status: 'CONNECTED',
        },
      });
      if (!connection || (connection.provider !== 'JIRA' && connection.provider !== 'LINEAR')) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Integration connection not found or unsupported provider',
        });
      }

      const syncable: SyncableIntegrationConnection = {
        id: connection.id,
        organizationId: connection.organizationId,
        provider: connection.provider,
        credentialsRef: connection.credentialsRef,
        configJson: connection.configJson as SyncableIntegrationConnection['configJson'],
      };

      const result =
        connection.provider === 'JIRA'
          ? await syncJiraProjectsToOrgDefinitions(
              { db: ctx.db, actorUserId: ctx.user?.id ?? null },
              syncable,
            )
          : await syncLinearTeamsToOrgDefinitions(
              { db: ctx.db, actorUserId: ctx.user?.id ?? null },
              syncable,
            );

      return result;
    }),

  // -------------------------------------------------------------------------
  // Pending merges inbox
  // -------------------------------------------------------------------------

  pendingMerges: tenantProcedure
    .use(requirePermission({ project: ['read'] }))
    .query(async ({ ctx }) => {
      const rows = await ctx.db.pendingProjectMerge.findMany({
        orderBy: { createdAt: 'asc' },
      });
      if (rows.length === 0) return { items: [], candidates: [] };

      const candidateIds = [...new Set(rows.flatMap(r => r.candidateProjectIds))];
      const candidates = await ctx.db.project.findMany({
        where: { id: { in: candidateIds } },
        select: { id: true, name: true, status: true, source: true },
      });
      return { items: rows, candidates };
    }),

  // Merge resolution adds the new (source, externalId) to ProjectExternalLink
  // but DOES NOT mutate `Project.source` / `Project.externalId` — those
  // columns are pinned to the first source. See organization.prisma for the
  // INVARIANT comment on the Project model.
  resolveMerge: tenantProcedure
    .use(requirePermission({ project: ['update'] }))
    .input(projectMergeResolveSchema)
    .mutation(async ({ ctx, input }) => {
      const pending = await ctx.db.pendingProjectMerge.findFirst({
        where: { id: input.pendingMergeId },
      });
      if (!pending) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Pending merge not found' });
      }

      if (input.action === 'merge') {
        const mergeTargetId = input.mergeIntoProjectId;
        if (!mergeTargetId) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'mergeIntoProjectId required for merge action',
          });
        }
        if (!pending.candidateProjectIds.includes(mergeTargetId)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'mergeIntoProjectId must be one of the suggested candidates',
          });
        }

        await ctx.db.$transaction(async tx => {
          await tx.projectExternalLink.create({
            data: {
              organizationId: ctx.organizationId,
              projectId: mergeTargetId,
              source: pending.source,
              externalId: pending.externalId,
            },
          });
          await tx.pendingProjectMerge.delete({ where: { id: pending.id } });
        });

        await writeAuditLog({
          organizationId: ctx.organizationId,
          actorType: 'USER',
          actorId: ctx.user?.id ?? null,
          action: 'project.merge.resolve',
          resourceType: 'PROJECT',
          resourceId: mergeTargetId,
          newValues: { source: pending.source, externalId: pending.externalId },
        });
        return { action: 'merge', projectId: mergeTargetId };
      }

      // action === 'keep' → create a fresh Project and link, then drop the pending row.
      const created = await ctx.db.$transaction(async tx => {
        const project = await tx.project.create({
          data: {
            organizationId: ctx.organizationId,
            name: pending.incomingName,
            source: pending.source,
            externalId: pending.externalId,
          },
        });
        await tx.projectExternalLink.create({
          data: {
            organizationId: ctx.organizationId,
            projectId: project.id,
            source: pending.source,
            externalId: pending.externalId,
          },
        });
        await tx.pendingProjectMerge.delete({ where: { id: pending.id } });
        return project;
      });

      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user?.id ?? null,
        action: 'project.merge.keep',
        resourceType: 'PROJECT',
        resourceId: created.id,
        resourceName: created.name,
        newValues: { source: pending.source, externalId: pending.externalId },
      });
      return { action: 'keep', projectId: created.id };
    }),
});
