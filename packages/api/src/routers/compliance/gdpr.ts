import { z } from 'zod';
import { router } from '../../init';
import { requirePermission } from '../../middleware/rbac';
import { tenantProcedure } from '../../middleware/tenant';
import { deleteRegionalObject } from '../../services/regional-storage';

// ---------------------------------------------------------------------------
// Bulk delete / soft-delete helpers
// ---------------------------------------------------------------------------

/**
 * Hard-delete every row of a tenant-scoped model and return the row count.
 * Centralises the `deleteMany({ where: { organizationId } })` pattern that
 * the erasure mutation runs across ~40 models.
 */
async function deleteByOrgAndCount(
  model: {
    deleteMany: (args: { where: { organizationId: string } }) => Promise<{ count: number }>;
  },
  organizationId: string,
): Promise<number> {
  const result = await model.deleteMany({ where: { organizationId } });
  return result.count;
}

/**
 * Soft-delete (set `deletedAt`) every still-live row of a tenant-scoped
 * model and return the count of rows updated. Used for entities that are
 * preserved through the retention window before the data-purge cron
 * removes them permanently.
 */
async function softDeleteByOrgAndCount(
  model: {
    updateMany: (args: {
      where: { organizationId: string; deletedAt: null };
      data: { deletedAt: Date };
    }) => Promise<{ count: number }>;
  },
  organizationId: string,
  now: Date,
): Promise<number> {
  const result = await model.updateMany({
    where: { organizationId, deletedAt: null },
    data: { deletedAt: now },
  });
  return result.count;
}

// ---------------------------------------------------------------------------
// GDPR Router — Right to Erasure (Art. 17) + Data Portability (Art. 20)
// ---------------------------------------------------------------------------

