// ---------------------------------------------------------------------------
// Phase 63 · Plan 04 · Task 1 — BACS tRPC router
//
// Procedures:
//   1. previewExport  — preview BACS Std 18 file text + warnings
//   2. generateExport — generate, upload to R2, return signed download URL
//   3. validateSortCode — VocaLink modulus check for sort code + account
//   4. saveSubmitterConfig — save encrypted BACS submitter org config (admin)
//
// Security:
//   - All procedures require tenant (org-scoped) auth
//   - saveSubmitterConfig additionally requires org:settings:write permission
//   - PAY_BACS_ENABLED feature flag gates preview + generate
//   - Encrypted bank fields never returned — only masked values
//   - R2 signed URLs with 300s TTL for downloads
// ---------------------------------------------------------------------------

import { createHash } from 'node:crypto';

import { createLogger } from '@contractor-ops/logger';
import {
  VOCALINK_MODULUS_TABLE_V840,
  accountNumberSchema,
  bacsSubmitterNameSchema,
  modulusCheck,
  serviceUserNumberSchema,
  sortCodeSchema,
} from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import * as E from '../errors.js';
import { router } from '../init.js';
import { requireFeatureFlag, tenantFlaggedProcedure } from '../middleware/feature-flag.js';
import { requirePermission } from '../middleware/rbac.js';
import { tenantProcedure } from '../middleware/tenant.js';
import { writeAuditLog } from '../services/audit-writer.js';
import { decryptBankAccount, encryptBankAccount } from '../services/bank-account-crypto.js';
import type {
  BacsExportItem,
  BacsGenerateResult,
  BacsOrgBankInfo,
} from '../services/payment-export.js';
import { generateBacsStandard18 } from '../services/payment-export.js';
import { putObjectAndSignDownload } from '../services/r2.js';

const log = createLogger('bacs-router');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Masks a string, showing only the last N characters.
 */
function maskString(value: string, showLast: number): string {
  if (value.length <= showLast) return value;
  return 'X'.repeat(value.length - showLast) + value.slice(-showLast);
}

/**
 * Formats a masked sort code: XX-XX-{last2}
 */
function maskSortCode(sortCode: string): string {
  const last2 = sortCode.slice(-2);
  return `XX-XX-${last2}`;
}

/**
 * Formats a masked account number: XXXX{last4}
 */
function maskAccountNumber(accountNumber: string): string {
  const last4 = accountNumber.slice(-4);
  return `XXXX${last4}`;
}

/**
 * Formats a masked SUN: XXXX{last2}
 */
