import { mapCountryCodeToJurisdiction } from '@contractor-ops/compliance-policy';
import type { Prisma } from '@contractor-ops/db';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import * as E from '../../errors';
import { router } from '../../init';
import { findOrThrow } from '../../lib/find-or-throw';
import { requirePermission } from '../../middleware/rbac';
import { assertWorkforceEnabled } from '../../middleware/require-workforce-flag';
import { tenantProcedure } from '../../middleware/tenant';
import { writeAuditLog } from '../../services/audit-writer';
import { createPresignedDownloadUrl } from '../../services/r2';
import type { CertRenderSnapshot } from '../../services/statutory-cert-pdf';
import {
  renderAndArchiveStatutoryCert,
  sanitizeCertSnapshot,
} from '../../services/statutory-cert-pdf';
import type { DbClient } from '../../services/types';
import { startWorkflowRun } from '../workflow/workflow-execution-runs';

// ---------------------------------------------------------------------------
// Employee on/offboarding lifecycle surface — the composition seam.
//
// Resolves the correct per-market template by the employee's jurisdiction and
// starts a worker WorkflowRun via the shared startWorkflowRun helper (never a
// duplicate create), generates a DRAFT statutory certificate, and records the
// dated termination that arms the IdP deprovisioning cooldown. Every procedure
// re-asserts the workforce flag, is HR-RBAC-gated (employee:update), tenant-
// scoped, and audited (resourceType EMPLOYEE). Mounted through the existing
// conditionalWorkforceRouters spread — no new flag or conditional block.
// ---------------------------------------------------------------------------

const CERT_TYPES = [
  'SWIADECTWO_PRACY',
  'PIT_11',
  'ARBEITSZEUGNIS_SIMPLE',
  'LOHNSTEUERBESCHEINIGUNG',
  'P45',
  'W2',
] as const;

const workerIdInput = z.object({ workerId: z.string().min(1) }).strict();

export const employeeLifecycleRouter = router({
  /**
   * Lifecycle read state for an employee: the dated termination signal + status
   * the UI uses to gate the IdP deprovisioning trigger (actionable only once a
   * termination date exists). The 14-day cooldown stays server-side (Plan 04).
   */
  get: tenantProcedure
    .use(requirePermission({ employee: ['read'] }))
    .input(workerIdInput)
    .query(async ({ ctx, input }) => {
      assertWorkforceEnabled(ctx.organizationId, ctx.region);

      const emp = await findOrThrow(
        () =>
          ctx.db.employeeProfile.findFirst({
            where: { workerId: input.workerId, organizationId: ctx.organizationId },
            select: {
              terminatedAt: true,
              employmentStatus: true,
              worker: { select: { displayName: true } },
            },
          }),
        E.WORKER_NOT_FOUND,
      );

      return {
        workerId: input.workerId,
        displayName: emp.worker.displayName,
        terminatedAt: emp.terminatedAt,
        employmentStatus: emp.employmentStatus,
      };
    }),

  startOnboarding: tenantProcedure
    .use(requirePermission({ employee: ['update'] }))
    .input(workerIdInput)
    .mutation(({ ctx, input }) => startLifecycleRun(ctx, input.workerId, 'ONBOARDING')),

  startOffboarding: tenantProcedure
    .use(requirePermission({ employee: ['update'] }))
    .input(workerIdInput)
    .mutation(({ ctx, input }) => startLifecycleRun(ctx, input.workerId, 'OFFBOARDING')),

  recordTermination: tenantProcedure
    .use(requirePermission({ employee: ['update'] }))
    .input(z.object({ workerId: z.string().min(1), terminatedAt: z.coerce.date() }).strict())
    .mutation(async ({ ctx, input }) => {
      assertWorkforceEnabled(ctx.organizationId, ctx.region);

      return ctx.db.$transaction(async tx => {
        const emp = await findOrThrow(
          () =>
            tx.employeeProfile.findFirst({
              where: { workerId: input.workerId, organizationId: ctx.organizationId },
              select: { id: true, countryCode: true },
            }),
          E.WORKER_NOT_FOUND,
        );

        const updated = await tx.employeeProfile.update({
          where: { id: emp.id },
          data: { terminatedAt: input.terminatedAt, employmentStatus: 'TERMINATED' },
          select: { terminatedAt: true },
        });

        await tx.personnelFile.upsert({
          where: { workerId: input.workerId },
          create: {
            organizationId: ctx.organizationId,
            workerId: input.workerId,
            countryCode: emp.countryCode,
            terminatedAt: input.terminatedAt,
          },
          update: { terminatedAt: input.terminatedAt },
        });

        await writeAuditLog({
          organizationId: ctx.organizationId,
          actorType: 'USER',
          actorId: ctx.user?.id ?? null,
          action: 'employee.termination.recorded',
          resourceType: 'EMPLOYEE',
          resourceId: input.workerId,
          newValues: { terminatedAt: updated.terminatedAt?.toISOString() ?? null },
          tx,
        });

        return { workerId: input.workerId, terminatedAt: updated.terminatedAt };
      });
    }),

  generateCert: tenantProcedure
    .use(requirePermission({ employee: ['update'] }))
    .input(
      z
        .object({
          workflowRunId: z.string().min(1),
          workerId: z.string().min(1),
          certType: z.enum(CERT_TYPES),
        })
        .strict(),
    )
    .mutation(async ({ ctx, input }) => {
      assertWorkforceEnabled(ctx.organizationId, ctx.region);

      // The run must belong to this org AND this worker (IDOR fence).
      await findOrThrow(
        () =>
          ctx.db.workflowRun.findFirst({
            where: {
              id: input.workflowRunId,
              organizationId: ctx.organizationId,
              workerId: input.workerId,
            },
            select: { id: true },
          }),
        E.WORKFLOW_RUN_NOT_FOUND,
      );

      const emp = await findOrThrow(
        () =>
          ctx.db.employeeProfile.findFirst({
            where: { workerId: input.workerId, organizationId: ctx.organizationId },
            select: {
              countryCode: true,
              peselLast4: true,
              ssnLast4: true,
              worker: { select: { displayName: true } },
            },
          }),
        E.WORKER_NOT_FOUND,
      );

      const org = await ctx.db.organization.findUnique({
        where: { id: ctx.organizationId },
        select: { name: true },
      });

      const jurisdiction = mapCountryCodeToJurisdiction(emp.countryCode) ?? emp.countryCode;

      // Values-as-of-generation; the PII strip guarantees only *Last4 persists.
      const snapshot = sanitizeCertSnapshot<CertRenderSnapshot>({
        certType: input.certType,
        jurisdiction,
        employerName: org?.name ?? '—',
        employeeName: emp.worker.displayName,
        peselLast4: emp.peselLast4 ?? undefined,
        ssnLast4: emp.ssnLast4 ?? undefined,
        renderedAt: new Date().toISOString(),
      });

      const cert = await ctx.db.$transaction(async tx => {
        const created = await tx.statutoryCertificate.create({
          data: {
            organizationId: ctx.organizationId,
            workflowRunId: input.workflowRunId,
            workerId: input.workerId,
            certType: input.certType,
            jurisdiction,
            status: 'DRAFT',
            snapshotJson: snapshot as unknown as Prisma.InputJsonValue,
          },
          select: { id: true },
        });

        await writeAuditLog({
          organizationId: ctx.organizationId,
          actorType: 'USER',
          actorId: ctx.user?.id ?? null,
          action: 'employee.cert.generated',
          resourceType: 'EMPLOYEE',
          resourceId: input.workerId,
          metadata: { certId: created.id, certType: input.certType, jurisdiction },
          tx,
        });

        return created;
      });

      const archive = await renderAndArchiveStatutoryCert(ctx.db, cert.id);
      const downloadUrl = await createPresignedDownloadUrl(archive.pdfArchiveKey);
      return { certId: cert.id, pdfArchiveKey: archive.pdfArchiveKey, downloadUrl };
    }),
});

