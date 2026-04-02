// Loosely typed PrismaClient for parallel execution compatibility (precedent: Phase 16, 18)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaClient = any;

// ---------------------------------------------------------------------------
// Equipment Workflow Integration Service
//
// Wires EQUIPMENT workflow task type into the workflow engine:
// - Onboarding: tasks trigger shipment creation flow
// - Offboarding: tasks trigger return requests
// - Shipment status changes auto-complete linked tasks
// ---------------------------------------------------------------------------

/**
 * Handle the start of an EQUIPMENT workflow task.
 *
 * **Trigger:** Called as fire-and-forget from workflow.ts `startRun` after task
 * runs are created. Fires for each task with `taskType === "EQUIPMENT"`.
 *
 * **Behavior:**
 * - Sets task to IN_PROGRESS with `startedAt`
 * - For ONBOARDING workflows: stores assigned equipment IDs with direction OUTBOUND
 * - For OFFBOARDING workflows: stores equipment IDs with direction RETURN and
 *   sets each equipment status to RETURN_REQUESTED
 * - If no equipment is assigned to the contractor, completes the task immediately
 *
 * @param db - Prisma client instance
 * @param organizationId - Tenant organization ID
 * @param taskRun - The workflow task run record
 * @param workflowRun - The parent workflow run with contractor and template info
 */
export async function handleEquipmentTaskStart(
  db: PrismaClient,
  organizationId: string,
  taskRun: { id: string; taskType: string },
  workflowRun: {
    id: string;
    contractorId: string | null;
    templateType: string;
  },
): Promise<void> {
  try {
    if (taskRun.taskType !== "EQUIPMENT") return;

    if (!workflowRun.contractorId) {
      console.info(
        `[equipment-workflow] Skipping EQUIPMENT task ${taskRun.id}: no contractor linked to workflow run ${workflowRun.id}`,
      );
      return;
    }

    const contractorId = workflowRun.contractorId;

    await db.$transaction(async (tx: PrismaClient) => {
      // Find all equipment currently assigned to this contractor
      const assignments = await tx.equipmentAssignment.findMany({
        where: {
          organizationId,
          contractorId,
          unassignedAt: null,
        },
        include: {
          equipment: { select: { id: true, name: true, status: true } },
        },
      });

      const equipmentIds = assignments.map(
        (a: { equipment: { id: string } }) => a.equipment.id,
      );

      // Determine direction based on workflow template type
      const direction: "OUTBOUND" | "RETURN" =
        workflowRun.templateType === "OFFBOARDING" ? "RETURN" : "OUTBOUND";

      if (equipmentIds.length === 0) {
        // No equipment assigned — complete task immediately
        await tx.workflowTaskRun.update({
          where: { id: taskRun.id },
          data: {
            status: "DONE",
            startedAt: new Date(),
            completedAt: new Date(),
            resultJson: {
              equipmentIds: [],
              direction,
              autoCompleted: true,
              reason: "no_equipment_assigned",
            },
          },
        });

        console.info(
          `[equipment-workflow] Task ${taskRun.id} auto-completed: no equipment assigned to contractor ${contractorId}`,
        );

        // Recompute workflow run progress after auto-completion
        await recomputeWorkflowProgress(tx, workflowRun.id);
        return;
      }

      // Set task to IN_PROGRESS with equipment metadata
      await tx.workflowTaskRun.update({
        where: { id: taskRun.id },
        data: {
          status: "IN_PROGRESS",
          startedAt: new Date(),
          resultJson: { equipmentIds, direction },
        },
      });

      // For OFFBOARDING: mark each equipment as RETURN_REQUESTED
      if (direction === "RETURN") {
        await tx.equipment.updateMany({
          where: {
            id: { in: equipmentIds },
            organizationId,
          },
          data: { status: "RETURN_REQUESTED" },
        });

        console.info(
          `[equipment-workflow] Set ${equipmentIds.length} equipment item(s) to RETURN_REQUESTED for offboarding task ${taskRun.id}`,
        );
      }

      console.info(
        `[equipment-workflow] Task ${taskRun.id} started: ${equipmentIds.length} equipment item(s), direction=${direction}`,
      );
    });
  } catch (error) {
    console.error(
      `[equipment-workflow] handleEquipmentTaskStart failed for task ${taskRun.id}:`,
      error,
    );
  }
}

