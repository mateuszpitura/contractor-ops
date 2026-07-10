// Incident router — operator-authored incident history behind the public status
// page. Global platform resource, gated on the platform-operator
// `admin:marketplace` permission (the same developer-experience operator cohort
// that owns the marketplace + status surfaces). Every mutation is audited.

import { createLogger } from '@contractor-ops/logger';
import { entityIdSchema } from '@contractor-ops/validators';
import { z } from 'zod';
import { router } from '../../init';
import { findOrThrow } from '../../lib/find-or-throw';
import { requirePermission } from '../../middleware/rbac';
import { tenantProcedure } from '../../middleware/tenant';
import { writeAuditLog } from '../../services/audit-writer';

const log = createLogger({ service: 'incident-router' });

export const INCIDENT_STATUSES = ['OPEN', 'MONITORING', 'RESOLVED'] as const;
export const INCIDENT_SEVERITIES = ['MINOR', 'MAJOR', 'CRITICAL'] as const;

const STATUS_COMPONENTS = ['api', 'webhooks-dispatcher', 'background-jobs'] as const;

const createInput = z.object({
  title: z.string().min(1).max(200),
  severity: z.enum(INCIDENT_SEVERITIES),
  componentsAffected: z.array(z.enum(STATUS_COMPONENTS)).min(1),
  message: z.string().min(1).max(4000).optional(),
});

const addUpdateInput = z.object({
  id: z.string(),
  message: z.string().min(1).max(4000),
  status: z.enum(INCIDENT_STATUSES).optional(),
});

type IncidentUpdateEntry = { at: string; message: string };

function appendUpdate(existing: unknown, message: string): IncidentUpdateEntry[] {
  const prior = Array.isArray(existing) ? (existing as IncidentUpdateEntry[]) : [];
  return [...prior, { at: new Date().toISOString(), message }];
}

export const incidentRouter = router({
  /**
   * All incidents, newest first (open + resolved) for the operator dashboard.
   */
  list: tenantProcedure
    .use(requirePermission({ 'admin:marketplace': ['read'] }))
    .query(async ({ ctx }) => {
      return ctx.db.incidentReport.findMany({ orderBy: { startedAt: 'desc' }, take: 100 });
    }),

  /**
   * Open a new incident with an optional opening update. Audited.
   */
  create: tenantProcedure
    .use(requirePermission({ 'admin:marketplace': ['write'] }))
    .input(createInput)
    .mutation(async ({ ctx, input }) => {
      const created = await ctx.db.incidentReport.create({
        data: {
          title: input.title,
          severity: input.severity,
          componentsAffected: input.componentsAffected,
          updates: input.message ? appendUpdate([], input.message) : [],
          createdByUserId: ctx.user?.id ?? null,
          updatedByUserId: ctx.user?.id ?? null,
        },
      });

      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user?.id ?? null,
        actorName: ctx.user?.name ?? null,
        action: 'incident.create',
        resourceType: 'INCIDENT',
        resourceId: created.id,
        resourceName: created.title,
        newValues: {
          severity: created.severity,
          componentsAffected: created.componentsAffected,
          status: created.status,
        },
      });

      log.info({ incidentId: created.id, severity: created.severity }, 'incident opened');
      return created;
    }),

  /**
   * Append a timeline update and optionally advance the incident status.
   * Setting status RESOLVED stamps `resolvedAt`. Audited.
   */
  addUpdate: tenantProcedure
    .use(requirePermission({ 'admin:marketplace': ['write'] }))
    .input(addUpdateInput)
    .mutation(async ({ ctx, input }) => {
      const existing = await findOrThrow(
        () => ctx.db.incidentReport.findUnique({ where: { id: input.id } }),
        'INCIDENT_NOT_FOUND',
      );

      const nextStatus = input.status ?? existing.status;
      const updated = await ctx.db.incidentReport.update({
        where: { id: input.id },
        data: {
          updates: appendUpdate(existing.updates, input.message),
          ...(input.status !== undefined && { status: input.status }),
          ...(nextStatus === 'RESOLVED' && !existing.resolvedAt && { resolvedAt: new Date() }),
          updatedByUserId: ctx.user?.id ?? null,
        },
      });

      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user?.id ?? null,
        actorName: ctx.user?.name ?? null,
        action: 'incident.update',
        resourceType: 'INCIDENT',
        resourceId: updated.id,
        resourceName: updated.title,
        oldValues: { status: existing.status },
        newValues: { status: updated.status },
      });

      return updated;
    }),

  /**
   * Resolve an incident (convenience over addUpdate with a closing note). Audited.
   */
  resolve: tenantProcedure
    .use(requirePermission({ 'admin:marketplace': ['write'] }))
    .input(entityIdSchema.extend({ message: z.string().min(1).max(4000).optional() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await findOrThrow(
        () => ctx.db.incidentReport.findUnique({ where: { id: input.id } }),
        'INCIDENT_NOT_FOUND',
      );

      const updated = await ctx.db.incidentReport.update({
        where: { id: input.id },
        data: {
          status: 'RESOLVED',
          resolvedAt: existing.resolvedAt ?? new Date(),
          updates: appendUpdate(existing.updates, input.message ?? 'Resolved.'),
          updatedByUserId: ctx.user?.id ?? null,
        },
      });

      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user?.id ?? null,
        actorName: ctx.user?.name ?? null,
        action: 'incident.resolve',
        resourceType: 'INCIDENT',
        resourceId: updated.id,
        resourceName: updated.title,
        oldValues: { status: existing.status },
        newValues: { status: 'RESOLVED' },
      });

      log.info({ incidentId: updated.id }, 'incident resolved');
      return updated;
    }),
});