/**
 * Resolve the org's ACTIVE per-market template for the employee's jurisdiction
 * and start a worker run through the single shared helper. Extracted so onboard
 * + offboard share one path (no duplicate create).
 */
async function startLifecycleRun(
  ctx: { organizationId: string; region: string; user: { id: string }; db: DbClient },
  workerId: string,
  type: 'ONBOARDING' | 'OFFBOARDING',
) {
  assertWorkforceEnabled(ctx.organizationId, ctx.region);

  const emp = await findOrThrow(
    () =>
      ctx.db.employeeProfile.findFirst({
        where: { workerId, organizationId: ctx.organizationId },
        select: { countryCode: true },
      }),
    E.WORKER_NOT_FOUND,
  );

  const jurisdiction = mapCountryCodeToJurisdiction(emp.countryCode);
  if (!jurisdiction) {
    throw new TRPCError({ code: 'NOT_FOUND', message: E.EMPLOYEE_UNSUPPORTED_JURISDICTION });
  }

  const template = await ctx.db.workflowTemplate.findFirst({
    where: {
      organizationId: ctx.organizationId,
      jurisdiction,
      type,
      appliesToEntityType: 'EMPLOYEE',
      status: 'ACTIVE',
    },
    select: { id: true },
  });
  if (!template) {
    // The seed ships DRAFT — surfaced so the org activates it before first use.
    throw new TRPCError({ code: 'NOT_FOUND', message: E.EMPLOYEE_LIFECYCLE_TEMPLATE_NOT_FOUND });
  }

  const started = await ctx.db.$transaction(async tx => {
    const run = await startWorkflowRun(
      tx,
      { subjectType: 'EMPLOYEE', templateId: template.id, workerId },
      { organizationId: ctx.organizationId, actorUserId: ctx.user.id },
    );

    await writeAuditLog({
      tx,
      organizationId: ctx.organizationId,
      actorType: 'USER',
      actorId: ctx.user.id,
      action:
        type === 'ONBOARDING' ? 'employee.onboarding.started' : 'employee.offboarding.started',
      resourceType: 'EMPLOYEE',
      resourceId: workerId,
      metadata: { workflowRunId: run.run.id, jurisdiction, type },
    });

    return run;
  });

  return { runId: started.run.id };
}
