import type { Prisma } from '@contractor-ops/db';
import {
  contractorCreateSchema,
  contractorLifecycleTransitionSchema,
  contractorListSchema,
  contractorUpdateSchema,
  entityIdSchema,
} from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import * as E from '../../errors';
import { router } from '../../init';
import { findOrThrow } from '../../lib/find-or-throw';
import { requirePermission } from '../../middleware/rbac';
import { tenantProcedure } from '../../middleware/tenant';
import { writeAuditLog } from '../../services/audit-writer';
import { encryptBankAccount } from '../../services/bank-account-crypto';
import { syncSeatCountForOrg } from '../../services/billing-service';
import { CacheKeys, invalidateByPrefix } from '../../services/cache';
import { captureEvent } from '../../services/posthog';
import { sanitizeStrings } from '../../services/sanitize';
import {
  buildContractorRelationUpdates,
  computeComplianceHealth,
  computeListHealthBadge,
  diffContractorFields,
  handleVatIdChange,
  LEGAL_TRANSITIONS,
  mergeCustomBillingFields,
  updateBillingProfileIfNeeded,
} from './contractor-shared.js';

export const contractorCoreRouter = router({
  list: tenantProcedure
    .use(requirePermission({ contractor: ['read'] }))
    .input(contractorListSchema)
    .query(async ({ ctx, input }) => {
      const { page, pageSize, search, sortBy, sortOrder, filters } = input;

      const where: Prisma.ContractorWhereInput = {
        organizationId: ctx.organizationId,
        deletedAt: null,
      };

      if (filters?.status?.length) {
        where.status = { in: filters.status };
      }
      if (filters?.lifecycleStage?.length) {
        where.lifecycleStage = { in: filters.lifecycleStage };
      }
      if (filters?.ownerUserId?.length) {
        where.ownerUserId = { in: filters.ownerUserId };
      }
      if (filters?.primaryTeamId?.length) {
        where.primaryTeamId = { in: filters.primaryTeamId };
      }
      if (filters?.type?.length) {
        where.type = { in: filters.type };
      }
      if (filters?.billingModel?.length) {
        const bmIds: Array<{ id: string }> = await ctx.db.$queryRaw`
          SELECT id FROM "Contractor"
          WHERE "organizationId" = ${ctx.organizationId}
            AND "deletedAt" IS NULL
            AND "customFieldsJson"->>'billingModel' = ANY(${filters.billingModel}::text[])
        `;
        if (bmIds.length === 0) {
          return { items: [] as Record<string, unknown>[], total: 0, page, pageSize };
        }
        where.id = { ...(where.id as Record<string, unknown>), in: bmIds.map(r => r.id) };
      }

      if (search && search.length >= 2) {
        const terms = search
          .trim()
          .split(/\s+/)
          .map(t => t.replace(/[^a-zA-Z0-9\u00C0-\u024F]/g, ''))
          .filter(Boolean)
          .map(t => `${t}:*`)
          .join(' & ');

        if (terms) {
          const matchingIds: Array<{ id: string }> = await ctx.db.$queryRaw`
            SELECT id FROM "Contractor"
            WHERE "organizationId" = ${ctx.organizationId}
              AND "deletedAt" IS NULL
              AND "search_vector" @@ to_tsquery('simple', ${terms})
          `;

          if (matchingIds.length === 0) {
            return { items: [] as Record<string, unknown>[], total: 0, page, pageSize };
          }

          where.id = { in: matchingIds.map(r => r.id) };
        }
      }

      const [contractors, total] = await Promise.all([
        ctx.db.contractor.findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: { [sortBy]: sortOrder },
          include: {
            owner: { select: { id: true, name: true, image: true } },
            primaryTeam: { select: { id: true, name: true } },
            billingProfiles: {
              where: { isDefault: true },
              take: 1,
              select: {
                id: true,
                legalEntityName: true,
                preferredCurrency: true,
                paymentTermsDays: true,
              },
            },
            _count: {
              select: {
                complianceItems: {
                  where: {
                    status: { in: ['MISSING', 'EXPIRED'] },
                  },
                },
              },
            },
          },
        }),
        ctx.db.contractor.count({ where }),
      ]);

      const contractorIds = contractors.map(c => c.id);
      const pendingCounts =
        contractorIds.length > 0
          ? await ctx.db.contractorComplianceItem.groupBy({
              by: ['contractorId'],
              where: {
                contractorId: { in: contractorIds },
                status: 'PENDING',
              },
              _count: true,
            })
          : [];

      const pendingMap = new Map(pendingCounts.map(p => [p.contractorId, p._count]));

      const items = contractors.map(c => ({
        ...c,
        complianceHealth: computeListHealthBadge({
          missingOrExpired: c._count.complianceItems,
          pending: pendingMap.get(c.id) ?? 0,
        }),
      }));

      if (filters?.complianceHealth?.length) {
        const filtered = items.filter(i => filters.complianceHealth?.includes(i.complianceHealth));
        return {
          items: filtered,
          total: filtered.length,
          page,
          pageSize,
        };
      }

      return { items, total, page, pageSize };
    }),

  getById: tenantProcedure
    .use(requirePermission({ contractor: ['read'] }))
    .input(entityIdSchema)
    .query(async ({ ctx, input }) => {
      const now = new Date();
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const contractor = await ctx.db.contractor.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
        omit: { ssnEncrypted: true },
        include: {
          owner: { select: { id: true, name: true, image: true } },
          primaryTeam: { select: { id: true, name: true } },
          primaryProject: { select: { id: true, name: true } },
          defaultCostCenter: { select: { id: true, name: true } },
          billingProfiles: {
            orderBy: { isDefault: 'desc' },
            select: {
              id: true,
              legalEntityName: true,
              billingEmail: true,
              countryCode: true,
              addressLine1: true,
              addressLine2: true,
              city: true,
              postalCode: true,
              bankAccountMasked: true,
              bankName: true,
              swiftBic: true,
              preferredCurrency: true,
              paymentTermsDays: true,
              taxId: true,
              vatId: true,
              isDefault: true,
              validFrom: true,
              validTo: true,
              skontoTerms: {
                take: 1,
                select: {
                  discountPercent: true,
                  discountPeriodDays: true,
                  netPeriodDays: true,
                },
              },
            },
          },
          complianceItems: {
            include: {
              contract: { select: { id: true, title: true } },
            },
          },
          contracts: {
            take: 5,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              title: true,
              type: true,
              status: true,
              startDate: true,
              endDate: true,
              billingModel: true,
            },
          },
          _count: {
            select: {
              workflowRuns: true,
              invoices: true,
            },
          },
        },
      });

      if (!contractor) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: E.CONTRACTOR_NOT_FOUND,
        });
      }

      const activeContractCount = contractor.contracts.filter(c => c.status === 'ACTIVE').length;
      const expiringContractCount = contractor.contracts.filter(
        c =>
          c.status === 'ACTIVE' && c.endDate && c.endDate <= thirtyDaysFromNow && c.endDate >= now,
      ).length;

      const health = computeComplianceHealth({
        complianceItems: contractor.complianceItems.map(i => ({
          status: i.status,
          expiresAt: i.expiresAt,
        })),
        activeContractCount,
        expiringContractCount,
        overdueTaskCount: 0,
        unpaidInvoiceCount: 0,
      });

      const candidateDocIds = contractor.complianceItems
        .filter(i => i.satisfiedByDocumentId != null && i.status !== 'SATISFIED')
        .map(i => i.satisfiedByDocumentId as string);

      const pendingReviewDocIds =
        candidateDocIds.length > 0
          ? await ctx.db.document
              .findMany({
                where: { id: { in: candidateDocIds }, status: 'PENDING_REVIEW' },
                select: { id: true },
              })
              .then(docs => new Set(docs.map(d => d.id)))
          : new Set<string>();

      const complianceItems = contractor.complianceItems.map(i => ({
        ...i,
        pendingReviewDocumentId:
          i.satisfiedByDocumentId != null && pendingReviewDocIds.has(i.satisfiedByDocumentId)
            ? i.satisfiedByDocumentId
            : null,
      }));

      return {
        ...contractor,
        complianceItems,
        complianceHealth: health,
      };
    }),

  create: tenantProcedure
    .use(requirePermission({ contractor: ['create'] }))
    .input(contractorCreateSchema)
    .mutation(async ({ ctx, input: rawInput }) => {
      const input = sanitizeStrings(rawInput);
      const {
        billingModel,
        rateValueMinor,
        bankAccount,
        paymentTermsDays,
        ownerUserId,
        primaryTeamId,
        primaryProjectId,
        defaultCostCenterId,
        ...companyFields
      } = input;

      const contractor = await ctx.db.$transaction(async tx => {
        const created = await tx.contractor.create({
          data: {
            organizationId: ctx.organizationId,
            legalName: companyFields.legalName,
            displayName: companyFields.displayName,
            type: companyFields.type,
            taxId: companyFields.taxId,
            vatId: companyFields.vatId,
            registrationNumber: companyFields.registrationNumber,
            email: companyFields.email,
            phone: companyFields.phone,
            countryCode: companyFields.countryCode,
            currency: companyFields.currency,
            addressLine1: companyFields.addressLine1,
            addressLine2: companyFields.addressLine2,
            city: companyFields.city,
            postalCode: companyFields.postalCode,
            status: 'ACTIVE',
            lifecycleStage: 'DRAFT',
            ownerUserId,
            primaryTeamId,
            primaryProjectId,
            defaultCostCenterId,
            customFieldsJson: { billingModel, rateValueMinor },
          },
        });

        const maskedIban = bankAccount ? `****${bankAccount.replace(/\s/g, '').slice(-4)}` : null;

        await tx.contractorBillingProfile.create({
          data: {
            organizationId: ctx.organizationId,
            contractorId: created.id,
            legalEntityName: companyFields.legalName,
            preferredCurrency: companyFields.currency,
            countryCode: companyFields.countryCode,
            bankAccountMasked: maskedIban,
            bankAccountEncrypted: bankAccount
              ? encryptBankAccount(bankAccount.replace(/\s/g, ''))
              : null,
            paymentTermsDays: paymentTermsDays ?? null,
            validFrom: new Date(),
            isDefault: true,
          },
        });

        await writeAuditLog({
          organizationId: ctx.organizationId,
          actorType: 'USER',
          actorId: ctx.user?.id,
          action: 'CREATE',
          resourceType: 'CONTRACTOR',
          resourceId: created.id,
          resourceName: created.displayName,
          oldValues: null,
          newValues: {
            legalName: created.legalName,
            displayName: created.displayName,
            countryCode: created.countryCode,
            status: created.status,
            lifecycleStage: created.lifecycleStage,
          },
          tx,
        });

        return created;
      });

      void syncSeatCountForOrg(ctx.organizationId);
      void invalidateByPrefix(CacheKeys.dashboardPrefix(ctx.organizationId));

      void (async () => {
        try {
          const total = await ctx.db.contractor.count({
            where: { organizationId: ctx.organizationId },
          });
          if (total === 1 && ctx.user?.id) {
            await captureEvent({
              distinctId: ctx.user.id,
              event: 'first_contractor_added',
              organizationId: ctx.organizationId,
              properties: {
                contractor_id: contractor.id,
                country: contractor.countryCode,
              },
            });
          }
        } catch (err) {
          void err;
        }
      })();

      return contractor;
    }),

  update: tenantProcedure
    .use(requirePermission({ contractor: ['update'] }))
    .input(contractorUpdateSchema.and(entityIdSchema))
    .mutation(async ({ ctx, input: rawInput }) => {
      const input = sanitizeStrings(rawInput);
      const {
        id,
        billingModel,
        rateValueMinor,
        bankAccount,
        paymentTermsDays,
        ownerUserId,
        primaryTeamId,
        primaryProjectId,
        defaultCostCenterId,
        ...companyFields
      } = input;

      const existing = await findOrThrow(
        () =>
          ctx.db.contractor.findFirst({
            where: {
              id,
              organizationId: ctx.organizationId,
              deletedAt: null,
            },
          }),
        E.CONTRACTOR_NOT_FOUND,
      );

      const updateData: Prisma.ContractorUpdateInput = {
        ...companyFields,
        ...buildContractorRelationUpdates({
          ownerUserId,
          primaryTeamId,
          primaryProjectId,
          defaultCostCenterId,
        }),
      };

      const mergedCustomFields = mergeCustomBillingFields(
        (existing.customFieldsJson as Record<string, unknown>) ?? {},
        billingModel,
        rateValueMinor,
      );
      if (mergedCustomFields) {
        updateData.customFieldsJson = mergedCustomFields as Prisma.InputJsonValue;
      }

      const updated = await ctx.db.contractor.update({
        where: { id },
        data: updateData,
        omit: { ssnEncrypted: true },
      });

      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user?.id,
        action: 'UPDATE',
        resourceType: 'CONTRACTOR',
        resourceId: id,
        resourceName: updated.displayName,
        oldValues: diffContractorFields(existing, updateData).oldValues,
        newValues: diffContractorFields(existing, updateData).newValues,
      });

      await handleVatIdChange(ctx.db, id, ctx.organizationId, ctx.user?.id, existing, updated);

      await updateBillingProfileIfNeeded(
        ctx.db,
        id,
        ctx.organizationId,
        bankAccount,
        paymentTermsDays,
      );

      return updated;
    }),

  updateLifecycleStage: tenantProcedure
    .use(requirePermission({ contractor: ['update'] }))
    .input(contractorLifecycleTransitionSchema)
    .mutation(async ({ ctx, input }) => {
      const contractor = await findOrThrow(
        () =>
          ctx.db.contractor.findFirst({
            where: {
              id: input.id,
              organizationId: ctx.organizationId,
              deletedAt: null,
            },
          }),
        E.CONTRACTOR_NOT_FOUND,
      );

      const allowedTargets = LEGAL_TRANSITIONS[contractor.lifecycleStage] ?? [];
      if (!allowedTargets.includes(input.stage)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: E.CONTRACTOR_INVALID_TRANSITION,
        });
      }

      const updateData: Prisma.ContractorUpdateInput = {
        lifecycleStage: input.stage,
      };

      if (input.stage === 'ENDED') {
        const activeContracts = await ctx.db.contract.count({
          where: {
            contractorId: input.id,
            organizationId: ctx.organizationId,
            status: { in: ['ACTIVE', 'EXPIRING'] },
            deletedAt: null,
          },
        });

        if (activeContracts > 0) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: E.CONTRACTOR_HAS_ACTIVE_CONTRACTS,
          });
        }
      }

      if (input.stage === 'ENDED') {
        updateData.status = 'INACTIVE';
      } else if (input.stage === 'ACTIVE' && contractor.status === 'INACTIVE') {
        updateData.status = 'ACTIVE';
      }

      const updated = await ctx.db.contractor.update({
        where: { id: input.id },
        data: updateData,
        omit: { ssnEncrypted: true },
      });

      if (updateData.status) {
        void syncSeatCountForOrg(ctx.organizationId);
      }
      void invalidateByPrefix(CacheKeys.dashboardPrefix(ctx.organizationId));

      return updated;
    }),

  archive: tenantProcedure
    .use(requirePermission({ contractor: ['delete'] }))
    .input(entityIdSchema)
    .mutation(async ({ ctx, input }) => {
      const contractor = await findOrThrow(
        () =>
          ctx.db.contractor.findFirst({
            where: {
              id: input.id,
              organizationId: ctx.organizationId,
              deletedAt: null,
            },
          }),
        E.CONTRACTOR_NOT_FOUND,
      );

      const unpaidInvoiceCount = await ctx.db.invoice.count({
        where: {
          contractorId: input.id,
          organizationId: ctx.organizationId,
          paymentStatus: { notIn: ['PAID', 'NOT_READY'] },
        },
      });

      if (unpaidInvoiceCount > 0) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: E.CONTRACTOR_HAS_UNPAID_INVOICES,
        });
      }

      const activeWorkflowCount = await ctx.db.workflowRun.count({
        where: {
          contractorId: input.id,
          status: { in: ['IN_PROGRESS', 'BLOCKED'] },
        },
      });

      if (activeWorkflowCount > 0) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: E.CONTRACTOR_HAS_ACTIVE_WORKFLOWS,
        });
      }

      const activeContracts = await ctx.db.contract.count({
        where: {
          contractorId: input.id,
          organizationId: ctx.organizationId,
          status: { in: ['ACTIVE', 'EXPIRING'] },
          deletedAt: null,
        },
      });

      if (activeContracts > 0) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: E.CONTRACTOR_HAS_ACTIVE_CONTRACTS,
        });
      }

      await ctx.db.contractorChangeRequest.updateMany({
        where: {
          contractorId: input.id,
          organizationId: ctx.organizationId,
          status: 'PENDING',
        },
        data: {
          status: 'REJECTED',
          reviewComment: 'Auto-rejected: contractor archived',
        },
      });

      const updated = await ctx.db.contractor.update({
        where: { id: input.id },
        data: {
          status: 'ARCHIVED',
          lifecycleStage: 'ENDED',
          archivedAt: new Date(),
        },
        omit: { ssnEncrypted: true },
      });

      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user?.id,
        action: 'DELETE',
        resourceType: 'CONTRACTOR',
        resourceId: input.id,
        resourceName: updated.displayName,
        oldValues: {
          status: contractor.status,
          lifecycleStage: contractor.lifecycleStage,
        },
        newValues: {
          status: 'ARCHIVED',
          lifecycleStage: 'ENDED',
        },
      });

      void syncSeatCountForOrg(ctx.organizationId);
      void invalidateByPrefix(CacheKeys.dashboardPrefix(ctx.organizationId));

      return updated;
    }),

  export: tenantProcedure
    .use(requirePermission({ contractor: ['read'] }))
    .input(
      z.object({
        ids: z.array(z.string()).min(1).max(500),
        format: z.enum(['csv', 'xlsx']),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Contractors');

      const contractors = await ctx.db.contractor.findMany({
        where: {
          id: { in: input.ids },
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
        include: {
          billingProfiles: {
            where: { isDefault: true },
            take: 1,
            select: {
              id: true,
              legalEntityName: true,
              preferredCurrency: true,
              bankAccountMasked: true,
              paymentTermsDays: true,
            },
          },
        },
      });

      const columns = [
        { header: 'Legal Name', key: 'legalName' },
        { header: 'Display Name', key: 'displayName' },
        { header: 'Type', key: 'type' },
        { header: 'Tax ID', key: 'taxId' },
        { header: 'VAT ID', key: 'vatId' },
        { header: 'Email', key: 'email' },
        { header: 'Phone', key: 'phone' },
        { header: 'Country', key: 'country' },
        { header: 'Currency', key: 'currency' },
        { header: 'Status', key: 'status' },
        { header: 'Lifecycle Stage', key: 'lifecycleStage' },
        { header: 'City', key: 'city' },
        { header: 'Postal Code', key: 'postalCode' },
        { header: 'Payment Terms (days)', key: 'paymentTermsDays' },
      ] as const;

      worksheet.columns = columns.map(c => ({ header: c.header, key: c.key }));

      for (const c of contractors) {
        worksheet.addRow({
          legalName: c.legalName,
          displayName: c.displayName,
          type: c.type,
          taxId: c.taxId ?? '',
          vatId: c.vatId ?? '',
          email: c.email ?? '',
          phone: c.phone ?? '',
          country: c.countryCode,
          currency: c.currency,
          status: c.status,
          lifecycleStage: c.lifecycleStage,
          city: c.city ?? '',
          postalCode: c.postalCode ?? '',
          paymentTermsDays: c.billingProfiles[0]?.paymentTermsDays ?? '',
        });
      }

      const buffer = Buffer.from(
        input.format === 'csv'
          ? await workbook.csv.writeBuffer()
          : await workbook.xlsx.writeBuffer(),
      );

      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `contractors-${timestamp}.${input.format}`;

      return {
        data: buffer.toString('base64'),
        filename,
        mimeType:
          input.format === 'csv'
            ? 'text/csv'
            : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };
    }),
});
