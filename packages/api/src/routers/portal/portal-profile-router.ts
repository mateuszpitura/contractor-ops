import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import * as E from '../../errors';
import { router } from '../../init';
import { portalProcedure } from '../../middleware/portal-auth';
import { writeAuditLog } from '../../services/audit-writer';
import { encryptBankAccount } from '../../services/bank-account-crypto';
import {
  assertValidContractorTaxId,
  normalizeContractorTaxId,
} from '../../services/contractor-tax-id';
import { scheduleDocumentVirusScan } from '../../services/document-virus-scan';
import { consumePendingUpload, createPendingUpload } from '../../services/pending-upload';
import { createChangeRequest } from '../../services/portal-change-request';
import { stripBankAccountEncrypted } from './portal-shared';

export const portalProfileRouter = router({
  /**
   * Get a presigned upload URL for compliance document replacement.
   * Accepts PDF, PNG, and JPEG — compliance scans are commonly image files.
   * Uses PORTAL_COMPLIANCE_UPLOAD purpose so submitUploadReplacement can
   * reject a documentId minted for a different flow.
   */
  getComplianceUploadUrl: portalProcedure
    .input(
      z.object({
        filename: z.string(),
        contentType: z
          .string()
          .refine(
            ct => ['application/pdf', 'image/png', 'image/jpeg'].includes(ct),
            'Only PDF, PNG, or JPEG files are accepted for compliance documents',
          ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const pending = await createPendingUpload({
        db: ctx.db,
        organizationId: ctx.organizationId,
        purpose: 'PORTAL_COMPLIANCE_UPLOAD',
        filename: input.filename,
        mimeType: input.contentType,
      });

      return {
        uploadUrl: pending.presignedPutUrl,
        documentId: pending.documentId,
        expiresAt: pending.expiresAt,
      };
    }),

  /**
   * Get contractor profile with contact info, billing profile (masked),
   * and any pending change request.
   * SECURITY: Never exposes bankAccountEncrypted.
   */
  getProfile: portalProcedure.query(async ({ ctx }) => {
    const contractor = await ctx.db.contractor.findUnique({
      where: { id: ctx.contractorId },
      select: {
        id: true,
        displayName: true,
        email: true,
        phone: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        postalCode: true,
        countryCode: true,
        taxId: true,
      },
    });

    if (!contractor) {
      throw new TRPCError({ code: 'NOT_FOUND' });
    }

    // Get default billing profile — NEVER select bankAccountEncrypted
    const billingProfile = await ctx.db.contractorBillingProfile.findFirst({
      where: {
        contractorId: ctx.contractorId,
        organizationId: ctx.organizationId,
        isDefault: true,
      },
      select: {
        id: true,
        bankAccountMasked: true,
        bankName: true,
        swiftBic: true,
        taxId: true,
      },
    });

    // Check for pending change request
    const pendingChangeRequestRaw = await ctx.db.contractorChangeRequest.findFirst({
      where: {
        contractorId: ctx.contractorId,
        organizationId: ctx.organizationId,
        status: 'PENDING',
      },
      select: {
        id: true,
        requestedChanges: true,
        createdAt: true,
      },
    });

    // Never surface `bankAccountEncrypted` ciphertext to the portal
    // client. Strip it from `requestedChanges` JSON before returning. The
    // `bankAccountMasked` field is server-derived and safe to expose.
    const pendingChangeRequest = pendingChangeRequestRaw
      ? {
          ...pendingChangeRequestRaw,
          requestedChanges: stripBankAccountEncrypted(pendingChangeRequestRaw.requestedChanges),
        }
      : null;

    return {
      ...contractor,
      billingProfile,
      pendingChangeRequest,
    };
  }),

  /**
   * Update contractor contact info (takes effect immediately).
   * Contact fields only — financial fields require approval workflow.
   */
  updateContactInfo: portalProcedure
    .input(
      z.object({
        displayName: z.string().min(1).max(200),
        phone: z.string().max(50).optional().nullable(),
        addressLine1: z.string().max(200).optional().nullable(),
        addressLine2: z.string().max(200).optional().nullable(),
        city: z.string().max(100).optional().nullable(),
        postalCode: z.string().max(20).optional().nullable(),
        countryCode: z.string().length(2).optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const contactSelect = {
        id: true,
        displayName: true,
        phone: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        postalCode: true,
        countryCode: true,
      } as const;

      return ctx.db.$transaction(async tx => {
        const previous = await tx.contractor.findFirst({
          where: { id: ctx.contractorId, organizationId: ctx.organizationId },
          select: contactSelect,
        });
        if (!previous) {
          throw new TRPCError({ code: 'NOT_FOUND', message: E.CONTRACTOR_NOT_FOUND });
        }

        const updated = await tx.contractor.update({
          where: { id: ctx.contractorId },
          data: {
            displayName: input.displayName,
            phone: input.phone,
            addressLine1: input.addressLine1,
            addressLine2: input.addressLine2,
            city: input.city,
            postalCode: input.postalCode,
            countryCode: input.countryCode ?? undefined,
          },
          select: contactSelect,
        });

        await writeAuditLog({
          tx,
          organizationId: ctx.organizationId,
          actorType: 'CONTRACTOR',
          actorId: ctx.contractorId,
          actorName: ctx.contractor?.email ?? 'contractor',
          action: 'portal.contact.update',
          resourceType: 'CONTRACTOR',
          resourceId: ctx.contractorId,
          oldValues: {
            displayName: previous.displayName,
            phone: previous.phone,
            addressLine1: previous.addressLine1,
            addressLine2: previous.addressLine2,
            city: previous.city,
            postalCode: previous.postalCode,
            countryCode: previous.countryCode,
          },
          newValues: {
            displayName: updated.displayName,
            phone: updated.phone,
            addressLine1: updated.addressLine1,
            addressLine2: updated.addressLine2,
            city: updated.city,
            postalCode: updated.postalCode,
            countryCode: updated.countryCode,
          },
        });

        return updated;
      });
    }),

  /**
   * Submit a financial change request (bank account, SWIFT, tax ID).
   * Creates a pending ContractorChangeRequest — requires admin approval.
   */
  submitFinancialChangeRequest: portalProcedure
    .input(
      z.object({
        bankAccountNumber: z.string().optional(),
        bankName: z.string().optional(),
        swiftBic: z.string().max(11).optional(),
        taxId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Fail fast on empty payload before issuing any DB query.
      if (
        input.bankAccountNumber === undefined &&
        input.bankName === undefined &&
        input.swiftBic === undefined &&
        input.taxId === undefined
      ) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: E.PORTAL_NO_CHANGES,
        });
      }

      // Read current canonical contractor + billing profile values for the snapshot.
      const [contractor, currentProfile] = await Promise.all([
        ctx.db.contractor.findFirst({
          where: {
            id: ctx.contractorId,
            organizationId: ctx.organizationId,
            deletedAt: null,
          },
          select: { countryCode: true, taxId: true },
        }),
        ctx.db.contractorBillingProfile.findFirst({
          where: {
            contractorId: ctx.contractorId,
            organizationId: ctx.organizationId,
            isDefault: true,
          },
          select: {
            bankAccountMasked: true,
            bankName: true,
            swiftBic: true,
            taxId: true,
          },
        }),
      ]);

      if (!contractor) {
        throw new TRPCError({ code: 'NOT_FOUND', message: E.CONTRACTOR_NOT_FOUND });
      }

      const previousValues: Record<string, unknown> = {
        bankAccountMasked: currentProfile?.bankAccountMasked ?? null,
        bankName: currentProfile?.bankName ?? null,
        swiftBic: currentProfile?.swiftBic ?? null,
        taxId: contractor.taxId ?? currentProfile?.taxId ?? null,
      };

      // Build requested changes — encrypt bank account for storage
      const requestedChanges: Record<string, unknown> = {};

      if (input.bankAccountNumber !== undefined) {
        const cleaned = input.bankAccountNumber.replace(/\s/g, '');
        requestedChanges.bankAccountEncrypted = encryptBankAccount(cleaned);
        requestedChanges.bankAccountMasked = `****${cleaned.slice(-4)}`;
      }
      if (input.bankName !== undefined) {
        requestedChanges.bankName = input.bankName;
      }
      if (input.swiftBic !== undefined) {
        requestedChanges.swiftBic = input.swiftBic;
      }
      if (input.taxId !== undefined) {
        const normalizedTaxId = normalizeContractorTaxId(contractor.countryCode, input.taxId);
        assertValidContractorTaxId(contractor.countryCode, normalizedTaxId);
        requestedChanges.taxId = normalizedTaxId;
      }

      const changeRequest = await createChangeRequest(
        ctx.contractorId,
        ctx.organizationId,
        requestedChanges,
        previousValues,
      );

      return {
        id: changeRequest.id,
        status: changeRequest.status,
        createdAt: changeRequest.createdAt,
      };
    }),

  /**
   * Get notification preferences for all 5 categories.
   * Returns defaults (emailEnabled: true) for any missing categories.
   */
  getNotificationPreferences: portalProcedure.query(async ({ ctx }) => {
    const CATEGORIES = [
      'INVOICE_UPDATES',
      'PAYMENT_CONFIRMATIONS',
      'CONTRACT_CHANGES',
      'DOCUMENT_UPLOADS',
      'SECURITY_ALERTS',
    ] as const;

    const existing = await ctx.db.contractorNotificationPreference.findMany({
      where: {
        contractorId: ctx.contractorId,
        organizationId: ctx.organizationId,
      },
      select: {
        category: true,
        emailEnabled: true,
      },
    });

    const existingMap = new Map(existing.map(p => [p.category, p.emailEnabled]));

    // Return all 5 categories, defaulting to true for missing rows
    const preferences = CATEGORIES.map(category => ({
      category,
      emailEnabled: existingMap.get(category) ?? true,
    }));

    return preferences;
  }),

  /**
   * Update a single notification preference category.
   * SECURITY_ALERTS cannot be disabled.
   */
  updateNotificationPreference: portalProcedure
    .input(
      z.object({
        category: z.enum([
          'INVOICE_UPDATES',
          'PAYMENT_CONFIRMATIONS',
          'CONTRACT_CHANGES',
          'DOCUMENT_UPLOADS',
          'SECURITY_ALERTS',
        ]),
        emailEnabled: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Security alerts cannot be disabled
      if (input.category === 'SECURITY_ALERTS' && !input.emailEnabled) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: E.PORTAL_SECURITY_ALERTS_LOCKED,
        });
      }

      const preference = await ctx.db.contractorNotificationPreference.upsert({
        where: {
          contractorId_category: {
            contractorId: ctx.contractorId,
            category: input.category,
          },
        },
        create: {
          contractorId: ctx.contractorId,
          organizationId: ctx.organizationId,
          category: input.category,
          emailEnabled: input.emailEnabled,
        },
        update: {
          emailEnabled: input.emailEnabled,
        },
        select: {
          category: true,
          emailEnabled: true,
        },
      });

      return preference;
    }),

  /**
   * The logged-in contractor's own compliance items, driving the portal
   * self-service list + the home attention banner. Strictly scoped to the
   * portal-session contractor; no client-supplied id is trusted.
   */
  complianceItems: portalProcedure.query(async ({ ctx }) => {
    return ctx.db.contractorComplianceItem.findMany({
      where: { contractorId: ctx.contractorId, organizationId: ctx.organizationId },
      select: {
        id: true,
        name: true,
        documentType: true,
        policyRuleId: true,
        status: true,
        severity: true,
        expiresAt: true,
      },
      orderBy: [{ status: 'asc' }, { expiresAt: 'asc' }],
    });
  }),

  /**
   * Contractor self-service upload-replacement.
   *
   * The contractor uploads a replacement document; we flip the Document to
   * PENDING_REVIEW and emit a forensic audit row, but DO NOT touch the
   * ContractorComplianceItem status — the SATISFIED flip is admin-only.
   * Strictly scoped to the portal-session contractor: a cross-contractor
   * itemId/documentId is rejected NOT_FOUND. `suggestedExpiresAt` is the
   * contractor's hint for the admin reviewer only; the authoritative
   * expiresAt is written on approve. Lives on the portalRouter (not
   * classification) because the portal client only reaches portalAppRouter.
   */
  submitUploadReplacement: portalProcedure
    .input(
      z.object({
        itemId: z.string().min(1),
        documentId: z.string().min(1),
        originalFileName: z.string().min(1),
        fileSizeBytes: z.number().int().positive(),
        suggestedExpiresAt: z.string().date().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Atomically consume the PendingUpload row to recover the
      // server-stored storageKey. Rejects foreign/expired/wrong-purpose rows.
      const pending = await consumePendingUpload({
        db: ctx.db,
        organizationId: ctx.organizationId,
        documentId: input.documentId,
        expectedPurpose: 'PORTAL_COMPLIANCE_UPLOAD',
      });

      const result = await ctx.db.$transaction(async tx => {
        const item = await tx.contractorComplianceItem.findFirst({
          where: {
            id: input.itemId,
            contractorId: ctx.contractorId,
            organizationId: ctx.organizationId,
          },
          select: { id: true, contractorId: true, status: true },
        });
        if (!item) {
          throw new TRPCError({ code: 'NOT_FOUND', message: E.COMPLIANCE_ITEM_NOT_FOUND });
        }

        // Materialize the Document row using the server-trusted storage key.
        // Status starts as PENDING_REVIEW — admin approve/reject flips it.
        await tx.document.create({
          data: {
            id: input.documentId,
            organizationId: ctx.organizationId,
            storageKey: pending.storageKey,
            originalFileName: input.originalFileName,
            mimeType: pending.mimeType,
            fileSizeBytes: input.fileSizeBytes,
            documentType: 'OTHER',
            source: 'USER_UPLOAD',
            status: 'PENDING_REVIEW',
            virusScanStatus: 'PENDING',
            checksumSha256: '',
          },
        });

        // Link document to the contractor for ownership assertions.
        await tx.documentLink.create({
          data: {
            organizationId: ctx.organizationId,
            documentId: input.documentId,
            entityType: 'CONTRACTOR',
            entityId: ctx.contractorId,
            linkRole: 'PRIMARY',
          },
        });

        // Record the candidate document on the item so the admin can surface
        // the PENDING_REVIEW document in the compliance tab.
        // This is overwritten with the same value on approve, and cleared on
        // reject, so it is safe to set optimistically here.
        await tx.contractorComplianceItem.update({
          where: { id: input.itemId },
          data: { satisfiedByDocumentId: input.documentId },
        });

        await writeAuditLog({
          tx,
          organizationId: ctx.organizationId,
          actorType: 'CONTRACTOR',
          actorId: ctx.contractorId,
          action: 'compliance.upload.submitted',
          resourceType: 'CONTRACTOR',
          resourceId: item.contractorId,
          metadata: {
            itemId: input.itemId,
            documentId: input.documentId,
            suggestedExpiresAt: input.suggestedExpiresAt ?? null,
          },
        });
        // Item status intentionally unchanged — admin review flips it.
        return {
          itemId: item.id,
          documentId: input.documentId,
          status: item.status,
          storageKey: pending.storageKey,
        };
      });

      scheduleDocumentVirusScan(ctx.db, result.documentId, result.storageKey);

      return {
        itemId: result.itemId,
        documentId: result.documentId,
        status: result.status,
      };
    }),
});
