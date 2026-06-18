import type { Prisma } from '@contractor-ops/db';
import {
  contractorCreateSchema,
  contractorInsightsSchema,
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
  buildContractorListWhere,
  buildContractorRelationUpdates,
  computeComplianceHealth,
  computeListHealthBadge,
  diffContractorFields,
  handleVatIdChange,
  LEGAL_TRANSITIONS,
  mergeCustomBillingFields,
  paymentBlockedPredicate,
  stalledOnboardingPredicate,
  updateBillingProfileIfNeeded,
} from './contractor-shared.js';

/** Attention-rail "expiring soon" window + sparkline bucket count. */
const INSIGHTS_EXPIRING_WINDOW_DAYS = 30;
const INSIGHTS_SPARKLINE_BUCKETS = 6;

export const contractorCoreRouter = router({
  list: tenantProcedure
    .use(requirePermission({ contractor: ['read'] }))
    .input(contractorListSchema)
    .query(async ({ ctx, input }) => {
      const { page, pageSize, search, sortBy, sortOrder, filters } = input;

      const where = await buildContractorListWhere(ctx.db, ctx.organizationId, { search, filters });
      if (where === null) {
        return { items: [] as Record<string, unknown>[], total: 0, page, pageSize };
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

  /**
   * Portfolio insight band for the contractor list. Returns attention rollups
   * (what needs action) + composition counts (population segments) over the
   * same filter contract the table uses.
   *
   * Faceting model: counts are computed against the "core" population —
   * everything in the active filter set EXCEPT the composition / attention
   * facet groups (lifecycle, type, country, health, expiring, paymentBlocked,
   * stalled). This keeps segment counts from collapsing to zero as the user
   * drills, so each segment stays a live filter entry-point. `atRiskCompliance`
   * is the red bucket of the health tally — same `computeListHealthBadge` rule
   * as `list`, so the band and the table can never disagree on health.
   */
  insights: tenantProcedure
    .use(requirePermission({ contractor: ['read'] }))
    .input(contractorInsightsSchema)
    .query(async ({ ctx, input }) => {
      const now = new Date();
      const { search, filters } = input;

      const coreWhere = await buildContractorListWhere(
        ctx.db,
        ctx.organizationId,
        {
          search,
          filters: filters && {
            status: filters.status,
            ownerUserId: filters.ownerUserId,
            primaryTeamId: filters.primaryTeamId,
            billingModel: filters.billingModel,
          },
        },
        now,
      );

      const emptyHealth = { green: 0, yellow: 0, red: 0 };
      if (coreWhere === null) {
        return {
          attention: {
            atRiskCompliance: 0,
            expiringContracts: 0,
            paymentBlocked: 0,
            stalledOnboarding: 0,
            expirySparkline: Array<number>(INSIGHTS_SPARKLINE_BUCKETS).fill(0),
          },
          composition: {
            lifecycleStage: {} as Record<string, number>,
            type: {} as Record<string, number>,
            jurisdiction: [] as Array<{ countryCode: string; count: number }>,
            health: emptyHealth,
          },
          total: 0,
        };
      }

      const [lifecycleGroups, typeGroups, countryGroups, coreContractors, paymentBlocked, stalled] =
        await Promise.all([
          ctx.db.contractor.groupBy({
            by: ['lifecycleStage'],
            where: coreWhere,
            _count: { _all: true },
          }),
          ctx.db.contractor.groupBy({ by: ['type'], where: coreWhere, _count: { _all: true } }),
          ctx.db.contractor.groupBy({
            by: ['countryCode'],
            where: coreWhere,
            _count: { _all: true },
          }),
          ctx.db.contractor.findMany({
            where: coreWhere,
            select: {
              id: true,
              _count: {
                select: {
                  complianceItems: { where: { status: { in: ['MISSING', 'EXPIRED'] } } },
                },
              },
            },
          }),
          ctx.db.contractor.count({ where: { AND: [coreWhere, paymentBlockedPredicate()] } }),
          ctx.db.contractor.count({ where: { AND: [coreWhere, stalledOnboardingPredicate(now)] } }),
        ]);

      const ids = coreContractors.map(c => c.id);

      const [pendingCounts, expiringContracts] = await Promise.all([
        ids.length > 0
          ? ctx.db.contractorComplianceItem.groupBy({
              by: ['contractorId'],
              where: { contractorId: { in: ids }, status: 'PENDING' },
              _count: true,
            })
          : Promise.resolve([] as Array<{ contractorId: string; _count: number }>),
        ids.length > 0
          ? ctx.db.contract.findMany({
              where: {
                organizationId: ctx.organizationId,
                contractorId: { in: ids },
                status: { in: ['ACTIVE', 'EXPIRING'] },
                endDate: {
                  gte: now,
                  lte: new Date(
                    now.getTime() + INSIGHTS_EXPIRING_WINDOW_DAYS * 24 * 60 * 60 * 1000,
                  ),
                },
                deletedAt: null,
              },
              select: { contractorId: true, endDate: true },
            })
          : Promise.resolve([] as Array<{ contractorId: string; endDate: Date | null }>),
      ]);

      const pendingMap = new Map(pendingCounts.map(p => [p.contractorId, p._count]));
      const health = { green: 0, yellow: 0, red: 0 };
      for (const c of coreContractors) {
        const badge = computeListHealthBadge({
          missingOrExpired: c._count.complianceItems,
          pending: pendingMap.get(c.id) ?? 0,
        });
        health[badge] += 1;
      }

      const expirySparkline = Array<number>(INSIGHTS_SPARKLINE_BUCKETS).fill(0);
      const bucketMs =
        (INSIGHTS_EXPIRING_WINDOW_DAYS * 24 * 60 * 60 * 1000) / INSIGHTS_SPARKLINE_BUCKETS;
      const expiringContractorIds = new Set<string>();
      for (const c of expiringContracts) {
        expiringContractorIds.add(c.contractorId);
        if (!c.endDate) continue;
        const idx = Math.min(
          INSIGHTS_SPARKLINE_BUCKETS - 1,
          Math.max(0, Math.floor((c.endDate.getTime() - now.getTime()) / bucketMs)),
        );
        expirySparkline[idx] = (expirySparkline[idx] ?? 0) + 1;
      }

      const lifecycleStage: Record<string, number> = {};
      for (const g of lifecycleGroups) lifecycleStage[g.lifecycleStage] = g._count._all;
      const type: Record<string, number> = {};
      for (const g of typeGroups) type[g.type] = g._count._all;
      const jurisdiction = countryGroups
        .map(g => ({ countryCode: g.countryCode, count: g._count._all }))
        .sort((a, b) => b.count - a.count);

      return {
        attention: {
          atRiskCompliance: health.red,
          expiringContracts: expiringContractorIds.size,
          paymentBlocked,
          stalledOnboarding: stalled,
          expirySparkline,
        },
        composition: { lifecycleStage, type, jurisdiction, health },
        total: coreContractors.length,
      };
    }),

  /**
   * Per-contractor financial pulse for the detail overview widget. Single-scan
   * aggregates + a 12-month paid-invoice trend. Kept off `getById` so the widget
   * loads (and skeletons) independently of the detail page.
   */
  financialPulse: tenantProcedure
    .use(requirePermission({ contractor: ['read'] }))
    .input(entityIdSchema)
    .query(async ({ ctx, input }) => {
      const contractor = await ctx.db.contractor.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId, deletedAt: null },
        select: { id: true, currency: true },
      });
      if (!contractor) {
        throw new TRPCError({ code: 'NOT_FOUND', message: E.CONTRACTOR_NOT_FOUND });
      }

      const now = new Date();
      const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

      type Aggs = {
        outstandingMinor: bigint;
        readyToPayMinor: bigint;
        paidLast12mMinor: bigint;
        avgDaysToPay: number | null;
      };

      const [aggRows, trendRows] = await Promise.all([
        ctx.db.$queryRaw<Aggs[]>`
          SELECT
            COALESCE(SUM("amountToPayMinor") FILTER (
              WHERE "paymentStatus" <> 'PAID' AND "status" <> 'VOID'
            )::bigint, 0)::bigint AS "outstandingMinor",
            COALESCE(SUM("amountToPayMinor") FILTER (
              WHERE "paymentStatus" = 'READY'
            )::bigint, 0)::bigint AS "readyToPayMinor",
            COALESCE(SUM("totalMinor") FILTER (
              WHERE "paymentStatus" = 'PAID' AND "paidAt" >= ${twelveMonthsAgo}
            )::bigint, 0)::bigint AS "paidLast12mMinor",
            AVG(EXTRACT(EPOCH FROM ("paidAt" - "readyForPaymentAt")) / 86400.0) FILTER (
              WHERE "paymentStatus" = 'PAID'
                AND "paidAt" >= ${twelveMonthsAgo}
                AND "readyForPaymentAt" IS NOT NULL
            )::float8 AS "avgDaysToPay"
          FROM "Invoice"
          WHERE "organizationId" = ${ctx.organizationId}
            AND "contractorId" = ${input.id}
            AND "deletedAt" IS NULL
        `,
        ctx.db.$queryRaw<Array<{ month: Date; totalMinor: bigint }>>`
          SELECT date_trunc('month', "paidAt") AS month,
                 COALESCE(SUM("totalMinor")::bigint, 0)::bigint AS "totalMinor"
          FROM "Invoice"
          WHERE "organizationId" = ${ctx.organizationId}
            AND "contractorId" = ${input.id}
            AND "paymentStatus" = 'PAID'
            AND "paidAt" >= ${twelveMonthsAgo}
            AND "deletedAt" IS NULL
          GROUP BY date_trunc('month', "paidAt")
          ORDER BY month ASC
        `,
      ]);

      const agg = aggRows[0];
      return {
        outstandingMinor: Number(agg?.outstandingMinor ?? 0),
        readyToPayMinor: Number(agg?.readyToPayMinor ?? 0),
        paidLast12mMinor: Number(agg?.paidLast12mMinor ?? 0),
        avgDaysToPay: agg?.avgDaysToPay == null ? null : Math.round(Number(agg.avgDaysToPay)),
        invoiceTrendMinor: trendRows.map(r => Number(r.totalMinor)),
        currency: contractor.currency,
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

      let contractor: Awaited<ReturnType<typeof ctx.db.contractor.create>>;
      try {
        contractor = await ctx.db.$transaction(async tx => {
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
      } catch (err) {
        // A concurrent create can race past the application-level dedup and hit
        // the @@unique([organizationId, taxId]) constraint; surface it as a
        // clean CONFLICT rather than an unhandled INTERNAL_SERVER_ERROR.
        if (typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2002') {
          throw new TRPCError({
            code: 'CONFLICT',
            message: E.CONTRACTOR_TAX_ID_EXISTS,
          });
        }
        throw err;
      }

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
