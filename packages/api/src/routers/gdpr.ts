import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as E from "../errors.js";
import { router } from "../init.js";
import { requirePermission } from "../middleware/rbac.js";
import { tenantProcedure } from "../middleware/tenant.js";
import { deleteRegionalObject } from "../services/regional-storage.js";

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
    .use(requirePermission({ organization: ["delete"] }))
    .input(
      z.object({
        confirmPhrase: z.string().refine((v) => v === "DELETE ALL DATA", {
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

      await ctx.db.$transaction(async (tx) => {
        // 1. Soft-delete contractors
        const contractors = await tx.contractor.updateMany({
          where: { organizationId: orgId, deletedAt: null },
          data: { deletedAt: now },
        });
        results.contractors = contractors.count;

        // 2. Soft-delete contracts
        const contracts = await tx.contract.updateMany({
          where: { organizationId: orgId, deletedAt: null },
          data: { deletedAt: now },
        });
        results.contracts = contracts.count;

        // 3. Soft-delete documents
        const documents = await tx.document.updateMany({
          where: { organizationId: orgId, deletedAt: null },
          data: { deletedAt: now },
        });
        results.documents = documents.count;

        // 4a. Invoice child records (must be deleted before invoices due to FK)
        const invoiceLines = await tx.invoiceLine.deleteMany({
          where: { organizationId: orgId },
        });
        results.invoiceLines = invoiceLines.count;

        const invoiceMatchResults = await tx.invoiceMatchResult.deleteMany({
          where: { organizationId: orgId },
        });
        results.invoiceMatchResults = invoiceMatchResults.count;

        const invoiceFiles = await tx.invoiceFile.deleteMany({
          where: { organizationId: orgId },
        });
        results.invoiceFiles = invoiceFiles.count;

        const documentLinks = await tx.documentLink.deleteMany({
          where: { organizationId: orgId },
        });
        results.documentLinks = documentLinks.count;

        // 4b. Soft-delete invoices (unless retaining for tax compliance)
        if (!input.retainFinancialRecords) {
          const invoices = await tx.invoice.updateMany({
            where: { organizationId: orgId, deletedAt: null },
            data: { deletedAt: now },
          });
          results.invoices = invoices.count;
        } else {
          results.invoices = 0;
          results.invoicesRetained = await tx.invoice.count({
            where: { organizationId: orgId, deletedAt: null },
          });
        }

        // 5. Delete notifications
        const notifications = await tx.notification.deleteMany({
          where: { organizationId: orgId },
        });
        results.notifications = notifications.count;

        // 6. Delete audit logs (they contain PII like actor names)
        const auditLogs = await tx.auditLog.deleteMany({
          where: { organizationId: orgId },
        });
        results.auditLogs = auditLogs.count;

        // -----------------------------------------------------------------
        // 7. Time tracking
        // -----------------------------------------------------------------
        const timeEntries = await tx.timeEntry.deleteMany({
          where: { organizationId: orgId },
        });
        results.timeEntries = timeEntries.count;

        const timesheets = await tx.timesheet.deleteMany({
          where: { organizationId: orgId },
        });
        results.timesheets = timesheets.count;

        // -----------------------------------------------------------------
        // 8. Payments (respect retainFinancialRecords flag)
        // -----------------------------------------------------------------
        if (!input.retainFinancialRecords) {
          const paymentExports = await tx.paymentExport.deleteMany({
            where: { organizationId: orgId },
          });
          results.paymentExports = paymentExports.count;

          const paymentRunItems = await tx.paymentRunItem.deleteMany({
            where: { organizationId: orgId },
          });
          results.paymentRunItems = paymentRunItems.count;

          const paymentRuns = await tx.paymentRun.deleteMany({
            where: { organizationId: orgId },
          });
          results.paymentRuns = paymentRuns.count;
        } else {
          results.paymentExports = 0;
          results.paymentRunItems = 0;
          results.paymentRuns = 0;
          results.paymentRunsRetained = await tx.paymentRun.count({
            where: { organizationId: orgId },
          });
        }

        // -----------------------------------------------------------------
        // 9. Equipment & shipping
        // -----------------------------------------------------------------
        const shipmentEvents = await tx.shipmentEvent.deleteMany({
          where: { organizationId: orgId },
        });
        results.shipmentEvents = shipmentEvents.count;

        const returnRequests = await tx.returnRequest.deleteMany({
          where: { organizationId: orgId },
        });
        results.returnRequests = returnRequests.count;

        const shipments = await tx.shipment.deleteMany({
          where: { organizationId: orgId },
        });
        results.shipments = shipments.count;

        const equipmentAssignments = await tx.equipmentAssignment.deleteMany({
          where: { organizationId: orgId },
        });
        results.equipmentAssignments = equipmentAssignments.count;

        const equipment = await tx.equipment.deleteMany({
          where: { organizationId: orgId },
        });
        results.equipment = equipment.count;

        const courierConfigs = await tx.courierConfig.deleteMany({
          where: { organizationId: orgId },
        });
        results.courierConfigs = courierConfigs.count;

        // -----------------------------------------------------------------
        // 10. Approval chains
        // -----------------------------------------------------------------
        const approvalDecisions = await tx.approvalDecision.deleteMany({
          where: { organizationId: orgId },
        });
        results.approvalDecisions = approvalDecisions.count;

        const approvalSteps = await tx.approvalStep.deleteMany({
          where: { organizationId: orgId },
        });
        results.approvalSteps = approvalSteps.count;

        const approvalFlows = await tx.approvalFlow.deleteMany({
          where: { organizationId: orgId },
        });
        results.approvalFlows = approvalFlows.count;

        const approvalChainConfigs = await tx.approvalChainConfig.deleteMany({
          where: { organizationId: orgId },
        });
        results.approvalChainConfigs = approvalChainConfigs.count;

        // -----------------------------------------------------------------
        // 11. Workflows
        // -----------------------------------------------------------------
        const workflowAttachments = await tx.workflowAttachment.deleteMany({
          where: { organizationId: orgId },
        });
        results.workflowAttachments = workflowAttachments.count;

        const workflowComments = await tx.workflowComment.deleteMany({
          where: { organizationId: orgId },
        });
        results.workflowComments = workflowComments.count;

        const workflowTaskRuns = await tx.workflowTaskRun.deleteMany({
          where: { organizationId: orgId },
        });
        results.workflowTaskRuns = workflowTaskRuns.count;

        const workflowRuns = await tx.workflowRun.deleteMany({
          where: { organizationId: orgId },
        });
        results.workflowRuns = workflowRuns.count;

        const workflowTaskTemplates = await tx.workflowTaskTemplate.deleteMany({
          where: { organizationId: orgId },
        });
        results.workflowTaskTemplates = workflowTaskTemplates.count;

        const workflowTemplates = await tx.workflowTemplate.deleteMany({
          where: { organizationId: orgId },
        });
        results.workflowTemplates = workflowTemplates.count;

        // -----------------------------------------------------------------
        // 12. E-signatures (recipients must be deleted before envelopes due to FK)
        // -----------------------------------------------------------------
        const signingRecipients = await tx.signingRecipient.deleteMany({
          where: { organizationId: orgId },
        });
        results.signingRecipients = signingRecipients.count;

        const signingEvents = await tx.signingEvent.deleteMany({
          where: { organizationId: orgId },
        });
        results.signingEvents = signingEvents.count;

        const signingEnvelopes = await tx.signingEnvelope.deleteMany({
          where: { organizationId: orgId },
        });
        results.signingEnvelopes = signingEnvelopes.count;

        // -----------------------------------------------------------------
        // 13. Integrations
        // -----------------------------------------------------------------
        const integrationSyncLogs = await tx.integrationSyncLog.deleteMany({
          where: { organizationId: orgId },
        });
        results.integrationSyncLogs = integrationSyncLogs.count;

        const externalLinks = await tx.externalLink.deleteMany({
          where: { organizationId: orgId },
        });
        results.externalLinks = externalLinks.count;

        const integrationConnections = await tx.integrationConnection.deleteMany({
          where: { organizationId: orgId },
        });
        results.integrationConnections = integrationConnections.count;

        const webhookDeliveries = await tx.webhookDelivery.deleteMany({
          where: { organizationId: orgId },
        });
        results.webhookDeliveries = webhookDeliveries.count;

        // -----------------------------------------------------------------
        // 14. OCR extractions
        // -----------------------------------------------------------------
        const ocrExtractions = await tx.ocrExtraction.deleteMany({
          where: { organizationId: orgId },
        });
        results.ocrExtractions = ocrExtractions.count;

        // -----------------------------------------------------------------
        // 15. Contractor portal & self-service
        // -----------------------------------------------------------------
        const portalSessions = await tx.portalSession.deleteMany({
          where: { organizationId: orgId },
        });
        results.portalSessions = portalSessions.count;

        const contractorChangeRequests = await tx.contractorChangeRequest.deleteMany({
          where: { organizationId: orgId },
        });
        results.contractorChangeRequests = contractorChangeRequests.count;

        const contractorNotificationPreferences =
          await tx.contractorNotificationPreference.deleteMany({
            where: { organizationId: orgId },
          });
        results.contractorNotificationPreferences = contractorNotificationPreferences.count;

        // -----------------------------------------------------------------
        // 16. Contractor details (contacts, billing, assignments, compliance)
        // -----------------------------------------------------------------
        const contractorContacts = await tx.contractorContact.deleteMany({
          where: { organizationId: orgId },
        });
        results.contractorContacts = contractorContacts.count;

        const contractorBillingProfiles = await tx.contractorBillingProfile.deleteMany({
          where: { organizationId: orgId },
        });
        results.contractorBillingProfiles = contractorBillingProfiles.count;

        const contractorAssignments = await tx.contractorAssignment.deleteMany({
          where: { organizationId: orgId },
        });
        results.contractorAssignments = contractorAssignments.count;

        const contractorComplianceItems = await tx.contractorComplianceItem.deleteMany({
          where: { organizationId: orgId },
        });
        results.contractorComplianceItems = contractorComplianceItems.count;

        const complianceRequirementTemplates = await tx.complianceRequirementTemplate.deleteMany({
          where: { organizationId: orgId },
        });
        results.complianceRequirementTemplates = complianceRequirementTemplates.count;

        const contractorTags = await tx.contractorTag.deleteMany({
          where: { organizationId: orgId },
        });
        results.contractorTags = contractorTags.count;

        // -----------------------------------------------------------------
        // 17. Notifications & reminders (user-level)
        // -----------------------------------------------------------------
        const userNotificationPreferences = await tx.userNotificationPreference.deleteMany({
          where: { organizationId: orgId },
        });
        results.userNotificationPreferences = userNotificationPreferences.count;

        const comments = await tx.comment.deleteMany({
          where: { organizationId: orgId },
        });
        results.comments = comments.count;

        const reminderInstances = await tx.reminderInstance.deleteMany({
          where: { organizationId: orgId },
        });
        results.reminderInstances = reminderInstances.count;

        const reminderRules = await tx.reminderRule.deleteMany({
          where: { organizationId: orgId },
        });
        results.reminderRules = reminderRules.count;

        // -----------------------------------------------------------------
        // 18. Portal magic tokens (global model, filtered by contractor email)
        // -----------------------------------------------------------------
        const orgContractorEmails = await tx.contractor.findMany({
          where: { organizationId: orgId },
          select: { email: true },
        });
        const emails = orgContractorEmails.map((c) => c.email).filter(Boolean) as string[];
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
          action: "organization.erasure_requested",
          actorType: "USER",
          actorId: ctx.user!.id,
          actorName: ctx.user!.name ?? ctx.user!.email,
          resourceType: "ORGANIZATION",
          resourceId: orgId,
          resourceName: "Data Erasure Request",
          ipAddress: ctx.headers.get("x-forwarded-for")?.split(",")[0] ?? null,
          userAgent: ctx.headers.get("user-agent") ?? null,
        },
      });

      return {
        success: true,
        summary: results,
        message:
          "Data has been soft-deleted. Permanent deletion will occur after the retention period (90 days). " +
          (input.retainFinancialRecords
            ? "Financial records (invoices) are retained for tax compliance."
            : "All data including financial records will be purged."),
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
    .use(requirePermission({ organization: ["update"] }))
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
            orderBy: { createdAt: "desc" },
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
      const maskedContractors = contractors.map((c) => ({
        ...c,
        taxId: c.taxId ? "****" + c.taxId.slice(-4) : c.taxId,
      }));

      const maskedAuditLogs = auditLogs.map((log) => ({
        ...log,
        actorName: log.actorName ? log.actorName.charAt(0) + "***" : log.actorName,
      }));

      return {
        exportedAt: new Date().toISOString(),
        format: "contractor-ops-export-v1",
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