export const gdprRouter = router({
  // =========================================================================
  // requestErasure — Soft-delete all org data (Right to Erasure, Art. 17)
  // =========================================================================

  /**
   * Initiates data erasure for the calling organization.
   *
   * This soft-deletes all major entity types. Permanent deletion happens
   * via the data-purge cron after the retention period (90 days).
   * Financial records (invoices, payment runs) are retained for the
   * legally required period per local tax law.
   *
   * Requires organization owner/admin permission.
   */
  requestErasure: tenantProcedure
    .use(requirePermission({ organization: ['delete'] }))
    .input(
      z.object({
        confirmPhrase: z.string().refine(v => v === 'DELETE ALL DATA', {
          message: 'You must type "DELETE ALL DATA" to confirm',
        }),
        /** Keep invoices for tax compliance (default: true). */
        retainFinancialRecords: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.organizationId;
      const now = new Date();

      const results: Record<string, number> = {};

      await ctx.db.$transaction(async tx => {
        // 1-3. Soft-delete top-level entities (preserved through the retention
        //      window so the data-purge cron can finalise + R2 cleanup).
        results.contractors = await softDeleteByOrgAndCount(tx.contractor, orgId, now);
        results.contracts = await softDeleteByOrgAndCount(tx.contract, orgId, now);
        results.documents = await softDeleteByOrgAndCount(tx.document, orgId, now);

        // 4a. Invoice child records (must be deleted before invoices due to FK)
        results.invoiceLines = await deleteByOrgAndCount(tx.invoiceLine, orgId);
        results.invoiceMatchResults = await deleteByOrgAndCount(tx.invoiceMatchResult, orgId);
        results.invoiceFiles = await deleteByOrgAndCount(tx.invoiceFile, orgId);
        results.documentLinks = await deleteByOrgAndCount(tx.documentLink, orgId);

        // 4b. Soft-delete invoices (unless retaining for tax compliance)
        if (input.retainFinancialRecords) {
          results.invoices = 0;
          results.invoicesRetained = await tx.invoice.count({
            where: { organizationId: orgId, deletedAt: null },
          });
        } else {
          results.invoices = await softDeleteByOrgAndCount(tx.invoice, orgId, now);
        }

        // 5-6. Notifications + audit logs (PII).
        results.notifications = await deleteByOrgAndCount(tx.notification, orgId);
        results.auditLogs = await deleteByOrgAndCount(tx.auditLog, orgId);

        // 7. Time tracking
        results.timeEntries = await deleteByOrgAndCount(tx.timeEntry, orgId);
        results.timesheets = await deleteByOrgAndCount(tx.timesheet, orgId);

        // 8. Payments (respect retainFinancialRecords flag)
        if (input.retainFinancialRecords) {
          results.paymentExports = 0;
          results.paymentRunItems = 0;
          results.paymentRuns = 0;
          results.paymentRunsRetained = await tx.paymentRun.count({
            where: { organizationId: orgId },
          });
        } else {
          results.paymentExports = await deleteByOrgAndCount(tx.paymentExport, orgId);
          results.paymentRunItems = await deleteByOrgAndCount(tx.paymentRunItem, orgId);
          results.paymentRuns = await deleteByOrgAndCount(tx.paymentRun, orgId);
        }

        // 9. Equipment & shipping
        results.shipmentEvents = await deleteByOrgAndCount(tx.shipmentEvent, orgId);
        results.returnRequests = await deleteByOrgAndCount(tx.returnRequest, orgId);
        results.shipments = await deleteByOrgAndCount(tx.shipment, orgId);
        results.equipmentAssignments = await deleteByOrgAndCount(tx.equipmentAssignment, orgId);
        results.equipment = await deleteByOrgAndCount(tx.equipment, orgId);
        results.courierConfigs = await deleteByOrgAndCount(tx.courierConfig, orgId);

        // 10. Approval chains
        results.approvalDecisions = await deleteByOrgAndCount(tx.approvalDecision, orgId);
        results.approvalSteps = await deleteByOrgAndCount(tx.approvalStep, orgId);
        results.approvalFlows = await deleteByOrgAndCount(tx.approvalFlow, orgId);
        results.approvalChainConfigs = await deleteByOrgAndCount(tx.approvalChainConfig, orgId);

        // 11. Workflows
        results.workflowAttachments = await deleteByOrgAndCount(tx.workflowAttachment, orgId);
        results.workflowComments = await deleteByOrgAndCount(tx.workflowComment, orgId);
        results.workflowTaskRuns = await deleteByOrgAndCount(tx.workflowTaskRun, orgId);
        results.workflowRuns = await deleteByOrgAndCount(tx.workflowRun, orgId);
        results.workflowTaskTemplates = await deleteByOrgAndCount(tx.workflowTaskTemplate, orgId);
        results.workflowTemplates = await deleteByOrgAndCount(tx.workflowTemplate, orgId);

        // 12. E-signatures (recipients must be deleted before envelopes due to FK).
        //     SigningRecipient is filtered through its envelope, not by orgId
        //     directly, so it stays inline.
        const signingRecipients = await tx.signingRecipient.deleteMany({
          where: { signingEnvelope: { organizationId: orgId } },
        });
        results.signingRecipients = signingRecipients.count;

        results.signingEvents = await deleteByOrgAndCount(tx.signingEvent, orgId);
        results.signingEnvelopes = await deleteByOrgAndCount(tx.signingEnvelope, orgId);

        // 13. Integrations
        results.integrationSyncLogs = await deleteByOrgAndCount(tx.integrationSyncLog, orgId);
        results.externalLinks = await deleteByOrgAndCount(tx.externalLink, orgId);
        results.integrationConnections = await deleteByOrgAndCount(tx.integrationConnection, orgId);
        results.webhookDeliveries = await deleteByOrgAndCount(tx.webhookDelivery, orgId);

        // 14. OCR extractions
        results.ocrExtractions = await deleteByOrgAndCount(tx.ocrExtraction, orgId);

        // 15. Contractor portal & self-service
        results.portalSessions = await deleteByOrgAndCount(tx.portalSession, orgId);
        results.contractorChangeRequests = await deleteByOrgAndCount(
          tx.contractorChangeRequest,
          orgId,
        );
        results.contractorNotificationPreferences = await deleteByOrgAndCount(
          tx.contractorNotificationPreference,
          orgId,
        );

        // 16. Contractor details (contacts, billing, assignments, compliance)
        results.contractorContacts = await deleteByOrgAndCount(tx.contractorContact, orgId);
        results.contractorBillingProfiles = await deleteByOrgAndCount(
          tx.contractorBillingProfile,
          orgId,
        );
        results.contractorAssignments = await deleteByOrgAndCount(tx.contractorAssignment, orgId);
        results.contractorComplianceItems = await deleteByOrgAndCount(
          tx.contractorComplianceItem,
          orgId,
        );
        results.complianceRequirementTemplates = await deleteByOrgAndCount(
          tx.complianceRequirementTemplate,
          orgId,
        );
        results.contractorTags = await deleteByOrgAndCount(tx.contractorTag, orgId);

        // 17. Notifications & reminders (user-level)
        results.userNotificationPreferences = await deleteByOrgAndCount(
          tx.userNotificationPreference,
          orgId,
        );
        results.comments = await deleteByOrgAndCount(tx.comment, orgId);
        results.reminderInstances = await deleteByOrgAndCount(tx.reminderInstance, orgId);
        results.reminderRules = await deleteByOrgAndCount(tx.reminderRule, orgId);

        // -----------------------------------------------------------------
        // 18. Portal magic tokens (global model, filtered by contractor email)
        // -----------------------------------------------------------------
        const orgContractorEmails = await tx.contractor.findMany({
          where: { organizationId: orgId },
          select: { email: true },
        });
        const emails = orgContractorEmails.map(c => c.email).filter(Boolean) as string[];
        if (emails.length > 0) {
          const portalTokens = await tx.portalMagicToken.deleteMany({
            where: { email: { in: emails } },
          });
          results.portalMagicTokens = portalTokens.count;
        }
      });

      // Clean up R2 objects for soft-deleted documents (outside transaction)
      const docsToClean = await ctx.db.document.findMany({
        where: { organizationId: orgId, deletedAt: { not: null } },
        select: { storageKey: true },
      });
      let r2Cleaned = 0;
      for (const doc of docsToClean) {
        if (doc.storageKey) {
          try {
            await deleteRegionalObject(doc.storageKey);
            r2Cleaned++;
          } catch {
            // Non-critical: data-purge cron will retry
          }
        }
      }
      results.r2ObjectsCleaned = r2Cleaned;

      // 7. Log the erasure request in audit (new org-level record)
      await ctx.db.auditLog.create({
        data: {
          organizationId: orgId,
          action: 'organization.erasure_requested',
          actorType: 'USER',
          actorId: ctx.user?.id,
          actorName: ctx.user?.name ?? ctx.user?.email,
          resourceType: 'ORGANIZATION',
          resourceId: orgId,
          resourceName: 'Data Erasure Request',
          ipAddress: ctx.headers.get('x-forwarded-for')?.split(',')[0] ?? null,
          userAgent: ctx.headers.get('user-agent') ?? null,
        },
      });

      return {
        success: true,
        summary: results,
        message:
          'Data has been soft-deleted. Permanent deletion will occur after the retention period (90 days). ' +
          (input.retainFinancialRecords
            ? 'Financial records (invoices) are retained for tax compliance.'
            : 'All data including financial records will be purged.'),
      };
    }),

  // =========================================================================
  // exportData — Data Portability (Art. 20)
  // =========================================================================

  /**
   * Exports all organization data as a structured JSON object.
   *
   * Returns contractors, contracts, invoices, documents (metadata only),
   * and audit logs. File contents are not included — download URLs
   * can be generated separately.
   *
   * Requires organization admin permission.
   */
  exportData: tenantProcedure
    .use(requirePermission({ organization: ['update'] }))
    .query(async ({ ctx }) => {
      const orgId = ctx.organizationId;

      const [organization, contractors, contracts, invoices, documents, auditLogs, members] =
        await Promise.all([
          ctx.db.organization.findUnique({
            where: { id: orgId },
            select: {
              id: true,
              name: true,
              slug: true,
              createdAt: true,
            },
          }),
          ctx.db.contractor.findMany({
            where: { organizationId: orgId, deletedAt: null },
            select: {
              id: true,
              legalName: true,
              displayName: true,
              taxId: true,
              email: true,
              status: true,
              lifecycleStage: true,
              createdAt: true,
              updatedAt: true,
            },
          }),
          ctx.db.contract.findMany({
            where: { organizationId: orgId, deletedAt: null },
            select: {
              id: true,
              contractNumber: true,
              title: true,
              contractorId: true,
              startDate: true,
              endDate: true,
              status: true,
              currency: true,
              rateValueMinor: true,
              createdAt: true,
            },
          }),
          ctx.db.invoice.findMany({
            where: { organizationId: orgId, deletedAt: null },
            select: {
              id: true,
              invoiceNumber: true,
              contractorId: true,
              issueDate: true,
              dueDate: true,
              totalMinor: true,
              currency: true,
              status: true,
              paymentStatus: true,
              createdAt: true,
            },
          }),
          ctx.db.document.findMany({
            where: { organizationId: orgId, deletedAt: null },
            select: {
              id: true,
              originalFileName: true,
              mimeType: true,
              fileSizeBytes: true,
              documentType: true,
              createdAt: true,
            },
          }),
          ctx.db.auditLog.findMany({
            where: { organizationId: orgId },
            select: {
              id: true,
              action: true,
              actorName: true,
              resourceType: true,
              resourceName: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 10000,
          }),
          ctx.db.member.findMany({
            where: { organizationId: orgId },
            select: {
              userId: true,
              role: true,
              createdAt: true,
            },
          }),
        ]);

      // Mask sensitive data for GDPR export
      const maskedContractors = contractors.map(c => ({
        ...c,
        taxId: c.taxId ? `****${c.taxId.slice(-4)}` : c.taxId,
      }));

      const maskedAuditLogs = auditLogs.map(log => ({
        ...log,
        actorName: log.actorName ? `${log.actorName.charAt(0)}***` : log.actorName,
      }));

      return {
        exportedAt: new Date().toISOString(),
        format: 'contractor-ops-export-v1',
        organization,
        members,
        contractors: maskedContractors,
        contracts,
        invoices,
        documents,
        auditLogs: maskedAuditLogs,
        counts: {
          contractors: contractors.length,
          contracts: contracts.length,
          invoices: invoices.length,
          documents: documents.length,
          auditLogs: auditLogs.length,
          members: members.length,
        },
      };
    }),
});
