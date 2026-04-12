import { prisma } from "@contractor-ops/db";
import {
  createSingleEntrySchema,
  getTimesheetSchema,
  listTimesheetsSchema,
  saveDraftEntriesSchema,
  submitTimesheetSchema,
  syncExternalEntriesSchema,
} from "@contractor-ops/validators";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router } from "../init.js";
import { portalProcedure } from "../middleware/portal-auth.js";
import { syncClockifyEntries } from "../services/clockify-sync.js";
import { syncJiraWorklogs } from "../services/jira-worklog-sync.js";
import { getOrCreateTimesheet, saveDraftEntries, submitTimesheet } from "../services/time-entry.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Strips Prisma class prototype from query results, producing plain
 * JSON-serializable objects so that inferred tRPC router types do NOT
 * reference the generated Prisma client module (avoids TS2742).
 */
function plain<T>(data: T): T {
  return JSON.parse(JSON.stringify(data)) as T;
}

/**
 * Returns the ISO Monday for a given date string (YYYY-MM-DD).
 */
function getISOMonday(dateStr: string): Date {
  const d = new Date(dateStr + "T00:00:00Z");
  const day = d.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

/**
 * Portal time tRPC router.
 *
 * All procedures use portalProcedure for contractor-scoped auth.
 * Provides: getTimesheet, getActiveContracts, saveDraftEntries,
 * createSingleEntry, submitTimesheet, listTimesheets, syncExternal,
 * getConnectedProviders.
 */
export const portalTimeRouter = router({
  // -------------------------------------------------------------------------
  // getTimesheet — fetch or create timesheet for a given week
  // -------------------------------------------------------------------------
  getTimesheet: portalProcedure.input(getTimesheetSchema).query(async ({ ctx, input }) => {
    const weekStart = new Date(input.weekStartDate + "T00:00:00Z");

    const timesheet = await getOrCreateTimesheet(
      prisma,
      ctx.organizationId,
      ctx.contractorId,
      weekStart,
    );

    // Fetch entries with contract info
    const entries = await prisma.timeEntry.findMany({
      where: {
        timesheetId: timesheet.id,
        organizationId: ctx.organizationId,
      },
      include: {
        contract: {
          select: { id: true, title: true },
        },
      },
      orderBy: { entryDate: "asc" },
    });

    return plain({ ...timesheet, entries });
  }),

  // -------------------------------------------------------------------------
  // getActiveContracts — contractor's active contracts for project picker
  // -------------------------------------------------------------------------
  getActiveContracts: portalProcedure.query(async ({ ctx }) => {
    const contracts = await prisma.contract.findMany({
      where: {
        organizationId: ctx.organizationId,
        contractorId: ctx.contractorId,
        status: "ACTIVE",
        deletedAt: null,
      },
      select: {
        id: true,
        title: true,
        rateType: true,
        rateValueGrosze: true,
      },
      orderBy: { title: "asc" },
    });

    return plain(contracts);
  }),

  // -------------------------------------------------------------------------
  // saveDraftEntries — save draft entries from weekly grid
  // -------------------------------------------------------------------------
  saveDraftEntries: portalProcedure
    .input(saveDraftEntriesSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await saveDraftEntries(
        prisma,
        ctx.organizationId,
        ctx.contractorId,
        input.timesheetId,
        input.entries,
      );

      return plain(result);
    }),

  // -------------------------------------------------------------------------
  // createSingleEntry — ad-hoc single entry from dialog
  // -------------------------------------------------------------------------
  createSingleEntry: portalProcedure
    .input(createSingleEntrySchema)
    .mutation(async ({ ctx, input }) => {
      // Get or create timesheet for the entry's week
      const monday = getISOMonday(input.entryDate);

      const timesheet = await getOrCreateTimesheet(
        prisma,
        ctx.organizationId,
        ctx.contractorId,
        monday,
      );

      const result = await saveDraftEntries(
        prisma,
        ctx.organizationId,
        ctx.contractorId,
        timesheet.id,
        [
          {
            contractId: input.contractId,
            entryDate: input.entryDate,
            minutes: input.minutes,
            description: input.description,
          },
        ],
      );

      return plain(result);
    }),

  // -------------------------------------------------------------------------
  // submitTimesheet — submit for manager review
  // -------------------------------------------------------------------------
  submitTimesheet: portalProcedure.input(submitTimesheetSchema).mutation(async ({ ctx, input }) => {
    const result = await submitTimesheet(
      prisma,
      ctx.organizationId,
      ctx.contractorId,
      input.timesheetId,
    );

    return plain(result);
  }),

  // -------------------------------------------------------------------------
  // listTimesheets — past timesheets with cursor pagination
  // -------------------------------------------------------------------------
  listTimesheets: portalProcedure.input(listTimesheetsSchema).query(async ({ ctx, input }) => {
    const where: Record<string, unknown> = {
      organizationId: ctx.organizationId,
      contractorId: ctx.contractorId,
    };

    if (input.status) {
      where.status = input.status;
    }
    if (input.from) {
      where.weekStartDate = {
        ...(where.weekStartDate as Record<string, unknown> | undefined),
        gte: new Date(input.from + "T00:00:00Z"),
      };
    }
    if (input.to) {
      where.weekStartDate = {
        ...(where.weekStartDate as Record<string, unknown> | undefined),
        lte: new Date(input.to + "T00:00:00Z"),
      };
    }
    if (input.cursor) {
      where.id = { lt: input.cursor };
    }

    const timesheets = await prisma.timesheet.findMany({
      where,
      orderBy: { weekStartDate: "desc" },
      take: input.limit + 1,
      select: {
        id: true,
        weekStartDate: true,
        status: true,
        totalMinutes: true,
        submittedAt: true,
        reviewedAt: true,
      },
    });

    let nextCursor: string | undefined;
    if (timesheets.length > input.limit) {
      const next = timesheets.pop();
      nextCursor = next?.id;
    }

    return plain({ items: timesheets, nextCursor });
  }),

  // -------------------------------------------------------------------------
  // syncExternal — trigger Clockify or Jira sync
  // -------------------------------------------------------------------------
  syncExternal: portalProcedure
    .input(syncExternalEntriesSchema)
    .mutation(async ({ ctx, input }) => {
      // Find the connected integration for the provider
      const connection = await prisma.integrationConnection.findFirst({
        where: {
          organizationId: ctx.organizationId,
          provider: input.provider,
          status: "CONNECTED",
        },
      });

      if (!connection) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `No connected ${input.provider} integration found. Connect it in Settings > Integrations.`,
        });
      }

      // Get or create timesheet for the start date's week
      const monday = getISOMonday(input.startDate);
      const timesheet = await getOrCreateTimesheet(
        prisma,
        ctx.organizationId,
        ctx.contractorId,
        monday,
      );

      // Find the contractor's first active contract for association
      const contract = await prisma.contract.findFirst({
        where: {
          organizationId: ctx.organizationId,
          contractorId: ctx.contractorId,
          status: "ACTIVE",
          deletedAt: null,
        },
        select: { id: true },
      });

      if (!contract) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No active contract found. You need an active contract to import time entries.",
        });
      }

      if (input.provider === "CLOCKIFY") {
        return syncClockifyEntries(
          prisma,
          ctx.organizationId,
          ctx.contractorId,
          contract.id,
          timesheet.id,
          connection.id,
          input.startDate,
          input.endDate,
        );
      }

      // JIRA
      return syncJiraWorklogs(
        prisma,
        ctx.organizationId,
        ctx.contractorId,
        contract.id,
        timesheet.id,
        connection.id,
        input.startDate,
        input.endDate,
      );
    }),

  // -------------------------------------------------------------------------
  // getConnectedProviders — which time providers are connected
  // -------------------------------------------------------------------------
  getConnectedProviders: portalProcedure.query(async ({ ctx }) => {
    const connections = await prisma.integrationConnection.findMany({
      where: {
        organizationId: ctx.organizationId,
        provider: { in: ["CLOCKIFY", "JIRA"] },
        status: "CONNECTED",
      },
      select: {
        provider: true,
      },
    });

    const providerDisplayNames: Record<string, string> = {
      CLOCKIFY: "Clockify",
      JIRA: "Jira",
    };

    return connections.map((c) => ({
      provider: c.provider,
      displayName: providerDisplayNames[c.provider] ?? c.provider,
    }));
  }),
});
