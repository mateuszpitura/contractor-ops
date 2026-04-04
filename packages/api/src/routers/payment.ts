import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { prisma } from "@contractor-ops/db";
import {
  paymentRunCreateSchema,
  paymentRunLockSchema,
  paymentRunItemStatusSchema,
  paymentRunListSchema,
  paymentRunCancelSchema,
  markAllPaidSchema,
  bankStatementConfirmSchema,
  readyForPaymentListSchema,
  removeFromRunSchema,
} from "@contractor-ops/validators";
import * as E from "../errors.js";
import { router } from "../init.js";
import { tenantProcedure } from "../middleware/tenant.js";
import { requirePermission } from "../middleware/rbac.js";
import {
  generateCsv,
  generateElixir,
  generateSepaXml,
  resolveTransferTitle,
} from "../services/payment-export.js";
import type { ExportItem, OrgBankInfo } from "../services/payment-export.js";
import {
  parseBankStatement,
  matchStatementToRun,
} from "../services/bank-statement.js";

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

// ---------------------------------------------------------------------------
// Idempotency key cache for payment run creation (5-minute window)
// ---------------------------------------------------------------------------

const IDEMPOTENCY_TTL_MS = 5 * 60_000;

/** Maps "orgId:idempotencyKey" → { runIds, expiresAt } */
const idempotencyCache = new Map<
  string,
  { result: unknown; expiresAt: number }
>();

if (typeof globalThis !== "undefined") {
  const cleanup = () => {
    const now = Date.now();
    for (const [key, entry] of idempotencyCache) {
      if (now > entry.expiresAt) idempotencyCache.delete(key);
    }
  };
  setInterval(cleanup, 60_000).unref?.();
}

// ---------------------------------------------------------------------------
// Valid status transitions
// ---------------------------------------------------------------------------

const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["LOCKED", "CANCELLED"],
  LOCKED: ["EXPORTED", "CANCELLED"],
  EXPORTED: ["COMPLETED", "FAILED", "CANCELLED"],
  COMPLETED: [],
  FAILED: ["DRAFT"],
  CANCELLED: [],
};

// ---------------------------------------------------------------------------
// Payment Router
// ---------------------------------------------------------------------------

