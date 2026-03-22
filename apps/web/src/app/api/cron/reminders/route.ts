import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@contractor-ops/db";
import { dispatch } from "@contractor-ops/api/services/notification-service";

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function verifyCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  return token === cronSecret;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

// ---------------------------------------------------------------------------
// Reminder rule evaluation
// ---------------------------------------------------------------------------

async function evaluateReminderRules(): Promise<{
  processed: number;
  sent: number;
}> {
  const now = new Date();
  const today = startOfDay(now);
  let processed = 0;
  let sent = 0;

  const activeRules = await prisma.reminderRule.findMany({
    where: { active: true },
  });

  for (const rule of activeRules) {
    processed++;
    const offsetDays = rule.offsetDays ?? 0;

    // Determine which entities match based on triggerType
    if (
      rule.triggerType === "BEFORE_CONTRACT_END" &&
      rule.entityType === "CONTRACT"
    ) {
      const targetDate = addDays(today, offsetDays);
      const contracts = await prisma.contract.findMany({
        where: {
          organizationId: rule.organizationId,
          endDate: { lte: targetDate, gt: today },
          status: { not: "TERMINATED" },
          deletedAt: null,
        },
        select: { id: true, title: true, contractorId: true, organizationId: true },
      });

      for (const contract of contracts) {
        const scheduledFor = startOfDay(today);

        // Dedup check (pitfall 7)
        const existing = await prisma.reminderInstance.findFirst({
          where: {
            reminderRuleId: rule.id,
            entityId: contract.id,
            entityType: "CONTRACT",
            scheduledFor,
          },
        });
        if (existing) continue;

        // Create instance
        await prisma.reminderInstance.create({
          data: {
            organizationId: rule.organizationId,
            reminderRuleId: rule.id,
            entityType: "CONTRACT",
            entityId: contract.id,
            scheduledFor,
            status: "PENDING",
          },
        });

        // Resolve recipients
        const recipientIds = await resolveRecipients(
          rule.organizationId,
          rule.recipientMode,
          rule.configJson as Record<string, unknown> | null,
          contract.contractorId,
        );

        if (recipientIds.length > 0) {
          await dispatch({
            organizationId: rule.organizationId,
            type: "CONTRACT_EXPIRING",
            recipientUserIds: recipientIds,
            title: `Contract expiring soon: ${contract.title}`,
            body: `A contract is approaching its end date.`,
            entityType: "CONTRACT",
            entityId: contract.id,
          });
          sent++;
        }

        // Update instance status
        await prisma.reminderInstance.updateMany({
          where: {
            reminderRuleId: rule.id,
            entityId: contract.id,
            entityType: "CONTRACT",
            scheduledFor,
            status: "PENDING",
          },
          data: { status: "SENT", sentAt: now },
        });
      }
    }

    if (
      rule.triggerType === "BEFORE_DUE_DATE" &&
      rule.entityType === "INVOICE"
    ) {
      const targetDate = addDays(today, offsetDays);
      const invoices = await prisma.invoice.findMany({
        where: {
          organizationId: rule.organizationId,
          dueDate: { lte: targetDate, gt: today },
          status: { notIn: ["PAID", "VOID"] },
          deletedAt: null,
        },
        select: {
          id: true,
          invoiceNumber: true,
          organizationId: true,
          contractorId: true,
        },
      });

      for (const invoice of invoices) {
        const scheduledFor = startOfDay(today);
        const existing = await prisma.reminderInstance.findFirst({
          where: {
            reminderRuleId: rule.id,
            entityId: invoice.id,
            entityType: "INVOICE",
            scheduledFor,
          },
        });
        if (existing) continue;

        await prisma.reminderInstance.create({
          data: {
            organizationId: rule.organizationId,
            reminderRuleId: rule.id,
            entityType: "INVOICE",
            entityId: invoice.id,
            scheduledFor,
            status: "PENDING",
          },
        });

        const recipientIds = await resolveRecipients(
          rule.organizationId,
          rule.recipientMode,
          rule.configJson as Record<string, unknown> | null,
          invoice.contractorId,
        );

        if (recipientIds.length > 0) {
          await dispatch({
            organizationId: rule.organizationId,
            type: "INVOICE_RECEIVED",
            recipientUserIds: recipientIds,
            title: `Invoice due soon: ${invoice.invoiceNumber}`,
            body: `An invoice is approaching its due date.`,
            entityType: "INVOICE",
            entityId: invoice.id,
          });
          sent++;
        }

        await prisma.reminderInstance.updateMany({
          where: {
            reminderRuleId: rule.id,
            entityId: invoice.id,
            entityType: "INVOICE",
            scheduledFor,
            status: "PENDING",
          },
          data: { status: "SENT", sentAt: now },
        });
      }
    }

    if (
      rule.triggerType === "AFTER_DUE_DATE" &&
      rule.entityType === "INVOICE"
    ) {
      const targetDate = addDays(today, -offsetDays);
      const invoices = await prisma.invoice.findMany({
        where: {
          organizationId: rule.organizationId,
          dueDate: { lte: targetDate },
          status: { notIn: ["PAID", "VOID"] },
          deletedAt: null,
        },
        select: {
          id: true,
          invoiceNumber: true,
          organizationId: true,
          contractorId: true,
        },
      });

      for (const invoice of invoices) {
        const scheduledFor = startOfDay(today);
        const existing = await prisma.reminderInstance.findFirst({
          where: {
            reminderRuleId: rule.id,
            entityId: invoice.id,
            entityType: "INVOICE",
            scheduledFor,
          },
        });
        if (existing) continue;

        await prisma.reminderInstance.create({
          data: {
            organizationId: rule.organizationId,
            reminderRuleId: rule.id,
            entityType: "INVOICE",
            entityId: invoice.id,
            scheduledFor,
            status: "PENDING",
          },
        });

        const recipientIds = await resolveRecipients(
          rule.organizationId,
          rule.recipientMode,
          rule.configJson as Record<string, unknown> | null,
          invoice.contractorId,
        );

        if (recipientIds.length > 0) {
          await dispatch({
            organizationId: rule.organizationId,
            type: "INVOICE_RECEIVED",
            recipientUserIds: recipientIds,
            title: `Invoice overdue: ${invoice.invoiceNumber}`,
            body: `An invoice is past its due date.`,
            entityType: "INVOICE",
            entityId: invoice.id,
          });
          sent++;
        }

        await prisma.reminderInstance.updateMany({
          where: {
            reminderRuleId: rule.id,
            entityId: invoice.id,
            entityType: "INVOICE",
            scheduledFor,
            status: "PENDING",
          },
          data: { status: "SENT", sentAt: now },
        });
      }
    }
  }

  return { processed, sent };
}

