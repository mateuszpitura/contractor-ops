import { prisma } from "@contractor-ops/db";
import {
  approvalChainCreateSchema,
  approvalChainUpdateSchema,
  approvalQueueSchema,
  approveStepSchema,
  bulkApproveSchema,
  bulkRejectSchema,
  delegateStepSchema,
  rejectStepSchema,
  requestClarificationSchema,
} from "@contractor-ops/validators";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as E from "../errors.js";
import { router } from "../init.js";
import { requirePermission } from "../middleware/rbac.js";
import { tenantProcedure } from "../middleware/tenant.js";
import {
  advanceFlow,
  computeSlaStatus,
  createApprovalFlow,
  routeToChain,
} from "../services/approval-engine.js";
import { CacheKeys, CacheTTL, cached, invalidate, invalidateByPrefix } from "../services/cache.js";
import {
  syncApprovalSlaDeadline,
  syncPaymentDueDeadline,
} from "../services/calendar-deadline-sync.js";
import { dispatch } from "../services/notification-service.js";

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
// Approval router
// ---------------------------------------------------------------------------

export const approvalRouter = router({
  // =========================================================================
  // Chain Config CRUD (admin — settings permission)
  // =========================================================================

  /**
   * List all approval chain configs for the organization.
   */
  listChains: tenantProcedure
    .use(requirePermission({ settings: ["read"] }))
    .query(async ({ ctx }) => {
      return cached(
        CacheKeys.approvalChains(ctx.organizationId),
        CacheTTL.APPROVAL_CHAINS,
        async () => {
          const chains = await prisma.approvalChainConfig.findMany({
            where: {
              organizationId: ctx.organizationId,
              resourceType: "INVOICE",
            },
            orderBy: { createdAt: "asc" },
          });

          return plain(chains);
        },
      );
    }),

  /**
   * Get a single approval chain config by ID.
   */
  getChain: tenantProcedure
    .use(requirePermission({ settings: ["read"] }))
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const chain = await prisma.approvalChainConfig.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
        },
      });

      if (!chain) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: E.APPROVAL_CHAIN_NOT_FOUND,
        });
      }

      return plain(chain);
    }),

  /**
   * Create a new approval chain config.
   * If isDefault=true, unsets any existing default chain first.
   */
  createChain: tenantProcedure
    .use(requirePermission({ settings: ["update"] }))
    .input(approvalChainCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const chain = await prisma.$transaction(async (tx) => {
        // If setting as default, unset existing default
        if (input.isDefault) {
          await tx.approvalChainConfig.updateMany({
            where: {
              organizationId: ctx.organizationId,
              resourceType: "INVOICE",
              isDefault: true,
            },
            data: { isDefault: false },
          });
        }

        return tx.approvalChainConfig.create({
          data: {
            organizationId: ctx.organizationId,
            resourceType: "INVOICE",
            name: input.name,
            isDefault: input.isDefault,
            conditionsJson: input.conditionsJson ?? undefined,
            stepsJson: JSON.parse(JSON.stringify(input.stepsJson)),
          },
        });
      });

      void invalidate(CacheKeys.approvalChains(ctx.organizationId));

      return plain(chain);
    }),

  /**
   * Update an existing approval chain config.
   * If setting isDefault=true, unsets existing default first.
   */
  updateChain: tenantProcedure
    .use(requirePermission({ settings: ["update"] }))
    .input(approvalChainUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const updated = await prisma.$transaction(async (tx) => {
        // Verify chain belongs to org
        const existing = await tx.approvalChainConfig.findFirst({
          where: { id, organizationId: ctx.organizationId },
        });

        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: E.APPROVAL_CHAIN_NOT_FOUND,
          });
        }

        // If setting as default, unset existing default
        if (data.isDefault) {
          await tx.approvalChainConfig.updateMany({
            where: {
              organizationId: ctx.organizationId,
              resourceType: "INVOICE",
              isDefault: true,
              id: { not: id },
            },
            data: { isDefault: false },
          });
        }

        return tx.approvalChainConfig.update({
          where: { id },
          data: {
            name: data.name,
            isDefault: data.isDefault,
            isActive: data.isActive,
            conditionsJson: data.conditionsJson ?? undefined,
            stepsJson: JSON.parse(JSON.stringify(data.stepsJson)),
          },
        });
      });

      void invalidate(CacheKeys.approvalChains(ctx.organizationId));

      return plain(updated);
    }),

  /**
   * Delete an approval chain config.
   * Prevents deletion if active approval flows reference this chain.
   */
  deleteChain: tenantProcedure
    .use(requirePermission({ settings: ["update"] }))
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await prisma.$transaction(async (tx) => {
        // Verify chain belongs to org
        const existing = await tx.approvalChainConfig.findFirst({
          where: { id: input.id, organizationId: ctx.organizationId },
        });

        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: E.APPROVAL_CHAIN_NOT_FOUND,
          });
        }

        // Check for active flows referencing this chain
        const activeFlow = await tx.approvalFlow.findFirst({
          where: {
            chainConfigId: input.id,
            status: "PENDING",
          },
        });

        if (activeFlow) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: E.APPROVAL_CHAIN_HAS_ACTIVE_FLOWS,
          });
        }

        await tx.approvalChainConfig.delete({ where: { id: input.id } });
      });

      void invalidate(CacheKeys.approvalChains(ctx.organizationId));

      return { success: true };
    }),

  // =========================================================================
  // Approval Queue
  // =========================================================================

  /**
   * List pending approval steps with invoice data and SLA status.
   * Supports "my" (assigned to current user) and "all" tabs.
   * Filters by status, search, and pagination.
   */
  listPending: tenantProcedure
    .use(requirePermission({ invoice: ["approve"] }))
    .input(approvalQueueSchema)
    .query(async ({ ctx, input }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: Record<string, any> = {
        organizationId: ctx.organizationId,
      };

      // Tab filter
      if (input.tab === "my") {
        where.approverUserId = ctx.user!.id;
      }

      // Status filter
      const now = new Date();
      if (input.status === "pending") {
        where.status = "PENDING";
      } else if (input.status === "overdue") {
        where.status = "PENDING";
        where.slaDeadline = { lt: now };
      } else if (input.status === "approved") {
        where.status = "APPROVED";
      } else if (input.status === "rejected") {
        where.status = "REJECTED";
      }
      // "all" — no additional status filter

      const [steps, total] = await Promise.all([
        prisma.approvalStep.findMany({
          where,
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
          orderBy: { slaDeadline: input.sortOrder },
          include: {
            approvalFlow: {
              select: {
                id: true,
                resourceId: true,
                resourceType: true,
                status: true,
                startedAt: true,
                chainConfigId: true,
              },
            },
            approver: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        }),
        prisma.approvalStep.count({ where }),
      ]);

      // Batch-fetch invoice data for all steps
      const invoiceIds = [...new Set(steps.map((s) => s.approvalFlow.resourceId))];

      const invoices = await prisma.invoice.findMany({
        where: { id: { in: invoiceIds } },
        select: {
          id: true,
          invoiceNumber: true,
          sellerName: true,
          totalGrosze: true,
          currency: true,
          createdAt: true,
          contractor: {
            select: { id: true, legalName: true },
          },
        },
      });

      const invoiceMap = new Map(invoices.map((inv) => [inv.id, inv]));

      // Parse chain configs to get slaHours per step
      const chainConfigIds = [
        ...new Set(steps.map((s) => s.approvalFlow.chainConfigId).filter(Boolean) as string[]),
      ];

      const chainConfigs =
        chainConfigIds.length > 0
          ? await prisma.approvalChainConfig.findMany({
              where: { id: { in: chainConfigIds } },
              select: { id: true, stepsJson: true },
            })
          : [];

      const chainConfigMap = new Map(chainConfigs.map((c) => [c.id, c.stepsJson]));

      // Enrich steps with invoice data and SLA status
      const enrichedSteps = steps.map((step) => {
        const invoice = invoiceMap.get(step.approvalFlow.resourceId);
        const chainSteps = step.approvalFlow.chainConfigId
          ? (chainConfigMap.get(step.approvalFlow.chainConfigId) as
              | Array<{ slaHours?: number }>
              | undefined)
          : undefined;
        const stepConfig = chainSteps?.[step.stepOrder - 1];
        const slaHours = stepConfig?.slaHours;

        return {
          ...step,
          invoice: invoice ?? null,
          slaStatus: computeSlaStatus(step.slaDeadline, step.status, slaHours),
        };
      });

      return {
        items: plain(enrichedSteps),
        total,
        page: input.page,
        pageSize: input.pageSize,
      };
    }),

  // =========================================================================
  // Approval Actions (all wrapped in prisma.$transaction)
  // =========================================================================

  /**
   * Approve an approval step.
   * Creates an ApprovalDecision, updates step to APPROVED,
   * advances flow to next step, and updates invoice if flow completes.
   */
  approve: tenantProcedure
    .use(requirePermission({ invoice: ["approve"] }))
    .input(approveStepSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await prisma.$transaction(async (tx) => {
        const step = await tx.approvalStep.findFirst({
          where: {
            id: input.stepId,
            organizationId: ctx.organizationId,
          },
          include: {
            approvalFlow: true,
          },
        });

        if (!step) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: E.APPROVAL_STEP_NOT_FOUND,
          });
        }

        if (step.status !== "PENDING") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: E.APPROVAL_STEP_NOT_PENDING,
          });
        }

        if (step.approverUserId !== ctx.user!.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: E.APPROVAL_NOT_ASSIGNED,
          });
        }

        // Create decision record
        await tx.approvalDecision.create({
          data: {
            organizationId: ctx.organizationId,
            approvalStepId: step.id,
            actorUserId: ctx.user!.id,
            decision: "APPROVE",
            comment: input.comment ?? null,
          },
        });

        // Update step
        const updatedStep = await tx.approvalStep.update({
          where: { id: step.id },
          data: {
            status: "APPROVED",
            actedAt: new Date(),
            decision: "APPROVE",
            comment: input.comment ?? null,
          },
        });

        // Advance flow
        const advanceResult = await advanceFlow(tx, step.approvalFlowId);

        // If flow completed, update invoice status and payment status
        if (advanceResult.completed) {
          await tx.invoice.update({
            where: { id: step.approvalFlow.resourceId },
            data: {
              status: "APPROVED",
              paymentStatus: "READY",
              readyForPaymentAt: new Date(),
            },
          });
        }

        // Fetch data needed for notifications
        const invoice = await tx.invoice.findUnique({
          where: { id: step.approvalFlow.resourceId },
          select: {
            id: true,
            invoiceNumber: true,
            totalGrosze: true,
            currency: true,
            contractorId: true,
            dueDate: true,
          },
        });

        const flow = await tx.approvalFlow.findUnique({
          where: { id: step.approvalFlowId },
          select: { id: true, createdByUserId: true, steps: { orderBy: { stepOrder: "asc" } } },
        });

        return { updatedStep, advanceResult, invoice, flow };
      });

      // Fire-and-forget: dispatch APPROVAL_DECISION to the user who submitted
      if (result.flow?.createdByUserId && result.invoice) {
        dispatch({
          organizationId: ctx.organizationId,
          type: "APPROVAL_DECISION",
          recipientUserIds: [result.flow.createdByUserId],
          title: `Invoice ${result.invoice.invoiceNumber} approved`,
          body: `Approved by ${ctx.user!.name ?? "approver"}`,
          entityType: "INVOICE",
          entityId: result.invoice.id,
          metadata: {
            invoiceNumber: result.invoice.invoiceNumber,
            decision: "approved",
            approverName: ctx.user!.name ?? "approver",
          },
        }).catch((err) => console.error("[approval] dispatch APPROVAL_DECISION failed:", err));
      }

      // If flow advanced to next step, dispatch APPROVAL_REQUEST to next approver
      if (
        !result.advanceResult.completed &&
        result.advanceResult.nextStepOrder &&
        result.flow &&
        result.invoice
      ) {
        const nextStep = result.flow.steps.find(
          (s) => s.stepOrder === result.advanceResult.nextStepOrder,
        );
        if (nextStep?.approverUserId) {
          const contractor = result.invoice.contractorId
            ? await prisma.contractor.findUnique({
                where: { id: result.invoice.contractorId },
                select: { legalName: true },
              })
            : null;

          const slaDeadline = nextStep.slaDeadline
            ? new Date(nextStep.slaDeadline).toISOString()
            : "";

          dispatch({
            organizationId: ctx.organizationId,
            type: "APPROVAL_REQUEST",
            recipientUserIds: [nextStep.approverUserId],
            title: `Approval requested for ${result.invoice.invoiceNumber}`,
            body: `${contractor?.legalName ?? "Unknown"} - ${(result.invoice.totalGrosze / 100).toFixed(2)} ${result.invoice.currency}`,
            entityType: "INVOICE",
            entityId: result.invoice.id,
            metadata: {
              invoiceNumber: result.invoice.invoiceNumber,
              contractorName: contractor?.legalName ?? "Unknown",
              amount: (result.invoice.totalGrosze / 100).toFixed(2),
              currency: result.invoice.currency,
              slaDeadline,
              invoiceId: result.invoice.id,
              flowId: result.flow.id,
            },
          }).catch((err) =>
            console.error("[approval] dispatch APPROVAL_REQUEST (next level) failed:", err),
          );
        }
      }

      // Calendar auto-push: sync payment deadline when invoice fully approved (D-07)
      if (result.advanceResult.completed && result.invoice?.dueDate) {
        const contractor = result.invoice.contractorId
          ? await prisma.contractor.findUnique({
              where: { id: result.invoice.contractorId },
              select: { displayName: true },
            })
          : null;
        void syncPaymentDueDeadline(prisma, {
          organizationId: ctx.organizationId,
          invoiceId: result.invoice.id,
          invoiceNumber: result.invoice.invoiceNumber ?? `INV-${result.invoice.id.slice(-6)}`,
          contractorName: contractor?.displayName ?? "Unknown",
          dueDate: new Date(result.invoice.dueDate),
          userId: ctx.user!.id,
        }).catch((err) => console.error("[approval] payment deadline sync failed:", err));
      }

      void invalidateByPrefix(CacheKeys.dashboardPrefix(ctx.organizationId));

      return plain(result.updatedStep);
    }),

  /**
   * Reject an approval step.
   * Creates a REJECT decision, marks step and flow as REJECTED,
   * and updates invoice status to REJECTED. Does NOT advance flow.
   */
  reject: tenantProcedure
    .use(requirePermission({ invoice: ["approve"] }))
    .input(rejectStepSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await prisma.$transaction(async (tx) => {
        const step = await tx.approvalStep.findFirst({
          where: {
            id: input.stepId,
            organizationId: ctx.organizationId,
          },
          include: {
            approvalFlow: true,
          },
        });

        if (!step) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: E.APPROVAL_STEP_NOT_FOUND,
          });
        }

        if (step.status !== "PENDING") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: E.APPROVAL_STEP_NOT_PENDING,
          });
        }

        if (step.approverUserId !== ctx.user!.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: E.APPROVAL_NOT_ASSIGNED,
          });
        }

        // Create decision record
        await tx.approvalDecision.create({
          data: {
            organizationId: ctx.organizationId,
            approvalStepId: step.id,
            actorUserId: ctx.user!.id,
            decision: "REJECT",
            comment: input.comment,
          },
        });

        // Update step
        const updatedStep = await tx.approvalStep.update({
          where: { id: step.id },
          data: {
            status: "REJECTED",
            actedAt: new Date(),
            decision: "REJECT",
            comment: input.comment,
          },
        });

        // Mark flow as REJECTED — do NOT advance
        await tx.approvalFlow.update({
          where: { id: step.approvalFlowId },
          data: {
            status: "REJECTED",
            completedAt: new Date(),
          },
        });

        // Update invoice status
        await tx.invoice.update({
          where: { id: step.approvalFlow.resourceId },
          data: { status: "REJECTED" },
        });

        // Fetch data for notification
        const invoice = await tx.invoice.findUnique({
          where: { id: step.approvalFlow.resourceId },
          select: { id: true, invoiceNumber: true },
        });

        const flow = await tx.approvalFlow.findUnique({
          where: { id: step.approvalFlowId },
          select: { createdByUserId: true },
        });

        return { updatedStep, invoice, flow };
      });

      // Fire-and-forget: dispatch APPROVAL_DECISION (rejected) to submitter
      if (result.flow?.createdByUserId && result.invoice) {
        dispatch({
          organizationId: ctx.organizationId,
          type: "APPROVAL_DECISION",
          recipientUserIds: [result.flow.createdByUserId],
          title: `Invoice ${result.invoice.invoiceNumber} rejected`,
          body: `Rejected by ${ctx.user!.name ?? "approver"}: ${input.comment}`,
          entityType: "INVOICE",
          entityId: result.invoice.id,
          metadata: {
            invoiceNumber: result.invoice.invoiceNumber,
            decision: "rejected",
            approverName: ctx.user!.name ?? "approver",
            comment: input.comment,
          },
        }).catch((err) =>
          console.error("[approval] dispatch APPROVAL_DECISION (reject) failed:", err),
        );
      }

      return plain(result.updatedStep);
    }),

  /**
   * Delegate an approval step to another user.
   * Creates a DELEGATE decision and updates the step's approverUserId.
   * Step remains PENDING (SLA continues per D-10).
   */
  delegate: tenantProcedure
    .use(requirePermission({ invoice: ["approve"] }))
    .input(delegateStepSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await prisma.$transaction(async (tx) => {
        const step = await tx.approvalStep.findFirst({
          where: {
            id: input.stepId,
            organizationId: ctx.organizationId,
          },
        });

        if (!step) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: E.APPROVAL_STEP_NOT_FOUND,
          });
        }

        if (step.status !== "PENDING") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: E.APPROVAL_STEP_NOT_PENDING,
          });
        }

        if (step.approverUserId !== ctx.user!.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: E.APPROVAL_NOT_ASSIGNED,
          });
        }

        // Verify delegate user exists in the organization
        const delegateMember = await tx.member.findFirst({
          where: {
            organizationId: ctx.organizationId,
            userId: input.delegateToUserId,
          },
        });

        if (!delegateMember) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: E.APPROVAL_DELEGATE_NOT_MEMBER,
          });
        }

        // Create decision record
        await tx.approvalDecision.create({
          data: {
            organizationId: ctx.organizationId,
            approvalStepId: step.id,
            actorUserId: ctx.user!.id,
            decision: "DELEGATE",
            comment: input.comment ?? null,
          },
        });

        // Update step — reassign approver, keep PENDING
        const updatedStep = await tx.approvalStep.update({
          where: { id: step.id },
          data: {
            approverUserId: input.delegateToUserId,
          },
        });

        return updatedStep;
      });

      void invalidateByPrefix(CacheKeys.dashboardPrefix(ctx.organizationId));

      return plain(result);
    }),

  /**
   * Request clarification on an approval step.
   * Creates a REQUEST_CHANGES decision. Step remains PENDING.
   */
  requestClarification: tenantProcedure
    .use(requirePermission({ invoice: ["approve"] }))
    .input(requestClarificationSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await prisma.$transaction(async (tx) => {
        const step = await tx.approvalStep.findFirst({
          where: {
            id: input.stepId,
            organizationId: ctx.organizationId,
          },
        });

        if (!step) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: E.APPROVAL_STEP_NOT_FOUND,
          });
        }

        if (step.status !== "PENDING") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: E.APPROVAL_STEP_NOT_PENDING,
          });
        }

        if (step.approverUserId !== ctx.user!.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: E.APPROVAL_NOT_ASSIGNED,
          });
        }

        // Create decision record
        await tx.approvalDecision.create({
          data: {
            organizationId: ctx.organizationId,
            approvalStepId: step.id,
            actorUserId: ctx.user!.id,
            decision: "REQUEST_CHANGES",
            comment: input.comment,
          },
        });

        return step;
      });

      return plain(result);
    }),

  // =========================================================================
  // Bulk Actions
  // =========================================================================

  /**
   * Bulk approve multiple approval steps.
   * Processes each step individually via Promise.allSettled.
   * Returns success/failure counts and error details.
   */
  bulkApprove: tenantProcedure
    .use(requirePermission({ invoice: ["approve"] }))
    .input(bulkApproveSchema)
    .mutation(async ({ ctx, input }) => {
      const results = await Promise.allSettled(
        input.stepIds.map(async (stepId) => {
          await prisma.$transaction(async (tx) => {
            const step = await tx.approvalStep.findFirst({
              where: {
                id: stepId,
                organizationId: ctx.organizationId,
                status: "PENDING",
                approverUserId: ctx.user!.id,
              },
              include: { approvalFlow: true },
            });

            if (!step) {
              throw new Error(`Step ${stepId} not found or not assignable`);
            }

            await tx.approvalDecision.create({
              data: {
                organizationId: ctx.organizationId,
                approvalStepId: step.id,
                actorUserId: ctx.user!.id,
                decision: "APPROVE",
              },
            });

            await tx.approvalStep.update({
              where: { id: step.id },
              data: {
                status: "APPROVED",
                actedAt: new Date(),
                decision: "APPROVE",
              },
            });

            const advanceResult = await advanceFlow(tx, step.approvalFlowId);

            if (advanceResult.completed) {
              await tx.invoice.update({
                where: { id: step.approvalFlow.resourceId },
                data: {
                  status: "APPROVED",
                  paymentStatus: "READY",
                  readyForPaymentAt: new Date(),
                },
              });

              // Calendar auto-push: sync payment deadline for bulk-approved invoice (D-07)
              const invoice = await tx.invoice.findUnique({
                where: { id: step.approvalFlow.resourceId },
                select: { id: true, invoiceNumber: true, dueDate: true, contractorId: true },
              });
              if (invoice?.dueDate) {
                const contractor = invoice.contractorId
                  ? await prisma.contractor.findUnique({
                      where: { id: invoice.contractorId },
                      select: { displayName: true },
                    })
                  : null;
                void syncPaymentDueDeadline(prisma, {
                  organizationId: ctx.organizationId,
                  invoiceId: invoice.id,
                  invoiceNumber: invoice.invoiceNumber ?? `INV-${invoice.id.slice(-6)}`,
                  contractorName: contractor?.displayName ?? "Unknown",
                  dueDate: new Date(invoice.dueDate),
                  userId: ctx.user!.id,
                }).catch((err) =>
                  console.error("[approval] bulk payment deadline sync failed:", err),
                );
              }
            }
          });
        }),
      );

      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;
      const errors = results
        .filter((r): r is PromiseRejectedResult => r.status === "rejected")
        .map((r) => String(r.reason));

      if (succeeded > 0) {
        void invalidateByPrefix(CacheKeys.dashboardPrefix(ctx.organizationId));
      }

      return { succeeded, failed, errors };
    }),

  /**
   * Bulk reject multiple approval steps with a shared comment.
   * Processes each step individually via Promise.allSettled.
   */
  bulkReject: tenantProcedure
    .use(requirePermission({ invoice: ["approve"] }))
    .input(bulkRejectSchema)
    .mutation(async ({ ctx, input }) => {
      const results = await Promise.allSettled(
        input.stepIds.map(async (stepId) => {
          await prisma.$transaction(async (tx) => {
            const step = await tx.approvalStep.findFirst({
              where: {
                id: stepId,
                organizationId: ctx.organizationId,
                status: "PENDING",
                approverUserId: ctx.user!.id,
              },
              include: { approvalFlow: true },
            });

            if (!step) {
              throw new Error(`Step ${stepId} not found or not assignable`);
            }

            await tx.approvalDecision.create({
              data: {
                organizationId: ctx.organizationId,
                approvalStepId: step.id,
                actorUserId: ctx.user!.id,
                decision: "REJECT",
                comment: input.comment,
              },
            });

            await tx.approvalStep.update({
              where: { id: step.id },
              data: {
                status: "REJECTED",
                actedAt: new Date(),
                decision: "REJECT",
                comment: input.comment,
              },
            });

            await tx.approvalFlow.update({
              where: { id: step.approvalFlowId },
              data: {
                status: "REJECTED",
                completedAt: new Date(),
              },
            });

            await tx.invoice.update({
              where: { id: step.approvalFlow.resourceId },
              data: { status: "REJECTED" },
            });
          });
        }),
      );

      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;
      const errors = results
        .filter((r): r is PromiseRejectedResult => r.status === "rejected")
        .map((r) => String(r.reason));

      if (succeeded > 0) {
        void invalidateByPrefix(CacheKeys.dashboardPrefix(ctx.organizationId));
      }

      return { succeeded, failed, errors };
    }),

  // =========================================================================
  // Submit for Approval
  // =========================================================================

  /**
   * Submit an invoice for approval routing.
   * Finds matching chain config, creates approval flow with snapshotted steps,
   * and updates invoice status to APPROVAL_PENDING.
   */
  submitForApproval: tenantProcedure
    .use(requirePermission({ invoice: ["update"] }))
    .input(z.object({ invoiceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const flow = await prisma.$transaction(async (tx) => {
        const invoice = await tx.invoice.findFirst({
          where: {
            id: input.invoiceId,
            organizationId: ctx.organizationId,
            deletedAt: null,
          },
        });

        if (!invoice) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: E.INVOICE_NOT_FOUND,
          });
        }

        // Verify invoice is in a state that allows submission
        const allowedMatchStatuses = ["MATCHED", "MANUALLY_CONFIRMED"];
        if (!allowedMatchStatuses.includes(invoice.matchStatus)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invoice must be matched or manually confirmed before submitting for approval",
          });
        }

        if (invoice.status === "APPROVAL_PENDING") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: E.INVOICE_ALREADY_PENDING,
          });
        }

        // Route to appropriate chain
        const chainConfig = await routeToChain(tx, ctx.organizationId, {
          totalGrosze: invoice.totalGrosze,
        });

        if (!chainConfig) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "No approval chain configured for this organization",
          });
        }

        // Create approval flow with snapshotted steps
        const approvalFlow = await createApprovalFlow(tx, {
          organizationId: ctx.organizationId,
          resourceType: "INVOICE",
          resourceId: invoice.id,
          chainConfig,
          createdByUserId: ctx.user!.id,
        });

        // Update invoice status
        await tx.invoice.update({
          where: { id: invoice.id },
          data: { status: "APPROVAL_PENDING" },
        });

        return { approvalFlow, invoice };
      });

      // Fire-and-forget: dispatch APPROVAL_REQUEST to first approver
      const firstStep = flow.approvalFlow.steps?.[0];
      if (firstStep?.approverUserId) {
        const inv = flow.invoice;
        // Fetch contractor name for notification metadata
        const contractor = inv.contractorId
          ? await prisma.contractor.findUnique({
              where: { id: inv.contractorId },
              select: { legalName: true },
            })
          : null;

        const slaDeadline = firstStep.slaDeadline
          ? new Date(firstStep.slaDeadline).toISOString()
          : "";

        dispatch({
          organizationId: ctx.organizationId,
          type: "APPROVAL_REQUEST",
          recipientUserIds: [firstStep.approverUserId],
          title: `Approval requested for ${inv.invoiceNumber}`,
          body: `${contractor?.legalName ?? "Unknown"} - ${(inv.totalGrosze / 100).toFixed(2)} ${inv.currency}. SLA: ${slaDeadline}`,
          entityType: "INVOICE",
          entityId: inv.id,
          metadata: {
            invoiceNumber: inv.invoiceNumber,
            contractorName: contractor?.legalName ?? "Unknown",
            amount: (inv.totalGrosze / 100).toFixed(2),
            currency: inv.currency,
            slaDeadline,
            invoiceId: inv.id,
            flowId: flow.approvalFlow.id,
          },
        }).catch((err) => console.error("[approval] dispatch APPROVAL_REQUEST failed:", err));
      }

      // Calendar auto-push: sync approval SLA deadline (D-09)
      if (firstStep?.slaDeadline) {
        void syncApprovalSlaDeadline(prisma, {
          organizationId: ctx.organizationId,
          approvalFlowId: flow.approvalFlow.id,
          itemType: "Invoice",
          itemName: flow.invoice.invoiceNumber ?? `INV-${flow.invoice.id.slice(-6)}`,
          deadline: new Date(firstStep.slaDeadline),
          userId: ctx.user!.id,
        }).catch((err) => console.error("[approval] SLA deadline sync failed:", err));
      }

      return plain(flow.approvalFlow);
    }),

  // =========================================================================
  // Audit Trail
  // =========================================================================

  /**
   * Get the approval audit trail for an invoice.
   * Combines human decisions with derived system events (submitted, routed, SLA breaches).
   * Events sorted by timestamp DESC (most recent first).
   */
  getAuditTrail: tenantProcedure
    .use(requirePermission({ invoice: ["read"] }))
    .input(z.object({ invoiceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const flow = await prisma.approvalFlow.findFirst({
        where: {
          resourceId: input.invoiceId,
          organizationId: ctx.organizationId,
        },
        include: {
          steps: {
            orderBy: { stepOrder: "asc" },
            include: {
              decisions: {
                include: {
                  actor: {
                    select: { id: true, name: true, email: true, image: true },
                  },
                },
                orderBy: { createdAt: "asc" },
              },
            },
          },
        },
      });

      if (!flow) {
        return { events: [] as Array<Record<string, unknown>>, flow: null };
      }

      // Resolve chain name for the flow
      let chainName: string | null = null;
      if (flow.chainConfigId) {
        const cfg = await prisma.approvalChainConfig.findUnique({
          where: { id: flow.chainConfigId },
          select: { name: true },
        });
        chainName = cfg?.name ?? null;
      }

      // Build flow summary with step data for chain tracker
      const resolvedSteps = await Promise.all(
        flow.steps.map(async (step) => ({
          id: step.id,
          stepOrder: step.stepOrder,
          name: step.name,
          status: step.status,
          approverUserId: step.approverUserId,
          approverRole: step.approverRole,
          slaDeadline: step.slaDeadline?.toISOString() ?? null,
          actedAt: step.actedAt?.toISOString() ?? null,
          decision: step.decision ?? null,
          approver: step.approverUserId
            ? await prisma.user.findUnique({
                where: { id: step.approverUserId },
                select: { id: true, name: true, email: true, image: true },
              })
            : null,
        })),
      );

      const flowSummary = {
        id: flow.id,
        status: flow.status,
        chainName,
        currentStepOrder: flow.currentStepOrder,
        steps: resolvedSteps,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const events: Array<Record<string, any>> = [];

      // System event: submitted
      events.push({
        type: "system",
        label: "submitted",
        timestamp: flow.startedAt.toISOString(),
      });

      // System event: routed to chain
      if (flow.chainConfigId) {
        events.push({
          type: "system",
          label: "routed",
          chainName: chainName ?? "Unknown chain",
          timestamp: flow.startedAt.toISOString(),
        });
      }

      // Human decisions and SLA breach events
      for (const step of flow.steps) {
        for (const decision of step.decisions) {
          events.push({
            type: "decision",
            label: decision.decision.toLowerCase(),
            levelName: step.name,
            stepOrder: step.stepOrder,
            actor: decision.actor,
            comment: decision.comment,
            timestamp: decision.createdAt.toISOString(),
          });
        }

        // SLA breach detection
        if (step.slaDeadline) {
          const now = new Date();
          const breached =
            (step.actedAt && step.actedAt > step.slaDeadline) ||
            (step.status === "PENDING" && now > step.slaDeadline);

          if (breached) {
            events.push({
              type: "system",
              label: "sla_breached",
              levelName: step.name,
              timestamp: step.slaDeadline.toISOString(),
            });
          }
        }
      }

      // Flow completion event
      if (flow.completedAt) {
        events.push({
          type: "system",
          label: flow.status === "APPROVED" ? "approved" : "rejected",
          timestamp: flow.completedAt.toISOString(),
        });
      }

      // Sort by timestamp DESC (most recent first)
      events.sort(
        (a, b) =>
          new Date(b.timestamp as string).getTime() - new Date(a.timestamp as string).getTime(),
      );

      return plain({ events, flow: flowSummary });
    }),
});