function maskSun(sun: string): string {
  const last2 = sun.slice(-2);
  return `XXXX${last2}`;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const bacsRouter = router({
  /**
   * Preview a BACS Std 18 export file for a payment run.
   * Returns the file text and any transliteration/modulus warnings.
   * Gated behind PAY_BACS_ENABLED feature flag.
   */
  previewExport: tenantFlaggedProcedure
    .use(requireFeatureFlag('payments.bacs-enabled'))
    .input(z.object({ paymentRunId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { paymentRunId } = input;

      // Load payment run with items
      const paymentRun = await ctx.db.paymentRun.findUnique({
        where: { id: paymentRunId, organizationId: ctx.organizationId },
        include: {
          items: {
            include: {
              invoice: { select: { invoiceNumber: true } },
              contractor: { select: { name: true, countryCode: true } },
              billingProfile: {
                select: {
                  ukSortCodeEncrypted: true,
                  ukAccountNumberEncrypted: true,
                },
              },
            },
          },
        },
      });

      if (!paymentRun) {
        throw new TRPCError({ code: 'NOT_FOUND', message: E.FORBIDDEN });
      }

      // Load org for submitter config
      const org = await ctx.db.organization.findUnique({
        where: { id: ctx.organizationId },
        select: {
          name: true,
          bacsServiceUserNumberEncrypted: true,
          bacsSubmitterSortCodeEncrypted: true,
          bacsSubmitterAccountNumberEncrypted: true,
          bacsSubmitterName: true,
        },
      });

      if (
        !org?.bacsServiceUserNumberEncrypted ||
        !org.bacsSubmitterSortCodeEncrypted ||
        !org.bacsSubmitterAccountNumberEncrypted ||
        !org.bacsSubmitterName
      ) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'BACS submitter not configured',
        });
      }

      // Decrypt org submitter fields
      const orgBank: BacsOrgBankInfo = {
        serviceUserNumber: decryptBankAccount(org.bacsServiceUserNumberEncrypted),
        submitterSortCode: decryptBankAccount(org.bacsSubmitterSortCodeEncrypted),
        submitterAccountNumber: decryptBankAccount(org.bacsSubmitterAccountNumberEncrypted),
        submitterName: org.bacsSubmitterName,
      };

      // Build export items with decrypted bank details
      const items: BacsExportItem[] = paymentRun.items.map((item) => {
        if (!item.billingProfile?.ukSortCodeEncrypted || !item.billingProfile.ukAccountNumberEncrypted) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: `Contractor "${item.contractor.name}" has no UK bank details configured`,
          });
        }

        return {
          contractorName: item.contractor.name,
          sortCode: decryptBankAccount(item.billingProfile.ukSortCodeEncrypted),
          accountNumber: decryptBankAccount(item.billingProfile.ukAccountNumberEncrypted),
          amountMinor: item.amountMinor,
          paymentReference: item.invoice.invoiceNumber ?? paymentRun.runNumber ?? paymentRunId,
        };
      });

      const result: BacsGenerateResult = generateBacsStandard18(
        items,
        orgBank,
        paymentRun.runNumber ?? paymentRunId,
        new Date(),
      );

      return {
        fileText: result.fileBuffer.toString('ascii'),
        transliterationWarnings: result.transliterationWarnings,
        modulusWarnings: result.modulusWarnings,
      };
    }),

  /**
   * Generate a BACS Std 18 export, upload to R2, and return a signed download URL.
   * Gated behind PAY_BACS_ENABLED feature flag.
   */
  generateExport: tenantFlaggedProcedure
    .use(requireFeatureFlag('payments.bacs-enabled'))
    .input(z.object({ paymentRunId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { paymentRunId } = input;

      // Load payment run with items
      const paymentRun = await ctx.db.paymentRun.findUnique({
        where: { id: paymentRunId, organizationId: ctx.organizationId },
        include: {
          items: {
            include: {
              invoice: { select: { invoiceNumber: true } },
              contractor: { select: { name: true, countryCode: true } },
              billingProfile: {
                select: {
                  ukSortCodeEncrypted: true,
                  ukAccountNumberEncrypted: true,
                },
              },
            },
          },
        },
      });

      if (!paymentRun) {
        throw new TRPCError({ code: 'NOT_FOUND', message: E.FORBIDDEN });
      }

      // Load org for submitter config
      const org = await ctx.db.organization.findUnique({
        where: { id: ctx.organizationId },
        select: {
          name: true,
          bacsServiceUserNumberEncrypted: true,
          bacsSubmitterSortCodeEncrypted: true,
          bacsSubmitterAccountNumberEncrypted: true,
          bacsSubmitterName: true,
        },
      });

      if (
        !org?.bacsServiceUserNumberEncrypted ||
        !org.bacsSubmitterSortCodeEncrypted ||
        !org.bacsSubmitterAccountNumberEncrypted ||
        !org.bacsSubmitterName
      ) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'BACS submitter not configured',
        });
      }

      // Decrypt org submitter fields
      const orgBank: BacsOrgBankInfo = {
        serviceUserNumber: decryptBankAccount(org.bacsServiceUserNumberEncrypted),
        submitterSortCode: decryptBankAccount(org.bacsSubmitterSortCodeEncrypted),
        submitterAccountNumber: decryptBankAccount(org.bacsSubmitterAccountNumberEncrypted),
        submitterName: org.bacsSubmitterName,
      };

      // Build export items with decrypted bank details
      const items: BacsExportItem[] = paymentRun.items.map((item) => {
        if (!item.billingProfile?.ukSortCodeEncrypted || !item.billingProfile.ukAccountNumberEncrypted) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: `Contractor "${item.contractor.name}" has no UK bank details configured`,
          });
        }

        return {
          contractorName: item.contractor.name,
          sortCode: decryptBankAccount(item.billingProfile.ukSortCodeEncrypted),
          accountNumber: decryptBankAccount(item.billingProfile.ukAccountNumberEncrypted),
          amountMinor: item.amountMinor,
          paymentReference: item.invoice.invoiceNumber ?? paymentRun.runNumber ?? paymentRunId,
        };
      });

      // Generate fresh file (never from cached preview)
      const result: BacsGenerateResult = generateBacsStandard18(
        items,
        orgBank,
        paymentRun.runNumber ?? paymentRunId,
        new Date(),
      );

      // Compute SHA-256 integrity hash
      const sha256 = createHash('sha256').update(result.fileBuffer).digest('hex');
      const sha256Prefix16 = sha256.slice(0, 16);

      // Upload to R2
      const r2Key = `payment-exports/${ctx.organizationId}/${paymentRunId}/BACS-${paymentRun.runNumber ?? paymentRunId}-${sha256Prefix16}.txt`;
      const isoDate = new Date().toISOString().slice(0, 10);
      const downloadFilename = `${org.name}-BACS-${paymentRun.runNumber ?? paymentRunId}-${isoDate}.txt`;

      const { signedUrl } = await putObjectAndSignDownload({
        key: r2Key,
        body: result.fileBuffer,
        contentType: 'text/plain; charset=ascii',
        downloadFilename,
        ttlSeconds: 300,
      });

      // Create PaymentExport record
      await ctx.db.paymentExport.create({
        data: {
          organizationId: ctx.organizationId,
          paymentRunId,
          format: 'BACS_STD18',
          generatedByUserId: ctx.user.id,
        },
      });

      log.info(
        { paymentRunId, organizationId: ctx.organizationId, sha256: sha256Prefix16 },
        'BACS Std 18 file generated and uploaded to R2',
      );

      return { downloadUrl: signedUrl, filename: downloadFilename, sha256 };
    }),

  /**
   * Validate a UK sort code + account number via VocaLink modulus check.
   */
  validateSortCode: tenantProcedure
    .input(
      z.object({
        sortCode: sortCodeSchema,
        accountNumber: accountNumberSchema,
      }),
    )
    .query(({ input }) => {
      const { sortCode, accountNumber } = input;

      // Run modulus check
      const result = modulusCheck(sortCode, accountNumber, VOCALINK_MODULUS_TABLE_V840);

      // Determine status
      let status: 'VALID' | 'WARN' | 'INVALID';
      if (!result.valid) {
        // If Zod schemas passed but modulus failed, it's a modulus warning
        // (the sort code exists but the account number check digit doesn't match)
        status = 'WARN';
      } else if (result.warnings.length > 0) {
        status = 'WARN';
      } else {
        status = 'VALID';
      }

      return { status, warnings: result.warnings };
    }),

  /**
   * Save BACS submitter configuration (admin-only).
   * Encrypts all sensitive fields, stores masked versions for UI display.
   */
  saveSubmitterConfig: tenantProcedure
    .use(requirePermission({ settings: ['write'] }))
    .input(
      z.object({
        serviceUserNumber: serviceUserNumberSchema,
        submitterSortCode: sortCodeSchema,
        submitterAccountNumber: accountNumberSchema,
        submitterName: bacsSubmitterNameSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Encrypt each field
      const sunEncrypted = encryptBankAccount(input.serviceUserNumber);
      const sortCodeEncrypted = encryptBankAccount(input.submitterSortCode);
      const accountNumberEncrypted = encryptBankAccount(input.submitterAccountNumber);

      // Compute masked versions
      const sunMasked = maskSun(input.serviceUserNumber);
      const sortCodeMasked = maskSortCode(input.submitterSortCode);
      const accountNumberMasked = maskAccountNumber(input.submitterAccountNumber);

      // Update organization
      await ctx.db.organization.update({
        where: { id: ctx.organizationId },
        data: {
          bacsServiceUserNumberEncrypted: sunEncrypted,
          bacsServiceUserNumberMasked: sunMasked,
          bacsSubmitterSortCodeEncrypted: sortCodeEncrypted,
          bacsSubmitterSortCodeMasked: sortCodeMasked,
          bacsSubmitterAccountNumberEncrypted: accountNumberEncrypted,
          bacsSubmitterAccountNumberMasked: accountNumberMasked,
          bacsSubmitterName: input.submitterName,
        },
      });

      // Audit log (field names only, never values)
      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user.id,
        action: 'UPDATE',
        entityType: 'ORGANIZATION',
        entityId: ctx.organizationId,
        metadata: {
          fieldsUpdated: [
            'bacsServiceUserNumber',
            'bacsSubmitterSortCode',
            'bacsSubmitterAccountNumber',
            'bacsSubmitterName',
          ],
        },
        db: ctx.db,
      });

      log.info(
        { organizationId: ctx.organizationId, userId: ctx.user.id },
        'BACS submitter configuration saved',
      );

      return {
        saved: true,
        masks: {
          sun: sunMasked,
          sortCode: sortCodeMasked,
          accountNumber: accountNumberMasked,
        },
      };
    }),
});