// ---------------------------------------------------------------------------
// Built-in TASK_OVERDUE detection (NOTF-01)
// ---------------------------------------------------------------------------

async function detectOverdueTasks(): Promise<number> {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  let notified = 0;

  // Find all overdue workflow tasks across all organizations
  const overdueTasks = await prisma.workflowTaskRun.findMany({
    where: {
      dueAt: { lt: now },
      status: { notIn: ["DONE", "CANCELLED", "SKIPPED"] },
      assigneeUserId: { not: null },
    },
    select: {
      id: true,
      title: true,
      assigneeUserId: true,
      organizationId: true,
      workflowRun: {
        select: {
          id: true,
          workflowTemplate: {
            select: { name: true },
          },
          contractor: {
            select: { displayName: true },
          },
        },
      },
    },
  });

  for (const task of overdueTasks) {
    if (!task.assigneeUserId) continue;

    // 24h dedup: check if TASK_OVERDUE notification already sent for this task today
    const recentNotification = await prisma.notification.findFirst({
      where: {
        type: "TASK_OVERDUE",
        entityType: "WORKFLOW_TASK_RUN",
        entityId: task.id,
        createdAt: { gte: oneDayAgo },
      },
    });

    if (recentNotification) continue;

    const contractorName = task.workflowRun?.contractor?.displayName ?? "";
    const workflowName = task.workflowRun?.workflowTemplate?.name ?? "";

    await dispatch({
      organizationId: task.organizationId,
      type: "TASK_OVERDUE",
      recipientUserIds: [task.assigneeUserId],
      title: `Task overdue: ${task.title}`,
      body: `${workflowName}${contractorName ? ` - ${contractorName}` : ""}`,
      entityType: "WORKFLOW_TASK_RUN",
      entityId: task.id,
    });

    notified++;
  }

  return notified;
}

// ---------------------------------------------------------------------------
// Recipient resolution
// ---------------------------------------------------------------------------

async function resolveRecipients(
  organizationId: string,
  recipientMode: string,
  configJson: Record<string, unknown> | null,
  entityOwnerId?: string | null,
): Promise<string[]> {
  switch (recipientMode) {
    case "ENTITY_OWNER": {
      if (!entityOwnerId) return [];
      // For contracts/invoices, the "owner" is the contractor's linked user or the creator
      return entityOwnerId ? [entityOwnerId] : [];
    }

    case "FINANCE_TEAM": {
      const financeMembers = await prisma.member.findMany({
        where: {
          organizationId,
          role: { in: ["FINANCE_ADMIN", "ACCOUNTANT"] },
        },
        select: { userId: true },
      });
      return financeMembers.map((m) => m.userId);
    }

    case "ASSIGNEE": {
      if (!entityOwnerId) return [];
      return [entityOwnerId];
    }

    case "SPECIFIC_USER": {
      const userId = configJson?.userId as string | undefined;
      return userId ? [userId] : [];
    }

    case "ROLE": {
      const role = configJson?.role as string | undefined;
      if (!role) return [];
      const members = await prisma.member.findMany({
        where: { organizationId, role },
        select: { userId: true },
      });
      return members.map((m) => m.userId);
    }

    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// GET /api/cron/reminders
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [ruleResults, overdueTasksNotified] = await Promise.all([
      evaluateReminderRules(),
      detectOverdueTasks(),
    ]);

    return NextResponse.json({
      processed: ruleResults.processed,
      sent: ruleResults.sent,
      overdueTasksNotified,
    });
  } catch (error) {
    console.error("[cron-reminders] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