/**
 * Check if a shipment status change should auto-complete a linked workflow task.
 *
 * **Trigger:** Called as fire-and-forget from equipment.ts `addShipmentEvent`
 * after the shipment status is updated.
 *
 * **Behavior:**
 * - OUTBOUND shipments must reach DELIVERED status
 * - RETURN shipments must reach RETURNED status
 * - ALL shipments linked to the same workflow task must reach their respective
 *   target status before the task auto-completes (per D-16)
 * - Auto-completion is idempotent: already-completed tasks are skipped silently
 * - After task completion, workflow run progress is recomputed
 *
 * @param db - Prisma client instance
 * @param organizationId - Tenant organization ID
 * @param shipment - The shipment that was just updated
 */
export async function checkShipmentTaskCompletion(
  db: PrismaClient,
  organizationId: string,
  shipment: {
    id: string;
    workflowTaskRunId: string | null;
    direction: "OUTBOUND" | "RETURN";
    currentStatus: string;
  },
): Promise<void> {
  try {
    if (!shipment.workflowTaskRunId) return;

    // Determine target status based on shipment direction
    const targetStatus =
      shipment.direction === "OUTBOUND" ? "DELIVERED" : "RETURNED";

    // Quick check: if this shipment hasn't reached target, no point checking others
    if (shipment.currentStatus !== targetStatus) return;

    const workflowTaskRunId = shipment.workflowTaskRunId;

    // Find ALL shipments linked to the same workflow task in this org
    const allLinkedShipments = await db.shipment.findMany({
      where: {
        organizationId,
        workflowTaskRunId,
      },
      select: {
        id: true,
        direction: true,
        currentStatus: true,
      },
    });

    // Check if ALL linked shipments have reached their respective target status
    const allComplete = allLinkedShipments.every(
      (s: { direction: string; currentStatus: string }) => {
        const sTarget = s.direction === "OUTBOUND" ? "DELIVERED" : "RETURNED";
        return s.currentStatus === sTarget;
      },
    );

    if (!allComplete) {
      console.info(
        `[equipment-workflow] Shipment ${shipment.id} reached ${targetStatus}, but not all linked shipments complete for task ${workflowTaskRunId}`,
      );
      return;
    }

    // Auto-complete the task (idempotent — updateMany with status check)
    const updateResult = await db.workflowTaskRun.updateMany({
      where: {
        id: workflowTaskRunId,
        organizationId,
        status: "IN_PROGRESS",
      },
      data: {
        status: "DONE",
        completedAt: new Date(),
      },
    });

    if (updateResult.count === 0) {
      // Task was already completed or not IN_PROGRESS — idempotent skip
      return;
    }

    console.info(
      `[equipment-workflow] Auto-completed task ${workflowTaskRunId}: all ${allLinkedShipments.length} shipment(s) reached target status`,
    );

    // Recompute workflow run progress
    const taskRun = await db.workflowTaskRun.findUnique({
      where: { id: workflowTaskRunId },
      select: { workflowRunId: true },
    });

    if (taskRun?.workflowRunId) {
      await recomputeWorkflowProgress(db, taskRun.workflowRunId);
    }
  } catch (error) {
    console.error(
      `[equipment-workflow] checkShipmentTaskCompletion failed for shipment ${shipment.id}:`,
      error,
    );
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Recompute workflow run progress and auto-complete if all required tasks done.
 */
async function recomputeWorkflowProgress(
  tx: PrismaClient,
  workflowRunId: string,
): Promise<void> {
  const allTasks = await tx.workflowTaskRun.findMany({
    where: { workflowRunId },
    select: { status: true, required: true },
  });

  const total = allTasks.length;
  if (total === 0) return;

  const doneTasks = allTasks.filter(
    (t: { status: string }) =>
      t.status === "DONE" || t.status === "SKIPPED" || t.status === "CANCELLED",
  );

  const progressPercent = Math.round((doneTasks.length / total) * 100);

  // Check if all required tasks are DONE
  const requiredTasks = allTasks.filter(
    (t: { required: boolean }) => t.required,
  );
  const allRequiredDone = requiredTasks.every(
    (t: { status: string }) =>
      t.status === "DONE" || t.status === "SKIPPED" || t.status === "CANCELLED",
  );

  if (allRequiredDone && requiredTasks.length > 0) {
    await tx.workflowRun.update({
      where: { id: workflowRunId },
      data: {
        progressPercent,
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });

    console.info(
      `[equipment-workflow] Workflow run ${workflowRunId} auto-completed: all required tasks done (${progressPercent}%)`,
    );
  } else {
    await tx.workflowRun.update({
      where: { id: workflowRunId },
      data: { progressPercent },
    });
  }
}
