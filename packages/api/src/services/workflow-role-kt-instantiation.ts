import { randomUUID } from 'node:crypto';
import type { TxClient } from './approval-engine';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * MS_PER_DAY);
}

/**
 * Instantiates per-role knowledge-transfer tasks from `WorkflowRoleTaskTemplate`
 * rows when an offboarding run starts for a contractor with a role template.
 */
export async function instantiateRoleKtTaskRuns(
  tx: TxClient,
  opts: {
    organizationId: string;
    workflowRunId: string;
    roleTemplateId: string;
    startedAt: Date;
  },
): Promise<number> {
  const roleTasks = await tx.workflowRoleTaskTemplate.findMany({
    where: {
      organizationId: opts.organizationId,
      workflowRoleTemplateId: opts.roleTemplateId,
    },
    orderBy: { sortOrder: 'asc' },
  });

  if (roleTasks.length === 0) return 0;

  await tx.workflowTaskRun.createMany({
    data: roleTasks.map(task => ({
      id: randomUUID(),
      organizationId: opts.organizationId,
      workflowRunId: opts.workflowRunId,
      workflowTaskTemplateId: null,
      title: task.titleEn ?? task.titlePl ?? task.titleDe ?? 'Knowledge transfer',
      description: task.descriptionEn ?? task.descriptionPl ?? task.descriptionDe ?? null,
      taskType: 'KNOWLEDGE_TRANSFER' as const,
      required: true,
      assigneeUserId: null,
      assigneeRole: null,
      dueAt: addDays(opts.startedAt, task.dueDayOffset),
      status: 'TODO' as const,
    })),
  });

  return roleTasks.length;
}
