import { entityIdSchema } from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { router } from '../../init';
import { portalProcedure } from '../../middleware/portal-auth';
import { mapPortalDocLink, portalDocLinkInclude } from './portal-doc-mapper';
import type { ActivityEntry } from './portal-shared';
import { extractLatestInvoiceEvent } from './portal-shared';

export const portalContractsRouter = router({
  /**
   * Dashboard overview: active contracts, pending invoices, recent payments,
   * upcoming deadline, recent activity.
   */
  overview: portalProcedure.query(async ({ ctx }) => {
    const contractorId = ctx.contractorId;

    // Active contracts count
    const activeContracts = await ctx.db.contract.count({
      where: {
        contractorId,
        status: { in: ['ACTIVE', 'EXPIRING'] },
      },
    });

    // Pending invoices count
    const pendingInvoices = await ctx.db.invoice.count({
      where: {
        contractorId,
        status: { in: ['RECEIVED', 'UNDER_REVIEW', 'APPROVAL_PENDING'] },
        deletedAt: null,
      },
    });

    // Recent payments (last 90 days)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const recentPaidInvoices = await ctx.db.invoice.findMany({
      where: {
        contractorId,
        paymentStatus: 'PAID',
        paidAt: { gte: ninetyDaysAgo },
        deletedAt: null,
      },
      select: { totalMinor: true, currency: true },
    });

    const recentPaymentsMinor = recentPaidInvoices.reduce((sum, inv) => sum + inv.totalMinor, 0);
    const recentPaymentsCurrency = recentPaidInvoices[0]?.currency ?? 'PLN';

    // Upcoming deadline: earliest due date from unpaid invoices or earliest end date from expiring contracts
    const nextUnpaidInvoice = await ctx.db.invoice.findFirst({
      where: {
        contractorId,
        paymentStatus: { not: 'PAID' },
        deletedAt: null,
      },
      orderBy: { dueDate: 'asc' },
      select: { dueDate: true },
    });

    const nextExpiringContract = await ctx.db.contract.findFirst({
      where: {
        contractorId,
        status: 'EXPIRING',
        endDate: { not: null },
      },
      orderBy: { endDate: 'asc' },
      select: { endDate: true },
    });

    let upcomingDeadline: Date | null = null;
    const candidates: Date[] = [];
    if (nextUnpaidInvoice?.dueDate) candidates.push(nextUnpaidInvoice.dueDate);
    if (nextExpiringContract?.endDate) candidates.push(nextExpiringContract.endDate);
    if (candidates.length > 0) {
      upcomingDeadline = candidates.sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
    }

    // Recent activity: last 5 invoices with their status-derived events
    const recentInvoices = await ctx.db.invoice.findMany({
      where: { contractorId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        invoiceNumber: true,
        receivedAt: true,
        reviewedAt: true,
        approvedAt: true,
        paidAt: true,
        rejectedAt: true,
        rejectionReason: true,
      },
    });

    const recentActivity: ActivityEntry[] = [];
    for (const inv of recentInvoices) {
      const entry = extractLatestInvoiceEvent(inv);
      if (entry) recentActivity.push(entry);
    }

    return {
      activeContracts,
      pendingInvoices,
      recentPaymentsMinor,
      recentPaymentsCurrency,
      upcomingDeadline,
      recentActivity,
    };
  }),

  /**
   * List contractor's contracts (ACTIVE, EXPIRING, EXPIRED only).
   * Excludes internal fields per D-11 / Pitfall 3.
   */
  listContracts: portalProcedure.query(async ({ ctx }) => {
    const contracts = await ctx.db.contract.findMany({
      where: {
        contractorId: ctx.contractorId,
        status: { in: ['ACTIVE', 'EXPIRING', 'EXPIRED'] },
      },
      select: {
        id: true,
        contractNumber: true,
        title: true,
        type: true,
        status: true,
        startDate: true,
        endDate: true,
        currency: true,
        billingModel: true,
        rateType: true,
        rateValueMinor: true,
      },
      orderBy: { startDate: 'desc' },
    });

    return contracts;
  }),

  /**
   * Get contract detail with attached documents and download URLs.
   * Excludes internal fields. Generates presigned download URLs for documents.
   */
  getContract: portalProcedure.input(entityIdSchema).query(async ({ ctx, input }) => {
    const contract = await ctx.db.contract.findFirst({
      where: { id: input.id, contractorId: ctx.contractorId },
      select: {
        id: true,
        contractNumber: true,
        title: true,
        type: true,
        status: true,
        startDate: true,
        endDate: true,
        currency: true,
        billingModel: true,
        rateType: true,
        rateValueMinor: true,
        paymentTermsDays: true,
        autoRenewal: true,
        noticePeriodDays: true,
        ratePeriods: {
          select: {
            rateType: true,
            rateValueMinor: true,
            currency: true,
            validFrom: true,
            validTo: true,
          },
        },
      },
    });

    if (!contract) {
      throw new TRPCError({ code: 'NOT_FOUND' });
    }

    // Fetch attached documents via DocumentLink
    const docLinks = await ctx.db.documentLink.findMany({
      where: { entityType: 'CONTRACT', entityId: input.id },
      include: portalDocLinkInclude,
    });

    const documents = await Promise.all(docLinks.map(mapPortalDocLink));

    return { ...contract, documents };
  }),

  /**
   * List documents linked to this contractor and their contracts.
   * Generates presigned download URLs. Excludes storageKey.
   */
  listDocuments: portalProcedure.query(async ({ ctx }) => {
    // F-DB-24/25 — bound the contract scan. A contractor with 50k contracts
    // would otherwise pull every id into the next round-trip.
    const contractIds = await ctx.db.contract.findMany({
      where: { contractorId: ctx.contractorId },
      select: { id: true },
      take: 500,
    });
    const contractIdList = contractIds.map(c => c.id);

    // F-DB-25 — collapse the two separate documentLink.findMany calls into
    // a single OR query. Was 2-3 round-trips (contractor links + contract
    // ids + contract links); now 2 round-trips total.
    const docLinks = await ctx.db.documentLink.findMany({
      where: {
        OR: [
          { entityType: 'CONTRACTOR', entityId: ctx.contractorId },
          ...(contractIdList.length > 0
            ? [{ entityType: 'CONTRACT' as const, entityId: { in: contractIdList } }]
            : []),
        ],
      },
      include: portalDocLinkInclude,
      take: 500,
    });

    // Deduplicate by document ID (a doc can be linked to both the
    // contractor and one of their contracts).
    const seenIds = new Set<string>();
    const dedupedLinks = docLinks.filter(link => {
      if (seenIds.has(link.document.id)) return false;
      seenIds.add(link.document.id);
      return true;
    });

    return Promise.all(dedupedLinks.map(mapPortalDocLink));
  }),
});
