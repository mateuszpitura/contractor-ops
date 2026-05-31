// Phase 75 D-10..D-12 — CredentialReference tRPC router.
// Every free-text field (vaultUrl, label, notes) is gated server-side by
// looksLikeSecretRefinement (D-11). Stores POINTERS only — never secrets.

import { looksLikeSecretRefinement } from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import * as E from '../../errors';
import { router } from '../../init';
import { requirePermission } from '../../middleware/rbac';
import { tenantProcedure } from '../../middleware/tenant';
import { writeAuditLog } from '../../services/audit-writer';

const VAULT_PROVIDER = z.enum([
  'ONE_PASSWORD',
  'BITWARDEN',
  'HASHICORP_VAULT',
  'AWS_SECRETS_MANAGER',
  'GCP_SECRET_MANAGER',
  'AZURE_KEY_VAULT',
  'OTHER',
]);

const ACCESS_TYPE = z.enum([
  'AWS',
  'GITHUB',
  'GCP',
  'AZURE',
  'DATABASE',
  'API_KEY',
  'SSH_KEY',
  'OTHER',
]);

// Every free-text field passes through looksLikeSecretRefinement (D-11).
const SAFE_TEXT = z.string().min(1).max(2000).superRefine(looksLikeSecretRefinement);
const SAFE_VAULT_URL = z.string().min(1).max(2000).url().superRefine(looksLikeSecretRefinement);
const SAFE_NOTES = z.string().max(10000).superRefine(looksLikeSecretRefinement);

export const credentialReferenceRouter = router({
  create: tenantProcedure
    .use(requirePermission({ workflow: ['execute'] }))
    .input(
      z.object({
        workflowRunId: z.string().min(1),
        label: SAFE_TEXT,
        vaultProvider: VAULT_PROVIDER,
        vaultUrl: SAFE_VAULT_URL,
        accessType: ACCESS_TYPE,
        successorUserId: z.string().min(1).optional(),
        notes: SAFE_NOTES.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Defend the D-12 UI gate at the server: credentials only on OFFBOARDING runs.
      const run = await ctx.db.workflowRun.findFirst({
        where: { id: input.workflowRunId, organizationId: ctx.organizationId },
        include: { workflowTemplate: { select: { type: true } } },
      });
      if (!run) {
        throw new TRPCError({ code: 'NOT_FOUND', message: E.WORKFLOW_RUN_NOT_FOUND });
      }
      if (run.workflowTemplate.type !== 'OFFBOARDING') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: E.CREDENTIAL_REFERENCE_OFFBOARDING_ONLY,
        });
      }

      return ctx.db.$transaction(async tx => {
        const row = await tx.credentialReference.create({
          data: {
            organizationId: ctx.organizationId,
            workflowRunId: input.workflowRunId,
            label: input.label,
            vaultProvider: input.vaultProvider,
            vaultUrl: input.vaultUrl,
            accessType: input.accessType,
            successorUserId: input.successorUserId ?? null,
            status: 'PENDING',
            notes: input.notes ?? null,
          },
        });
        await writeAuditLog({
          organizationId: ctx.organizationId,
          actorType: 'USER',
          actorId: ctx.user?.id ?? null,
          action: 'credential_reference.created',
          resourceType: 'WORKFLOW_RUN',
          resourceId: row.id,
          newValues: {
            workflowRunId: input.workflowRunId,
            vaultProvider: input.vaultProvider,
            accessType: input.accessType,
            label: input.label,
          },
          tx,
        });
        return row;
      });
    }),

  update: tenantProcedure
    .use(requirePermission({ workflow: ['execute'] }))
    .input(
      z.object({
        id: z.string().min(1),
        label: SAFE_TEXT.optional(),
        vaultProvider: VAULT_PROVIDER.optional(),
        vaultUrl: SAFE_VAULT_URL.optional(),
        accessType: ACCESS_TYPE.optional(),
        successorUserId: z.string().min(1).nullable().optional(),
        notes: SAFE_NOTES.nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.credentialReference.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId },
      });
      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: E.CREDENTIAL_REFERENCE_NOT_FOUND });
      }
      return ctx.db.$transaction(async tx => {
        const updated = await tx.credentialReference.update({
          where: { id: input.id },
          data: {
            ...(input.label !== undefined && { label: input.label }),
            ...(input.vaultProvider !== undefined && { vaultProvider: input.vaultProvider }),
            ...(input.vaultUrl !== undefined && { vaultUrl: input.vaultUrl }),
            ...(input.accessType !== undefined && { accessType: input.accessType }),
            ...(input.successorUserId !== undefined && { successorUserId: input.successorUserId }),
            ...(input.notes !== undefined && { notes: input.notes }),
          },
        });
        await writeAuditLog({
          organizationId: ctx.organizationId,
          actorType: 'USER',
          actorId: ctx.user?.id ?? null,
          action: 'credential_reference.updated',
          resourceType: 'WORKFLOW_RUN',
          resourceId: input.id,
          oldValues: {
            label: existing.label,
            vaultProvider: existing.vaultProvider,
            accessType: existing.accessType,
          },
          newValues: {
            label: updated.label,
            vaultProvider: updated.vaultProvider,
            accessType: updated.accessType,
          },
          tx,
        });
        return updated;
      });
    }),

  markRotated: tenantProcedure
    .use(requirePermission({ workflow: ['execute'] }))
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.credentialReference.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId },
      });
      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: E.CREDENTIAL_REFERENCE_NOT_FOUND });
      }
      return ctx.db.$transaction(async tx => {
        const updated = await tx.credentialReference.update({
          where: { id: input.id },
          data: { status: 'ROTATED', rotatedAt: new Date(), rotatedByUserId: ctx.user?.id ?? null },
        });
        await writeAuditLog({
          organizationId: ctx.organizationId,
          actorType: 'USER',
          actorId: ctx.user?.id ?? null,
          action: 'credential_reference.rotated',
          resourceType: 'WORKFLOW_RUN',
          resourceId: input.id,
          newValues: { status: 'ROTATED', rotatedByUserId: ctx.user?.id ?? null },
          tx,
        });
        return updated;
      });
    }),

  remove: tenantProcedure
    .use(requirePermission({ workflow: ['execute'] }))
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.credentialReference.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId },
      });
      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: E.CREDENTIAL_REFERENCE_NOT_FOUND });
      }
      await ctx.db.$transaction(async tx => {
        await tx.credentialReference.delete({ where: { id: input.id } });
        await writeAuditLog({
          organizationId: ctx.organizationId,
          actorType: 'USER',
          actorId: ctx.user?.id ?? null,
          action: 'credential_reference.removed',
          resourceType: 'WORKFLOW_RUN',
          resourceId: input.id,
          oldValues: {
            label: existing.label,
            vaultProvider: existing.vaultProvider,
            workflowRunId: existing.workflowRunId,
          },
          tx,
        });
      });
      return { id: input.id, removed: true };
    }),

  listByWorkflowRun: tenantProcedure
    .use(requirePermission({ workflow: ['read'] }))
    .input(z.object({ workflowRunId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      return ctx.db.credentialReference.findMany({
        where: { workflowRunId: input.workflowRunId, organizationId: ctx.organizationId },
        orderBy: { createdAt: 'asc' },
      });
    }),
});
