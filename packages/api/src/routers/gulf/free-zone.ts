// ---------------------------------------------------------------------------
// Free-zone assignment CRUD + per-engagement Saudi fields tRPC router.
// ---------------------------------------------------------------------------
//
// Exposes the FreeZoneAssignment data layer through tenant-scoped,
// Zod-validated, region-aware procedures. All reads/writes go through `ctx.db`
// — the tenant middleware resolves org.dataRegion → getRegionalClient, so ME
// orgs transparently hit the ME database. The Gulf models are NEVER touched
// via the default `prisma`/`prismaRaw` client (lint-region-leakage guard).
//
// Writes compose the FreeZoneAssignment upsert + the out-of-band
// compliance-item write (writeFreeZoneComplianceItem) inside a single
// ctx.db.$transaction so the assignment, its BLOCKING/EXPIRED compliance row,
// and the audit log commit atomically. Mainland assignments arm no
// payment-block gate (the zone narrowing lives in the service write).

import type { Prisma } from '@contractor-ops/db';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import * as E from '../../errors';
import { router } from '../../init';
import { requireFeatureFlag, tenantFlaggedProcedure } from '../../middleware/feature-flag';
import { requirePermission } from '../../middleware/rbac';
import { writeAuditLog } from '../../services/audit-writer';
import type { FreeZoneComplianceClient } from '../../services/free-zone-compliance';
import { writeFreeZoneComplianceItem } from '../../services/free-zone-compliance';

// The 11 recordable UaeFreeZoneCode enum values. Kept as a Zod enum so an
// invalid zone is rejected at the trust boundary.
const uaeFreeZoneCodeEnum = z.enum([
  'DIFC',
  'DMCC',
  'IFZA',
  'DUBAI_INTERNET_CITY',
  'DUBAI_MEDIA_CITY',
  'MEYDAN_FZ',
  'JAFZA',
  'SHAMS',
  'RAKEZ',
  'ADGM',
  'MAINLAND',
]);

const upsertAssignmentSchema = z.object({
  contractorId: z.string().min(1),
  zone: uaeFreeZoneCodeEnum,
  licenseNumber: z.string().trim().max(120).nullish(),
  licenseCategory: z.string().trim().max(120).nullish(),
  /** Calendar expiry date (Asia/Dubai); drives the reminder cascade band math. */
  licenseExpiresAt: z.iso.date().nullish(),
  permittedActivitiesText: z.string().trim().max(4000).nullish(),
  /** Admin-tagged ISIC-style codes that drive the permitted-activity scope check. */
  permittedActivityIsicCodes: z.array(z.string().trim().min(1).max(32)).max(200).default([]),
});

const setSaudiAssignmentFieldsSchema = z.object({
  assignmentId: z.string().min(1),
  isSaudi: z.boolean().nullish(),
  /** ISO 3166-1 alpha-2. */
  nationality: z.string().trim().length(2).toUpperCase().nullish(),
  qiwaContractAuthenticated: z.boolean().nullish(),
});