export const paymentRouter = router({
  // =========================================================================
  // readyForPayment — list invoices ready for payment
  // =========================================================================

  readyForPayment: tenantProcedure
    .use(requirePermission({ payment: ["read"] }))
    .input(readyForPaymentListSchema)
    .query(async ({ ctx, input }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: Record<string, any> = {
        organizationId: ctx.organizationId,
        paymentStatus: "READY",
        deletedAt: null,
      };

      if (input.currency) {
        where.currency = input.currency;
      }

      if (input.dueDateFrom || input.dueDateTo) {
        where.dueDate = {};
        if (input.dueDateFrom) where.dueDate.gte = input.dueDateFrom;
        if (input.dueDateTo) where.dueDate.lte = input.dueDateTo;
      }

      if (input.contractorId) {
        where.contractorId = input.contractorId;
      }

      if (input.cursor) {
        where.id = { gt: input.cursor };
      }

      const items = await prisma.invoice.findMany({
        where,
        take: input.limit + 1,
        orderBy: { dueDate: "asc" },
        include: {
          contractor: {
            select: { id: true, legalName: true, taxId: true },
          },
          billingProfile: {
            select: {
              id: true,
              bankAccountMasked: true,
              swiftBic: true,
              bankName: true,
              preferredCurrency: true,
            },
          },
          contract: {
            select: { id: true, contractNumber: true },
          },
        },
      });

      let nextCursor: string | undefined;
      if (items.length > input.limit) {
        const next = items.pop()!;
        nextCursor = next.id;
      }

      return plain({ items, nextCursor });
    }),

  // =========================================================================
  // create — create a new payment run from selected invoices
  // =========================================================================

  create: tenantProcedure
    .use(requirePermission({ payment: ["create"] }))
    .input(paymentRunCreateSchema)
    .mutation(async ({ ctx, input }) => {
      // Idempotency check: return cached result if same key was used recently
      if (input.idempotencyKey) {
        const cacheKey = `${ctx.organizationId}:${input.idempotencyKey}`;
        const cached = idempotencyCache.get(cacheKey);
        if (cached && Date.now() < cached.expiresAt) {
          return cached.result as ReturnType<typeof plain>;
        }
      }

      const result = await prisma.$transaction(async (tx) => {
        // Fetch all invoices with their data
        const invoices = await tx.invoice.findMany({
          where: {
            id: { in: input.invoiceIds },
            organizationId: ctx.organizationId,
            deletedAt: null,
          },
          include: {
            billingProfile: { select: { id: true, preferredCurrency: true } },
          },
        });

        // Verify all invoices have paymentStatus READY
        const notReady = invoices.filter(
          (inv) => inv.paymentStatus !== "READY",
        );
        if (notReady.length > 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: E.PAYMENT_INVOICES_NOT_READY,
          });
        }

        if (invoices.length !== input.invoiceIds.length) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: E.PAYMENT_INVOICES_NOT_FOUND,
          });
        }

        // Group invoices by currency if requested
        const groups: Map<string, typeof invoices> = new Map();
        if (input.groupByCurrency) {
          for (const inv of invoices) {
            const curr = inv.currency;
            if (!groups.has(curr)) groups.set(curr, []);
            groups.get(curr)!.push(inv);
          }
        } else {
          // Validate all invoices share the same currency
          const currencies = new Set(invoices.map((inv) => inv.currency));
          if (currencies.size > 1) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: E.PAYMENT_MIXED_CURRENCIES,
            });
          }
          groups.set(input.currency ?? invoices[0]?.currency ?? "PLN", invoices);
        }

        const runs = [];

        for (const [currency, groupInvoices] of groups) {
          // Generate sequential run number
          const year = new Date().getFullYear();
          const prefix = `PR-${year}-`;

          const lastRun = await tx.paymentRun.findFirst({
            where: {
              organizationId: ctx.organizationId,
              runNumber: { startsWith: prefix },
            },
            orderBy: { runNumber: "desc" },
            select: { runNumber: true },
          });

          const seq = lastRun?.runNumber
            ? parseInt(lastRun.runNumber.replace(prefix, ""), 10) + 1
            : 1;

          const runNumber = `${prefix}${String(seq).padStart(3, "0")}`;

          // Calculate totals
          const totalGrosze = groupInvoices.reduce(
            (sum, inv) => sum + inv.amountToPayGrosze,
            0,
          );

          // Create the run
          const run = await tx.paymentRun.create({
            data: {
              organizationId: ctx.organizationId,
              runNumber,
              name: input.name ?? null,
              status: "DRAFT",
              currency,
              createdByUserId: ctx.user!.id,
              totalGrosze,
              invoiceCount: groupInvoices.length,
              notes: input.notes ?? null,
            },
          });

          // Create items and update invoice paymentStatus
          for (const inv of groupInvoices) {
            await tx.paymentRunItem.create({
              data: {
                organizationId: ctx.organizationId,
                paymentRunId: run.id,
                invoiceId: inv.id,
                contractorId: inv.contractorId!,
                billingProfileId: inv.billingProfileId ?? null,
                amountGrosze: inv.amountToPayGrosze,
                currency: inv.currency,
                status: "PENDING",
              },
            });

            await tx.invoice.update({
              where: { id: inv.id },
              data: { paymentStatus: "IN_RUN" },
            });
          }

          runs.push(run);
        }

        return runs;
      });

      const plainResult = plain(result);

      // Cache result under idempotency key
      if (input.idempotencyKey) {
        const cacheKey = `${ctx.organizationId}:${input.idempotencyKey}`;
        idempotencyCache.set(cacheKey, {
          result: plainResult,
          expiresAt: Date.now() + IDEMPOTENCY_TTL_MS,
        });
      }

      return plainResult;
    }),

  // =========================================================================
  // get — get a single payment run with items and exports
  // =========================================================================

  get: tenantProcedure
    .use(requirePermission({ payment: ["read"] }))
    .input(z.object({ runId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const run = await prisma.paymentRun.findFirst({
        where: {
          id: input.runId,
          organizationId: ctx.organizationId,
        },
        include: {
          items: {
            include: {
              invoice: {
                select: { invoiceNumber: true, dueDate: true },
              },
              contractor: {
                select: { id: true, legalName: true, taxId: true },
              },
              billingProfile: {
                select: {
                  bankAccountMasked: true,
                  swiftBic: true,
                  bankName: true,
                },
              },
            },
          },
          exports: true,
        },
      });

      if (!run) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: E.PAYMENT_RUN_NOT_FOUND,
        });
      }

      return plain(run);
    }),

  // =========================================================================
  // list — list payment runs with pagination and filtering
  // =========================================================================

  list: tenantProcedure
    .use(requirePermission({ payment: ["read"] }))
    .input(paymentRunListSchema)
    .query(async ({ ctx, input }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: Record<string, any> = {
        organizationId: ctx.organizationId,
      };

      if (input.status) {
        where.status = input.status;
      }

      if (input.dateFrom || input.dateTo) {
        where.createdAt = {};
        if (input.dateFrom) where.createdAt.gte = input.dateFrom;
        if (input.dateTo) where.createdAt.lte = input.dateTo;
      }

      if (input.cursor) {
        where.id = { gt: input.cursor };
      }

      const items = await prisma.paymentRun.findMany({
        where,
        take: input.limit + 1,
        orderBy: { [input.sortBy]: input.sortOrder },
        include: {
          _count: { select: { items: true } },
        },
      });

      let nextCursor: string | undefined;
      if (items.length > input.limit) {
        const next = items.pop()!;
        nextCursor = next.id;
      }

      return plain({ items, nextCursor });
    }),

  // =========================================================================
  // lockAndExport — lock a run and generate export file
  // =========================================================================

  lockAndExport: tenantProcedure
    .use(requirePermission({ payment: ["export"] }))
    .input(paymentRunLockSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await prisma.$transaction(async (tx) => {
        const run = await tx.paymentRun.findFirst({
          where: {
            id: input.runId,
            organizationId: ctx.organizationId,
          },
          include: {
            items: {
              include: {
                invoice: {
                  select: {
                    invoiceNumber: true,
                    dueDate: true,
                    servicePeriodStart: true,
                    servicePeriodEnd: true,
                  },
                },
                contractor: {
                  select: {
                    legalName: true,
                    taxId: true,
                  },
                },
                billingProfile: {
                  select: {
                    bankAccountMasked: true,
                    swiftBic: true,
                    bankName: true,
                  },
                },
              },
            },
          },
        });

        if (!run) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: E.PAYMENT_RUN_NOT_FOUND,
          });
        }

        // Validate transition
        if (
          !VALID_TRANSITIONS[run.status]?.includes("LOCKED") &&
          !VALID_TRANSITIONS[run.status]?.includes("EXPORTED")
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: E.PAYMENT_RUN_INVALID_STATUS,
          });
        }

        // Fetch org settings for transfer title template and bank info
        const org = await tx.organization.findUnique({
          where: { id: ctx.organizationId },
          select: { name: true, metadata: true },
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const settingsJson = (org?.metadata as any)?.settingsJson ?? {};
        const transferTitleTemplate =
          settingsJson.paymentTransferTitleTemplate ?? "{invoice_number}";
        const orgBank: OrgBankInfo = {
          name: org?.name ?? "",
          iban: settingsJson.bankAccount?.iban ?? "",
          bic: settingsJson.bankAccount?.bic ?? "",
        };

        // Build ExportItems
        const exportItems: ExportItem[] = run.items.map((item) => {
          const billingPeriod =
            item.invoice.servicePeriodStart && item.invoice.servicePeriodEnd
              ? `${item.invoice.servicePeriodStart.toISOString().slice(0, 10)} - ${item.invoice.servicePeriodEnd.toISOString().slice(0, 10)}`
              : undefined;

          const transferTitle = resolveTransferTitle(transferTitleTemplate, {
            invoiceNumber: item.invoice.invoiceNumber,
            billingPeriod,
            contractorName: item.contractor.legalName,
          });

          return {
            contractorName: item.contractor.legalName,
            iban: item.billingProfile?.bankAccountMasked ?? "",
            amountGrosze: item.amountGrosze,
            currency: item.currency,
            invoiceNumber: item.invoice.invoiceNumber,
            taxId: item.contractor.taxId,
            bankName: item.billingProfile?.bankName ?? null,
            swiftBic: item.billingProfile?.swiftBic ?? null,
            dueDate: item.invoice.dueDate,
            transferTitle,
          };
        });

        // Generate export file
        let fileBuffer: Buffer;
        let ext: string;

        if (input.exportFormat === "CSV") {
          fileBuffer = await generateCsv(exportItems);
          ext = "csv";
        } else if (input.exportFormat === "BANK_FILE") {
          fileBuffer = generateElixir(exportItems, orgBank);
          ext = "txt";
        } else {
          fileBuffer = generateSepaXml(
            exportItems,
            orgBank,
            run.runNumber ?? run.id,
          );
          ext = "xml";
        }

        // Update run status to EXPORTED
        const updatedRun = await tx.paymentRun.update({
          where: { id: run.id },
          data: {
            status: "EXPORTED",
            exportFormat: input.exportFormat,
            exportedAt: new Date(),
          },
        });

        // Create export record
        await tx.paymentExport.create({
          data: {
            organizationId: ctx.organizationId,
            paymentRunId: run.id,
            format: input.exportFormat,
            status: "GENERATED",
            generatedByUserId: ctx.user!.id,
          },
        });

        return {
          run: updatedRun,
          fileBase64: fileBuffer.toString("base64"),
          fileName: `${run.runNumber ?? run.id}.${ext}`,
        };
      });

      return plain(result);
    }),

  // =========================================================================
  // updateItemStatus — mark individual item as paid/failed
  // =========================================================================

  updateItemStatus: tenantProcedure
    .use(requirePermission({ payment: ["create"] }))
    .input(paymentRunItemStatusSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await prisma.$transaction(async (tx) => {
        const item = await tx.paymentRunItem.findFirst({
          where: {
            id: input.itemId,
            organizationId: ctx.organizationId,
          },
          include: { paymentRun: true },
        });

        if (!item) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: E.PAYMENT_RUN_ITEM_NOT_FOUND,
          });
        }

        // Update item status
        const updatedItem = await tx.paymentRunItem.update({
          where: { id: item.id },
          data: {
            status: input.status,
            paymentReference: input.paymentReference ?? null,
            failureReason:
              input.status === "FAILED" ? input.failureReason : null,
            markedPaidAt: input.status === "PAID" ? new Date() : null,
          },
        });

        // Update invoice paymentStatus
        if (input.status === "PAID") {
          await tx.invoice.update({
            where: { id: item.invoiceId },
            data: { paymentStatus: "PAID", paidAt: new Date() },
          });
        } else if (input.status === "FAILED") {
          // Auto-release: failed items go back to READY (D-11)
          await tx.invoice.update({
            where: { id: item.invoiceId },
            data: { paymentStatus: "READY" },
          });
        }

        // Check if all items in run are terminal -> auto-complete
        const remaining = await tx.paymentRunItem.count({
          where: {
            paymentRunId: item.paymentRunId,
            status: { in: ["PENDING", "EXPORTED"] },
          },
        });

        if (remaining === 0) {
          const failedCount = await tx.paymentRunItem.count({
            where: {
              paymentRunId: item.paymentRunId,
              status: "FAILED",
            },
          });

          await tx.paymentRun.update({
            where: { id: item.paymentRunId },
            data: {
              status: failedCount > 0 ? "FAILED" : "COMPLETED",
              completedAt: new Date(),
            },
          });
        }

        return updatedItem;
      });

      return plain(result);
    }),

  // =========================================================================
  // markAllPaid — bulk mark all PENDING items as paid
  // =========================================================================

  markAllPaid: tenantProcedure
    .use(requirePermission({ payment: ["create"] }))
    .input(markAllPaidSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await prisma.$transaction(async (tx) => {
        const run = await tx.paymentRun.findFirst({
          where: {
            id: input.runId,
            organizationId: ctx.organizationId,
          },
          include: {
            items: {
              where: { status: { in: ["PENDING", "EXPORTED"] } },
            },
          },
        });

        if (!run) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: E.PAYMENT_RUN_NOT_FOUND,
          });
        }

        const now = new Date();
        const itemIds = run.items.map((i) => i.id);
        const invoiceIds = run.items.map((i) => i.invoiceId);

        // Batch update all pending items to PAID
        await tx.paymentRunItem.updateMany({
          where: { id: { in: itemIds } },
          data: {
            status: "PAID",
            paymentReference: input.batchReference ?? null,
            markedPaidAt: now,
          },
        });

        // Batch update all linked invoices to PAID
        await tx.invoice.updateMany({
          where: { id: { in: invoiceIds } },
          data: { paymentStatus: "PAID", paidAt: now },
        });

        // Mark run as completed
        const updatedRun = await tx.paymentRun.update({
          where: { id: run.id },
          data: {
            status: "COMPLETED",
            completedAt: now,
          },
        });

        return updatedRun;
      });

      return plain(result);
    }),

  // =========================================================================
  // cancel — cancel a payment run, release invoices back to READY
  // =========================================================================

  cancel: tenantProcedure
    .use(requirePermission({ payment: ["create"] }))
    .input(paymentRunCancelSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await prisma.$transaction(async (tx) => {
        const run = await tx.paymentRun.findFirst({
          where: {
            id: input.runId,
            organizationId: ctx.organizationId,
          },
          include: { items: true },
        });

        if (!run) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: E.PAYMENT_RUN_NOT_FOUND,
          });
        }

        // Check valid transition
        if (!VALID_TRANSITIONS[run.status]?.includes("CANCELLED")) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: E.PAYMENT_RUN_INVALID_STATUS,
          });
        }

        // EXPORTED runs require admin role (D-15)
        if (run.status === "EXPORTED") {
          const member = await tx.member.findFirst({
            where: {
              organizationId: ctx.organizationId,
              userId: ctx.user!.id,
            },
            select: { role: true },
          });

          if (member?.role !== "admin") {
            throw new TRPCError({
              code: "FORBIDDEN",
              message:
                "Only administrators can cancel exported payment runs. Ensure the export was NOT submitted to your bank before cancelling.",
            });
          }
        }

        // Batch release all non-paid items' invoices back to READY
        const unpaidInvoiceIds = run.items
          .filter((item) => item.status !== "PAID")
          .map((item) => item.invoiceId);

        if (unpaidInvoiceIds.length > 0) {
          await tx.invoice.updateMany({
            where: { id: { in: unpaidInvoiceIds } },
            data: { paymentStatus: "READY" },
          });
        }

        // Cancel the run
        const updatedRun = await tx.paymentRun.update({
          where: { id: run.id },
          data: { status: "CANCELLED" },
        });

        return updatedRun;
      });

      return plain(result);
    }),

  // =========================================================================
  // importStatement — parse bank statement and match to run items
  // =========================================================================

  importStatement: tenantProcedure
    .use(requirePermission({ payment: ["create"] }))
    .input(
      z.object({
        runId: z.string().cuid(),
        fileContent: z.string(),
        fileName: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const run = await prisma.paymentRun.findFirst({
        where: {
          id: input.runId,
          organizationId: ctx.organizationId,
        },
        include: {
          items: {
            include: {
              billingProfile: {
                select: { bankAccountMasked: true },
              },
            },
          },
        },
      });

      if (!run) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: E.PAYMENT_RUN_NOT_FOUND,
        });
      }

      if (run.status !== "EXPORTED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Bank statement can only be imported for exported payment runs",
        });
      }

      // Parse statement
      const transactions = parseBankStatement(
        input.fileContent,
        input.fileName,
      );

      // Build items for matching
      const matchItems = run.items.map((item) => ({
        id: item.id,
        amountGrosze: item.amountGrosze,
        iban: item.billingProfile?.bankAccountMasked ?? "",
      }));

      const matches = matchStatementToRun(transactions, matchItems);

      return plain({ matches, transactions });
    }),

  // =========================================================================
  // confirmStatementMatches — apply matched transactions as paid
  // =========================================================================

  confirmStatementMatches: tenantProcedure
    .use(requirePermission({ payment: ["create"] }))
    .input(bankStatementConfirmSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await prisma.$transaction(async (tx) => {
        const run = await tx.paymentRun.findFirst({
          where: {
            id: input.runId,
            organizationId: ctx.organizationId,
          },
        });

        if (!run) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: E.PAYMENT_RUN_NOT_FOUND,
          });
        }

        const now = new Date();

        // Update each matched item to PAID
        for (const match of input.matches) {
          const item = await tx.paymentRunItem.findFirst({
            where: {
              id: match.itemId,
              paymentRunId: run.id,
              organizationId: ctx.organizationId,
            },
          });

          if (!item) continue;

          await tx.paymentRunItem.update({
            where: { id: item.id },
            data: {
              status: "PAID",
              markedPaidAt: now,
            },
          });

          await tx.invoice.update({
            where: { id: item.invoiceId },
            data: { paymentStatus: "PAID", paidAt: now },
          });
        }

        // Check if all items terminal -> auto-complete
        const remaining = await tx.paymentRunItem.count({
          where: {
            paymentRunId: run.id,
            status: { in: ["PENDING", "EXPORTED"] },
          },
        });

        if (remaining === 0) {
          const failedCount = await tx.paymentRunItem.count({
            where: {
              paymentRunId: run.id,
              status: "FAILED",
            },
          });

          await tx.paymentRun.update({
            where: { id: run.id },
            data: {
              status: failedCount > 0 ? "FAILED" : "COMPLETED",
              completedAt: now,
            },
          });
        }

        // Return updated run
        const updatedRun = await tx.paymentRun.findUnique({
          where: { id: run.id },
          include: { items: true },
        });

        return updatedRun;
      });

      return plain(result);
    }),

  // =========================================================================
  // removeFromRun — remove an invoice from a DRAFT run (D-04)
  // =========================================================================

  removeFromRun: tenantProcedure
    .use(requirePermission({ payment: ["create"] }))
    .input(removeFromRunSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await prisma.$transaction(async (tx) => {
        const run = await tx.paymentRun.findFirst({
          where: {
            id: input.runId,
            organizationId: ctx.organizationId,
          },
        });

        if (!run) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: E.PAYMENT_RUN_NOT_FOUND,
          });
        }

        if (run.status !== "DRAFT") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: E.PAYMENT_RUN_NOT_DRAFT,
          });
        }

        // Find the item
        const item = await tx.paymentRunItem.findFirst({
          where: {
            paymentRunId: run.id,
            invoiceId: input.invoiceId,
            organizationId: ctx.organizationId,
          },
        });

        if (!item) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: E.PAYMENT_INVOICE_NOT_IN_RUN,
          });
        }

        // Delete the item
        await tx.paymentRunItem.delete({
          where: { id: item.id },
        });

        // Release invoice back to READY
        await tx.invoice.update({
          where: { id: input.invoiceId },
          data: { paymentStatus: "READY" },
        });

        // Recalculate run totals
        const remainingItems = await tx.paymentRunItem.findMany({
          where: { paymentRunId: run.id },
          select: { amountGrosze: true },
        });

        const newTotalGrosze = remainingItems.reduce(
          (sum, i) => sum + i.amountGrosze,
          0,
        );

        // If no items remain, auto-cancel the run
        if (remainingItems.length === 0) {
          return tx.paymentRun.update({
            where: { id: run.id },
            data: {
              totalGrosze: 0,
              invoiceCount: 0,
              status: "CANCELLED",
            },
          });
        }

        return tx.paymentRun.update({
          where: { id: run.id },
          data: {
            totalGrosze: newTotalGrosze,
            invoiceCount: remainingItems.length,
          },
        });
      });

      return plain(result);
    }),

  // =========================================================================
  // listByContractor — payment items for contractor profile Payments tab
  // =========================================================================

  listByContractor: tenantProcedure
    .use(requirePermission({ payment: ["read"] }))
    .input(z.object({ contractorId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const items = await prisma.paymentRunItem.findMany({
        where: {
          organizationId: ctx.organizationId,
          contractorId: input.contractorId,
        },
        include: {
          paymentRun: {
            select: { runNumber: true, status: true, createdAt: true },
          },
          invoice: {
            select: { invoiceNumber: true, dueDate: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      });

      return plain(items);
    }),
});
