import type { Jurisdiction, PersonnelRetentionRule } from '@contractor-ops/compliance-policy';
import {
  getPersonnelSections,
  mapCountryCodeToJurisdiction,
} from '@contractor-ops/compliance-policy';
import type { RetainedRecordType } from '@contractor-ops/db';
import {
  allowAuditPurge,
  getPersonnelRetentionCutoff,
  MODEL_RETENTION_TYPE,
} from '@contractor-ops/db';
import { z } from 'zod';
import { router } from '../../init';
import { requirePermission } from '../../middleware/rbac';
import { tenantProcedure } from '../../middleware/tenant';
import { writeAuditLog } from '../../services/audit-writer';
import { deleteRegionalObject } from '../../services/regional-storage';

// ---------------------------------------------------------------------------
// Statutory-retention exemption
// ---------------------------------------------------------------------------

/**
 * Human-readable statutory citation per retained record type, surfaced in the
 * erasure summary + audit log so an RODO/GDPR erasure never claims full
 * deletion of a record under an active statutory hold.
 *
 * Legal note: these citations need jurisdiction-specific legal/tax-adviser
 * verification before production deploy (Standing Project Constraint;
 * LOCAL-ONLY).
 */
const RETENTION_CITATIONS: Record<RetainedRecordType, string> = {
  '1099-NEC': 'IRS 1099-NEC: 4-year retention (26 CFR 1.6001-1)',
  'backup-withholding': 'IRS backup-withholding records: 7-year retention (26 CFR 31.6001-1)',
  'pl-akta-post2019':
    'PL akta osobowe: 10-year retention from end of employment (Kodeks pracy art. 94(4)-94(6); PENDING legal/tax adviser verification)',
  'pl-akta-legacy':
    'PL akta osobowe (pre-2019 regime): 50-year retention from end of employment (Kodeks pracy art. 94(5); PENDING legal/tax adviser verification)',
  'de-personalakte-tax':
    'DE Personalakte: 10-year retention for tax/commercial records (AO section 147 / HGB section 257; PENDING legal/tax adviser verification)',
  'de-accident-records':
    'DE occupational-health/accident records: 30-year retention (ArbMedVV / DGUV Vorschrift 1; PENDING legal/tax adviser verification)',
  'uk-personnel-general':
    'UK personnel records: 6-year retention after employment ends (Limitation Act 1980; PENDING legal/tax adviser verification)',
  'uk-personnel-financial':
    'UK pay/financial records: 7-year retention (HMRC PAYE + Limitation Act 1980; PENDING legal/tax adviser verification)',
  'us-i9-post-hire':
    'US Form I-9: retained 3 years after hire (8 CFR 274a.2; PENDING legal/tax adviser verification)',
  'us-i9-post-termination':
    'US Form I-9: retained 1 year after termination, whichever is later (8 CFR 274a.2; PENDING legal/tax adviser verification)',
  'KP-ewidencja':
    'PL ewidencja czasu pracy: 3-year DB-immutability floor (Kodeks pracy art. 291(1) claim limitation); the register is part of dokumentacja pracownicza retained 10 years (Kodeks pracy art. 94(4)), satisfied by non-deletion — the EwidencjaSnapshot table is append-only and never purged (PENDING legal/tax adviser verification)',
};

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

/**
 * Hard-delete every row of a worker-scoped model for the given worker ids and
 * return the count. Used for the leave / statutory-time records that hang off an
 * erased employee's Worker identity root.
 */
async function deleteByWorkersAndCount(
  model: {
    deleteMany: (args: {
      where: { organizationId: string; workerId: { in: string[] } };
    }) => Promise<{ count: number }>;
  },
  organizationId: string,
  workerIds: string[],
): Promise<number> {
  const result = await model.deleteMany({ where: { organizationId, workerId: { in: workerIds } } });
  return result.count;
}

// ---------------------------------------------------------------------------
// Employee personnel-file retention resolver
// ---------------------------------------------------------------------------

/**
 * File-level retention rules for a jurisdiction: the union of every section's
 * lifecycle-anchored rules (hire/termination), deduped by recordType.
 * DOCUMENT_DATE rules (e.g. DE accident records) are per-document — resolved on
 * the PersonnelFileDocument by the data-purge cron — so excluding them keeps a
 * file with no document date from being held forever. Mirrors the file-level
 * resolution the purge cron applies before a permanent delete.
 */
