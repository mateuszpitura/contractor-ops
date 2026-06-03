// ---------------------------------------------------------------------------
// Phase 79 · GULF-01/04 (D-01/D-04/D-09) — Free-zone assignment CRUD + per-
// engagement Saudi fields tRPC router.
// ---------------------------------------------------------------------------
//
// Exposes the FreeZoneAssignment data layer (Plan 02 models, Plan 03 service)
// through tenant-scoped, Zod-validated, region-aware procedures. All reads/writes
// go through `ctx.db` — the tenant middleware resolves org.dataRegion →
// getRegionalClient, so ME orgs transparently hit the ME database. The 4 Gulf
// models are NEVER touched via the default `prisma`/`prismaRaw` client (Pitfall 19 /
// lint-region-leakage).
//
// Writes compose the FreeZoneAssignment upsert + the out-of-band compliance-item
// write (writeFreeZoneComplianceItem, Plan 03) inside a single ctx.db.$transaction
// so the assignment, its BLOCKING/EXPIRED compliance row, and the audit log commit
// atomically (D-17). Mainland assignments arm no payment-block gate (D-04 — the
// zone narrowing lives in the service write).

import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import * as E from '../../errors';
import { router } from '../../init';
import { requirePermission } from '../../middleware/rbac';
import { tenantProcedure } from '../../middleware/tenant';
import { writeAuditLog } from '../../services/audit-writer';
import type { FreeZoneComplianceClient } from '../../services/free-zone-compliance';
import { writeFreeZoneComplianceItem } from '../../services/free-zone-compliance';

// The 11 recordable UaeFreeZoneCode enum values (Plan 02 gulf.prisma). Kept as a
// Zod enum so an invalid zone is rejected at the trust boundary (T-79-05-05).
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
  /** Calendar expiry date (Asia/Dubai); drives the F1 reminder cascade band math. */
  licenseExpiresAt: z.iso.date().nullish(),
  permittedActivitiesText: z.string().trim().max(4000).nullish(),
  /** Admin-tagged ISIC-style codes that drive the permitted-activity scope check (D-05/D-06). */
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
   * Read a contractor's free-zone assignment (D-01 — one license per contractor).
   * Tenant-scoped: the org filter rides on the where clause so a spoofed
   * contractorId from another org resolves to null (T-79-05-02 IDOR mitigation).
   */
  getAssignment: tenantProcedure
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
   * its compliance item in the same transaction (D-01/D-02/D-03). A non-Mainland
   * expired license yields a BLOCKING + EXPIRED item that hard-blocks payment via
   * the existing gate; a Mainland assignment writes no item (D-04).
   */
  upsertAssignment: tenantProcedure
    .use(requirePermission({ contractor: ['update'] }))
    .input(upsertAssignmentSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify the contractor belongs to the caller's org before writing the
      // 1:1 assignment — never trust the client-supplied contractorId alone
      // (T-79-05-01 tampering mitigation).
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

        // D-03 — materialise the BLOCKING free-zone compliance item out-of-band
        // (Plan 03 service). Only fires for non-Mainland licenses with an expiry
        // date; the service gates Mainland (D-04). Composes inside this tx so the
        // assignment + item + audit commit atomically.
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

        // D-17 — the assignment write itself is a sensitive mutation; audit it on
        // the same tx so it rolls back with the assignment on failure.
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
   * Persist per-engagement Saudi nationality + Qiwa fields on a ContractorAssignment
   * (GULF-04 / D-09). These feed the Saudization dashboard derivation. Tenant-scoped
   * update: the org filter on the where clause prevents cross-tenant writes.
   */
  setSaudiAssignmentFields: tenantProcedure
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

      const updated = await ctx.db.contractorAssignment.update({
        where: { id: existing.id },
        data: {
          isSaudi: input.isSaudi ?? null,
          nationality: input.nationality ?? null,
          qiwaContractAuthenticated: input.qiwaContractAuthenticated ?? null,
        },
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