export const freeZoneRouter = router({
  /**
   * Read a contractor's free-zone assignment (one license per contractor).
   * Tenant-scoped: the org filter rides on the where clause so a spoofed
   * contractorId from another org resolves to null (IDOR mitigation).
   */
  getAssignment: tenantFlaggedProcedure
    .use(requireFeatureFlag('gulf.free-zone-tracking'))
    .use(requirePermission({ contractor: ['read'] }))
    .input(z.object({ contractorId: z.string().min(1) }))
    .query(async ({ ctx, input }) =>
      ctx.db.freeZoneAssignment.findFirst({
        where: {
          contractorId: input.contractorId,
          organizationId: ctx.organizationId,
        },
      }),
    ),

  /**
   * Create or update a contractor's free-zone assignment, then write/supersede
   * its compliance item in the same transaction. A non-Mainland expired license
   * yields a BLOCKING + EXPIRED item that hard-blocks payment via the existing
   * gate; a Mainland assignment writes no item.
   */
  upsertAssignment: tenantFlaggedProcedure
    .use(requireFeatureFlag('gulf.free-zone-tracking'))
    .use(requirePermission({ contractor: ['update'] }))
    .input(upsertAssignmentSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify the contractor belongs to the caller's org before writing the
      // 1:1 assignment — never trust the client-supplied contractorId alone.
      const contractor = await ctx.db.contractor.findFirst({
        where: { id: input.contractorId, organizationId: ctx.organizationId },
        select: { id: true },
      });
      if (!contractor) {
        throw new TRPCError({ code: 'NOT_FOUND', message: E.CONTRACTOR_NOT_FOUND });
      }

      const licenseExpiresAt = input.licenseExpiresAt ? new Date(input.licenseExpiresAt) : null;

      return ctx.db.$transaction(async tx => {
        const assignment = await tx.freeZoneAssignment.upsert({
          where: { contractorId: input.contractorId },
          create: {
            organizationId: ctx.organizationId,
            contractorId: input.contractorId,
            zone: input.zone,
            licenseNumber: input.licenseNumber ?? null,
            licenseCategory: input.licenseCategory ?? null,
            licenseExpiresAt,
            permittedActivitiesText: input.permittedActivitiesText ?? null,
            permittedActivityIsicCodes: input.permittedActivityIsicCodes,
          },
          update: {
            zone: input.zone,
            licenseNumber: input.licenseNumber ?? null,
            licenseCategory: input.licenseCategory ?? null,
            licenseExpiresAt,
            permittedActivitiesText: input.permittedActivitiesText ?? null,
            permittedActivityIsicCodes: input.permittedActivityIsicCodes,
          },
        });

        // Materialise the BLOCKING free-zone compliance item out-of-band via
        // the compliance service. Only fires for non-Mainland licenses with an
        // expiry date; the service gates Mainland assignments. Composes inside
        // this tx so the assignment + item + audit commit atomically.
        let compliance: Awaited<ReturnType<typeof writeFreeZoneComplianceItem>> | null = null;
        if (assignment.zone !== 'MAINLAND' && assignment.licenseExpiresAt) {
          compliance = await writeFreeZoneComplianceItem(tx as FreeZoneComplianceClient, {
            assignment: {
              organizationId: assignment.organizationId,
              contractorId: assignment.contractorId,
              zone: assignment.zone,
              licenseNumber: assignment.licenseNumber ?? '',
              licenseExpiresAt: assignment.licenseExpiresAt,
            },
            actorType: 'USER',
            actorId: ctx.user?.id ?? null,
          });
        }

        // The assignment write is a sensitive mutation; audit it on the same
        // tx so the audit row rolls back with the assignment on failure.
        await writeAuditLog({
          organizationId: ctx.organizationId,
          actorType: 'USER',
          actorId: ctx.user?.id ?? null,
          action: 'gulf.free_zone.assignment.upsert',
          resourceType: 'CONTRACTOR',
          resourceId: assignment.contractorId,
          metadata: {
            assignmentId: assignment.id,
            zone: assignment.zone,
            licenseNumber: assignment.licenseNumber,
            licenseExpiresAt: assignment.licenseExpiresAt?.toISOString() ?? null,
          },
          tx,
        });

        return { assignment, compliance };
      });
    }),

  /**
   * Persist per-engagement Saudi nationality + Qiwa fields on a
   * ContractorAssignment. These feed the Saudization dashboard derivation.
   * Tenant-scoped update: the org filter on the where clause prevents
   * cross-tenant writes.
   */
  setSaudiAssignmentFields: tenantFlaggedProcedure
    .use(requireFeatureFlag('gulf.free-zone-tracking'))
    .use(requirePermission({ contractor: ['update'] }))
    .input(setSaudiAssignmentFieldsSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.contractorAssignment.findFirst({
        where: { id: input.assignmentId, organizationId: ctx.organizationId },
        select: { id: true, contractorId: true },
      });
      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: E.GULF_ASSIGNMENT_NOT_FOUND });
      }

      // Partial-update semantics: only write the columns actually provided in the
      // input. `undefined` means "leave unchanged"; an explicit `null` clears the
      // column. Writing all three unconditionally would null the untouched
      // independent fields (isSaudi / nationality / qiwaContractAuthenticated) on
      // any single-field update, silently corrupting the Saudization derivation.
      const data: Prisma.ContractorAssignmentUpdateInput = {};
      if (input.isSaudi !== undefined) data.isSaudi = input.isSaudi;
      if (input.nationality !== undefined) data.nationality = input.nationality;
      if (input.qiwaContractAuthenticated !== undefined) {
        data.qiwaContractAuthenticated = input.qiwaContractAuthenticated;
      }

      const updated = await ctx.db.contractorAssignment.update({
        where: { id: existing.id },
        data,
        select: {
          id: true,
          contractorId: true,
          isSaudi: true,
          nationality: true,
          qiwaContractAuthenticated: true,
        },
      });

      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user?.id ?? null,
        action: 'gulf.saudi_assignment_fields.update',
        resourceType: 'CONTRACTOR',
        resourceId: existing.contractorId,
        metadata: {
          assignmentId: updated.id,
          isSaudi: updated.isSaudi,
          nationality: updated.nationality,
          qiwaContractAuthenticated: updated.qiwaContractAuthenticated,
        },
      });

      return updated;
    }),
});