function personnelFileLevelRules(jurisdiction: Jurisdiction): PersonnelRetentionRule[] {
  const seen = new Set<string>();
  const rules: PersonnelRetentionRule[] = [];
  for (const section of getPersonnelSections(jurisdiction)) {
    for (const rule of section.retentionRules) {
      if (rule.anchor === 'DOCUMENT_DATE' || seen.has(rule.recordType)) continue;
      seen.add(rule.recordType);
      rules.push(rule);
    }
  }
  return rules;
}

type PersonnelFileRetentionRow = {
  countryCode: string;
  hireDate: Date | null;
  terminatedAt: Date | null;
  deletedAt: Date | null;
} | null;

/**
 * Whether an employee's national identifiers are held by an active statutory
 * personnel-file window (akta osobowe / Personalakte / UK file / US I-9).
 *
 * A worker with no personnel file (or an already soft-deleted one) has no active
 * hold — its identifiers are erasable. Otherwise the file-level window is
 * resolved off hire/termination: an unresolved jurisdiction or an in-window file
 * is HELD (fail-closed) so an erasure never destroys a statutorily retained ID.
 */
function resolveEmployeeHold(
  file: PersonnelFileRetentionRow,
  now: Date,
): { held: boolean; citation: string | null } {
  if (!file || file.deletedAt) return { held: false, citation: null };
  const jurisdiction = mapCountryCodeToJurisdiction(file.countryCode);
  if (!jurisdiction) {
    return {
      held: true,
      citation: 'Statutory personnel-file retention hold (jurisdiction unresolved)',
    };
  }
  const result = getPersonnelRetentionCutoff(personnelFileLevelRules(jurisdiction), {
    hireDate: file.hireDate,
    terminationDate: file.terminatedAt,
    documentDate: null,
    now,
  });
  return { held: !result.erasable, citation: result.citation };
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
          message: 'gdprConfirmPhraseRequired',
        }),
        /** Keep invoices for tax compliance (default: true). */
        retainFinancialRecords: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.organizationId;
      const now = new Date();

      const results: Record<string, number> = {};

      // Models under an active statutory-retention rule are
      // soft-deleted-with-exemption (NEVER hard-deleted), and surfaced with
      // their citation so the erasure summary cannot over-claim full deletion.
      // Ships EMPTY in production; tax models register here when ready.
      const retainedModels = MODEL_RETENTION_TYPE;
      const isRetained = (model: string): boolean => retainedModels[model] != null;
      const retainedUnderStatute: Record<string, string> = {};
      const recordRetention = (model: string): void => {
        const recordType = retainedModels[model];
        if (recordType) retainedUnderStatute[model] = RETENTION_CITATIONS[recordType];
      };

      await ctx.db.$transaction(async tx => {
        // 1-3. Soft-delete top-level entities (preserved through the retention
        //      window so the data-purge cron can finalise + R2 cleanup). A model
        //      under a statutory-retention hold is recorded with its citation so
        //      the summary surfaces the exemption.
        results.contractors = await softDeleteByOrgAndCount(tx.contractor, orgId, now);
        recordRetention('Contractor');
        results.contracts = await softDeleteByOrgAndCount(tx.contract, orgId, now);
        recordRetention('Contract');
        results.documents = await softDeleteByOrgAndCount(tx.document, orgId, now);
        recordRetention('Document');

        // 4a. Invoice child records (must be deleted before invoices due to FK)
        results.invoiceLines = await deleteByOrgAndCount(tx.invoiceLine, orgId);
        results.invoiceMatchResults = await deleteByOrgAndCount(tx.invoiceMatchResult, orgId);
        results.invoiceFiles = await deleteByOrgAndCount(tx.invoiceFile, orgId);
        results.documentLinks = await deleteByOrgAndCount(tx.documentLink, orgId);

        // 4b. Soft-delete invoices. A statutory-retention hold supersedes the
        //     user's purge choice: a retained model is always
        //     soft-deleted-with-exemption, never hard-deleted, and its citation
        //     is surfaced. Otherwise the existing retainFinancialRecords flag
        //     governs (count-only when retaining, soft-delete when purging).
        if (isRetained('Invoice')) {
          results.invoices = 0;
          results.invoicesRetained = await tx.invoice.count({
            where: { organizationId: orgId, deletedAt: null },
          });
          recordRetention('Invoice');
        } else if (input.retainFinancialRecords) {
          results.invoices = 0;
          results.invoicesRetained = await tx.invoice.count({
            where: { organizationId: orgId, deletedAt: null },
          });
        } else {
          results.invoices = await softDeleteByOrgAndCount(tx.invoice, orgId, now);
        }

        // 5-6. Notifications + audit logs (PII). AuditLog is DB-level
        //       append-only — opt this transaction into the purge so the
        //       auditlog_delete RLS policy permits the erasure DELETE.
        results.notifications = await deleteByOrgAndCount(tx.notification, orgId);
        await allowAuditPurge(tx);
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
        // 17b. Employee identity subtree — national-person identifiers.
        //      PESEL/SSN/iqama/Emirates ID live in EmployeeProfile encrypted
        //      columns and are reachable by NO other erasure path, so an org
        //      erasure MUST null them here. Personnel files carry
        //      per-jurisdiction statutory windows (akta osobowe / Personalakte /
        //      UK file / US I-9); a worker whose file is still inside its window
        //      is HELD — identifiers + personnel/leave records survive and the
        //      citation is surfaced (mirrors the retained-under-statute handling).
        // -----------------------------------------------------------------
        const employeeWorkers = await tx.worker.findMany({
          where: { organizationId: orgId, workerType: 'EMPLOYEE', deletedAt: null },
          select: {
            id: true,
            personnelFile: {
              select: {
                id: true,
                countryCode: true,
                hireDate: true,
                terminatedAt: true,
                deletedAt: true,
              },
            },
          },
        });

        const erasableWorkerIds: string[] = [];
        const erasablePersonnelFileIds: string[] = [];
        let personnelFilesHeld = 0;
        for (const worker of employeeWorkers) {
          const { held, citation } = resolveEmployeeHold(worker.personnelFile, now);
          if (held) {
            personnelFilesHeld++;
            if (citation) retainedUnderStatute.PersonnelFile = citation;
            continue;
          }
          erasableWorkerIds.push(worker.id);
          if (worker.personnelFile) erasablePersonnelFileIds.push(worker.personnelFile.id);
        }
        results.personnelFilesHeld = personnelFilesHeld;

        if (erasableWorkerIds.length > 0) {
          // National-person identifiers: null both the ciphertext and the masked
          // last-4 so nothing recoverable survives the erasure.
          results.employeeProfilesCleared = (
            await tx.employeeProfile.updateMany({
              where: { organizationId: orgId, workerId: { in: erasableWorkerIds } },
              data: {
                peselEncrypted: null,
                peselLast4: null,
                ssnEncrypted: null,
                ssnLast4: null,
                iqamaEncrypted: null,
                iqamaLast4: null,
                emiratesIdEncrypted: null,
                emiratesIdLast4: null,
              },
            })
          ).count;

          // Personnel file + its documents: soft-delete so the data-purge cron
          // finalises removal after the tenant-wide window.
          if (erasablePersonnelFileIds.length > 0) {
            results.personnelFileDocuments = (
              await tx.personnelFileDocument.updateMany({
                where: {
                  organizationId: orgId,
                  personnelFileId: { in: erasablePersonnelFileIds },
                  deletedAt: null,
                },
                data: { deletedAt: now },
              })
            ).count;
            results.personnelFiles = (
              await tx.personnelFile.updateMany({
                where: {
                  organizationId: orgId,
                  id: { in: erasablePersonnelFileIds },
                  deletedAt: null,
                },
                data: { deletedAt: now },
              })
            ).count;
          }

          // Leave + statutory working-time records for the erased employees.
          results.leaveRequests = await deleteByWorkersAndCount(
            tx.leaveRequest,
            orgId,
            erasableWorkerIds,
          );
          results.leaveLedgerEntries = await deleteByWorkersAndCount(
            tx.leaveLedgerEntry,
            orgId,
            erasableWorkerIds,
          );
          results.leaveBalances = await deleteByWorkersAndCount(
            tx.leaveBalance,
            orgId,
            erasableWorkerIds,
          );
          results.employeeTimeRecords = await deleteByWorkersAndCount(
            tx.employeeTimeRecord,
            orgId,
            erasableWorkerIds,
          );

          // Soft-delete the erased employee identity roots + drop the contact email.
          results.employeeWorkers = (
            await tx.worker.updateMany({
              where: { organizationId: orgId, id: { in: erasableWorkerIds }, deletedAt: null },
              data: { deletedAt: now, email: null },
            })
          ).count;
        }

        // Org-level leave config holds no personal data; drop it only when no
        // worker is still held (a held worker's leave rows still reference it).
        if (personnelFilesHeld === 0) {
          results.leaveTypes = await deleteByOrgAndCount(tx.leaveType, orgId);
          results.blackoutPeriods = await deleteByOrgAndCount(tx.blackoutPeriod, orgId);
        }

        // -----------------------------------------------------------------
        // 17c. Tax records (contractor-facing US / international filings).
        //      Governed by the same retainFinancialRecords flag as invoices +
        //      payments: kept for tax compliance by default, purged when the
        //      caller opts to erase financial records. A model under a statutory
        //      retention rule (Form1099Nec — IRS 4-year, 26 CFR 1.6001-1) is
        //      ALWAYS retained-with-exemption, superseding the flag; the paired
        //      Form1042S withholding return is soft-deleted (never hard-deleted)
        //      so any retention window still applies.
        // -----------------------------------------------------------------
        if (isRetained('Form1099Nec')) {
          results.form1099Nec = 0;
          results.form1099NecRetained = await tx.form1099Nec.count({
            where: { organizationId: orgId, deletedAt: null },
          });
          recordRetention('Form1099Nec');
        } else if (input.retainFinancialRecords) {
          results.form1099Nec = 0;
          results.form1099NecRetained = await tx.form1099Nec.count({
            where: { organizationId: orgId, deletedAt: null },
          });
        } else {
          results.form1099Nec = await softDeleteByOrgAndCount(tx.form1099Nec, orgId, now);
        }

        if (!input.retainFinancialRecords) {
          results.form1042s = await softDeleteByOrgAndCount(tx.form1042S, orgId, now);
          results.irisAcks = await deleteByOrgAndCount(tx.irisAck, orgId);
          results.irisSubmissions = await deleteByOrgAndCount(tx.irisSubmission, orgId);
          results.taxFormSubmissions = await deleteByOrgAndCount(tx.taxFormSubmission, orgId);
          results.whtCertificates = await deleteByOrgAndCount(tx.whtCertificate, orgId);
          results.taxIdValidations = await deleteByOrgAndCount(tx.taxIdValidation, orgId);
          results.form1099KTrackerStates = await deleteByOrgAndCount(
            tx.form1099KTrackerState,
            orgId,
          );
        }

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

        const ipAddress = ctx.headers.get('x-forwarded-for')?.split(',')[0] ?? null;
        const userAgent = ctx.headers.get('user-agent') ?? null;

        await writeAuditLog({
          tx,
          organizationId: orgId,
          action: 'organization.erasure_requested',
          actorType: 'USER',
          actorId: ctx.user?.id,
          actorName: ctx.user?.name ?? ctx.user?.email,
          resourceType: 'ORGANIZATION',
          resourceId: orgId,
          resourceName: 'Data Erasure Request',
          ipAddress,
          userAgent,
        });

        if (Object.keys(retainedUnderStatute).length > 0) {
          await writeAuditLog({
            tx,
            organizationId: orgId,
            action: 'organization.erasure_retained_under_statute',
            actorType: 'USER',
            actorId: ctx.user?.id,
            actorName: ctx.user?.name ?? ctx.user?.email,
            resourceType: 'ORGANIZATION',
            resourceId: orgId,
            resourceName: 'Data Erasure — Statutory Retention Hold',
            metadata: { retainedUnderStatute },
            ipAddress,
            userAgent,
          });
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
            // safe-swallow: R2 object already soft-deleted in DB; orphaned blob is reclaimed by the data-purge cron retry
          } catch {
            // Non-critical: data-purge cron will retry
          }
        }
      }
      results.r2ObjectsCleaned = r2Cleaned;

      const retainedModelNames = Object.keys(retainedUnderStatute);
      const hasStatutoryHold = retainedModelNames.length > 0;

      return {
        success: true,
        summary: { ...results, retainedUnderStatute },
        message:
          'Data has been soft-deleted. Permanent deletion will occur after the retention period (90 days). ' +
          (input.retainFinancialRecords
            ? 'Financial records (invoices) are retained for tax compliance.'
            : 'All data including financial records will be purged.') +
          (hasStatutoryHold
            ? ` The following records are held under an active statutory-retention obligation and are NOT erased: ${retainedModelNames.join(', ')}.`
            : ''),
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
