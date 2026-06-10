// ---------------------------------------------------------------------------
// Organization Definitions — Project router
// ---------------------------------------------------------------------------
// CRUD over the Project table + integration-sync helpers used by the
// /organization/projects page (manual "Sync now" + Pending Merges inbox).

import {
  entityIdSchema,
  orgDefinitionArchiveSchema,
  projectCreateSchema,
  projectListSchema,
  projectMergeResolveSchema,
  projectSyncSchema,
  projectUpdateSchema,
} from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import {
  INTEGRATION_CONNECTION_NOT_FOUND,
  PENDING_MERGE_NOT_FOUND,
  PROJECT_MERGE_ID_NOT_CANDIDATE,
  PROJECT_MERGE_ID_REQUIRED,
  PROJECT_NOT_FOUND,
} from '../../errors';
import { router } from '../../init';
import { auditedMutation, auditMutationCtx } from '../../lib/audited-mutation';
import { cursorClause, paginateByLastKept } from '../../lib/pagination';
import { findTenantFirstOrThrow, tenantScopedWhere } from '../../lib/tenant-find';
import { requirePermission } from '../../middleware/rbac';
import { tenantProcedure } from '../../middleware/tenant';
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
    .input(entityIdSchema)
    .query(async ({ ctx, input }) => {
      return findTenantFirstOrThrow(
        () =>
          ctx.db.project.findFirst({
            where: tenantScopedWhere(ctx, input.id, { softDelete: false }),
          }),
        PROJECT_NOT_FOUND,
      );
    }),

  create: tenantProcedure
    .use(requirePermission({ project: ['create'] }))
    .input(projectCreateSchema)
    .mutation(async ({ ctx, input }) => {
      let created!: Awaited<ReturnType<typeof ctx.db.project.create>>;
      return auditedMutation(
        auditMutationCtx(ctx),
        {
          action: 'project.create',
          resourceType: 'PROJECT',
          get resourceId() {
            return created.id;
          },
          get resourceName() {
            return created.name;
          },
          get newValues() {
            return { name: created.name, code: created.code ?? null, status: created.status };
          },
        },
        async tx => {
          created = await tx.project.create({
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
          return created;
        },
      );
    }),

  update: tenantProcedure
    .use(requirePermission({ project: ['update'] }))
    .input(projectUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;
      const before = await findTenantFirstOrThrow(
        () =>
          ctx.db.project.findFirst({
            where: tenantScopedWhere(ctx, id, { softDelete: false }),
          }),
        PROJECT_NOT_FOUND,
      );

      let updated!: typeof before;
      return auditedMutation(
        auditMutationCtx(ctx),
        {
          action: 'project.update',
          resourceType: 'PROJECT',
          resourceId: id,
          get resourceName() {
            return updated.name;
          },
          oldValues: { name: before.name, status: before.status, code: before.code ?? null },
          get newValues() {
            return { name: updated.name, status: updated.status, code: updated.code ?? null };
          },
        },
        async tx => {
          updated = await tx.project.update({
            where: { id },
            data: {
              ...rest,
              ...(rest.startDate === undefined ? {} : { startDate: rest.startDate }),
              ...(rest.endDate === undefined ? {} : { endDate: rest.endDate }),
            },
          });
          return updated;
        },
      );
    }),

  archive: tenantProcedure
    .use(requirePermission({ project: ['archive'] }))
    .input(orgDefinitionArchiveSchema)
    .mutation(async ({ ctx, input }) => {
      const before = await findTenantFirstOrThrow(
        () =>
          ctx.db.project.findFirst({
            where: tenantScopedWhere(ctx, input.id, { softDelete: false }),
          }),
        PROJECT_NOT_FOUND,
      );

      let updated!: typeof before;
      return auditedMutation(
        auditMutationCtx(ctx),
        {
          action: 'project.archive',
          resourceType: 'PROJECT',
          resourceId: input.id,
          get resourceName() {
            return updated.name;
          },
          oldValues: { status: before.status },
          get newValues() {
            return { status: updated.status };
          },
        },
        async tx => {
          updated = await tx.project.update({
            where: { id: input.id },
            data: { status: 'ARCHIVED' },
          });
          return updated;
        },
      );
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
          message: INTEGRATION_CONNECTION_NOT_FOUND,
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
        throw new TRPCError({ code: 'NOT_FOUND', message: PENDING_MERGE_NOT_FOUND });
      }

      if (input.action === 'merge') {
        const mergeTargetId = input.mergeIntoProjectId;
        if (!mergeTargetId) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: PROJECT_MERGE_ID_REQUIRED,
          });
        }
        if (!pending.candidateProjectIds.includes(mergeTargetId)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: PROJECT_MERGE_ID_NOT_CANDIDATE,
          });
        }

        return auditedMutation(
          auditMutationCtx(ctx),
          {
            action: 'project.merge.resolve',
            resourceType: 'PROJECT',
            resourceId: mergeTargetId,
            newValues: { source: pending.source, externalId: pending.externalId },
          },
          async tx => {
            await tx.projectExternalLink.create({
              data: {
                organizationId: ctx.organizationId,
                projectId: mergeTargetId,
                source: pending.source,
                externalId: pending.externalId,
              },
            });
            await tx.pendingProjectMerge.delete({ where: { id: pending.id } });
            return { action: 'merge' as const, projectId: mergeTargetId };
          },
        );
      }

      // action === 'keep' → create a fresh Project and link, then drop the pending row.
      let created!: Awaited<ReturnType<typeof ctx.db.project.create>>;
      return auditedMutation(
        auditMutationCtx(ctx),
        {
          action: 'project.merge.keep',
          resourceType: 'PROJECT',
          get resourceId() {
            return created.id;
          },
          get resourceName() {
            return created.name;
          },
          newValues: { source: pending.source, externalId: pending.externalId },
        },
        async tx => {
          created = await tx.project.create({
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
              projectId: created.id,
              source: pending.source,
              externalId: pending.externalId,
            },
          });
          await tx.pendingProjectMerge.delete({ where: { id: pending.id } });
          return { action: 'keep' as const, projectId: created.id };
        },
      );
    }),
});
