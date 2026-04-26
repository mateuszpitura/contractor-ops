import { createLogger } from '@contractor-ops/logger';
import type { InPostClientConfig } from './courier/inpost-client.js';
import { InPostClient } from './courier/inpost-client.js';
import type { DbClient } from './types.js';

const log = createLogger({ service: 'equipment-workflow' });

type PrismaClient = DbClient;

/** Transaction-scoped or full client: only the delegates used by InPost + workflow helpers. */
type EquipmentWorkflowDb = Pick<
  DbClient,
  | 'workflowTaskRun'
  | 'workflowRun'
  | 'courierConfig'
  | 'contractor'
  | 'organization'
  | 'shipment'
  | 'shipmentEvent'
  | 'equipment'
  | 'returnRequest'
>;

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
    if (taskRun.taskType !== 'EQUIPMENT') return;

    if (!workflowRun.contractorId) {
      log.info(
        { taskRunId: taskRun.id, workflowRunId: workflowRun.id },
        'skipping EQUIPMENT task: no contractor linked to workflow run',
      );
      return;
    }

    const contractorId = workflowRun.contractorId;

    await db.$transaction(async tx => {
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

      const equipmentIds = assignments.map((a: { equipment: { id: string } }) => a.equipment.id);

      // Determine direction based on workflow template type
      const direction: 'OUTBOUND' | 'RETURN' =
        workflowRun.templateType === 'OFFBOARDING' ? 'RETURN' : 'OUTBOUND';

      if (equipmentIds.length === 0) {
        // No equipment assigned — complete task immediately
        await tx.workflowTaskRun.update({
          where: { id: taskRun.id },
          data: {
            status: 'DONE',
            startedAt: new Date(),
            completedAt: new Date(),
            resultJson: {
              equipmentIds: [],
              direction,
              autoCompleted: true,
              reason: 'no_equipment_assigned',
            },
          },
        });

        log.info(
          { taskRunId: taskRun.id, contractorId },
          'task auto-completed: no equipment assigned to contractor',
        );

        // Recompute workflow run progress after auto-completion
        await recomputeWorkflowProgress(tx, workflowRun.id);
        return;
      }

      // Set task to IN_PROGRESS with equipment metadata
      await tx.workflowTaskRun.update({
        where: { id: taskRun.id },
        data: {
          status: 'IN_PROGRESS',
          startedAt: new Date(),
          resultJson: { equipmentIds, direction },
        },
      });

      // For OFFBOARDING: mark each equipment as RETURN_REQUESTED
      if (direction === 'RETURN') {
        await tx.equipment.updateMany({
          where: {
            id: { in: equipmentIds },
            organizationId,
          },
          data: { status: 'RETURN_REQUESTED' },
        });

        log.info(
          { equipmentCount: equipmentIds.length, taskRunId: taskRun.id },
          'set equipment items to RETURN_REQUESTED for offboarding task',
        );

        // D-10: Auto-create InPost return shipment if org has courier config
        await autoCreateInPostReturnShipment(tx, {
          organizationId,
          contractorId,
          equipmentIds,
          taskRunId: taskRun.id,
          workflowRunId: workflowRun.id,
          assignments,
        });
      }

      log.info(
        { taskRunId: taskRun.id, equipmentCount: equipmentIds.length, direction },
        'task started',
      );
    });
  } catch (error) {
    log.error({ err: error, taskRunId: taskRun.id }, 'handleEquipmentTaskStart failed for task');
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
    direction: 'OUTBOUND' | 'RETURN';
    currentStatus: string;
  },
): Promise<void> {
  try {
    if (!shipment.workflowTaskRunId) return;

    // Determine target status based on shipment direction
    const targetStatus = shipment.direction === 'OUTBOUND' ? 'DELIVERED' : 'RETURNED';

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
        const sTarget = s.direction === 'OUTBOUND' ? 'DELIVERED' : 'RETURNED';
        return s.currentStatus === sTarget;
      },
    );

    if (!allComplete) {
      log.info(
        { shipmentId: shipment.id, targetStatus, workflowTaskRunId },
        'shipment reached target status, but not all linked shipments complete for task',
      );
      return;
    }

    // Auto-complete the task (idempotent — updateMany with status check)
    const updateResult = await db.workflowTaskRun.updateMany({
      where: {
        id: workflowTaskRunId,
        organizationId,
        status: 'IN_PROGRESS',
      },
      data: {
        status: 'DONE',
        completedAt: new Date(),
      },
    });

    if (updateResult.count === 0) {
      // Task was already completed or not IN_PROGRESS — idempotent skip
      return;
    }

    log.info(
      { workflowTaskRunId, shipmentCount: allLinkedShipments.length },
      'auto-completed task: all shipments reached target status',
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
    log.error(
      { err: error, shipmentId: shipment.id },
      'checkShipmentTaskCompletion failed for shipment',
    );
  }
}

// ---------------------------------------------------------------------------
// InPost auto-shipment for offboarding (D-10)
// ---------------------------------------------------------------------------

/**
 * Auto-create an InPost return shipment when offboarding a contractor.
 *
 * Skips PENDING_APPROVAL — creates ReturnRequest directly with SHIPMENT_CREATED status.
 * Only fires if:
 * - Org has InPost CourierConfig
 * - Contractor has a preferred Paczkomat set
 *
 * Wrapped in try/catch so API failures don't block the task start.
 * Equipment stays in RETURN_REQUESTED if this fails — admin can create manually.
 */
async function autoCreateInPostReturnShipment(
  tx: EquipmentWorkflowDb,
  params: {
    organizationId: string;
    contractorId: string;
    equipmentIds: string[];
    taskRunId: string;
    workflowRunId: string;
    assignments: Array<{ equipment: { id: string; name: string } }>;
  },
): Promise<void> {
  try {
    const { organizationId, contractorId, equipmentIds, taskRunId, workflowRunId } = params;

    // Check if org has InPost courier config
    const courierConfig = await tx.courierConfig.findUnique({
      where: {
        organizationId_carrier: {
          organizationId,
          carrier: 'inpost',
        },
      },
    });

    if (!courierConfig) {
      // Org does not use InPost — do nothing extra
      return;
    }

    // Load contractor details including preferred Paczkomat
    const contractor = await tx.contractor.findUnique({
      where: { id: contractorId },
      select: {
        displayName: true,
        email: true,
        phone: true,
        preferredPaczkomatId: true,
        preferredPaczkomatName: true,
        preferredPaczkomatAddress: true,
      },
    });

    if (!contractor?.preferredPaczkomatId) {
      log.warn(
        { contractorId, taskRunId },
        'contractor has no preferred Paczkomat — skipping auto-shipment for task',
      );
      return;
    }

    // Parse config and create InPost client
    const configJson = courierConfig.configJson as unknown as InPostClientConfig;
    const client = new InPostClient(configJson);

    // Load org for sender details
    const org = await tx.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    });

    // Create shipment via ShipX API
    const shipmentResult = await client.createShipment({
      organizationId,
      direction: 'RETURN',
      receiver: {
        name: contractor.displayName,
        email: contractor.email ?? '',
        phone: contractor.phone ?? '',
      },
      sender: {
        name: org?.name ?? 'Organization',
        email: '',
        phone: '',
      },
      targetPoint: contractor.preferredPaczkomatId,
      parcelSize: 'large', // Default for offboarding — covers all equipment
      reference: `offboarding-${workflowRunId}`,
    });

    // Create Shipment records for each equipment item
    let firstShipmentId: string | null = null;

    for (const equipmentId of equipmentIds) {
      const shipment = await tx.shipment.create({
        data: {
          organizationId,
          equipmentId,
          workflowTaskRunId: taskRunId,
          direction: 'RETURN',
          carrier: 'InPost',
          trackingNumber: shipmentResult.trackingNumber,
          externalId: shipmentResult.externalId,
          labelUrl: shipmentResult.labelUrl ?? null,
          currentStatus: 'CREATED',
          createdByUserId: 'system',
        },
      });

      if (!firstShipmentId) {
        firstShipmentId = shipment.id;
      }

      // Create initial ShipmentEvent records
      await tx.shipmentEvent.create({
        data: {
          organizationId,
          shipmentId: shipment.id,
          status: 'CREATED',
          notes: `Auto-created for offboarding workflow ${workflowRunId}`,
        },
      });

      await tx.shipmentEvent.create({
        data: {
          organizationId,
          shipmentId: shipment.id,
          status: 'LABEL_GENERATED',
          notes: 'Label auto-generated by ShipX on shipment creation',
        },
      });

      // Update equipment status from RETURN_REQUESTED to RETURN_IN_TRANSIT
      await tx.equipment.update({
        where: { id: equipmentId },
        data: { status: 'RETURN_IN_TRANSIT' },
      });
    }

    // Create ReturnRequest with SHIPMENT_CREATED status (skipping PENDING_APPROVAL per D-10)
    await tx.returnRequest.create({
      data: {
        organizationId,
        contractorId,
        status: 'SHIPMENT_CREATED',
        targetPointId: contractor.preferredPaczkomatId,
        targetPointName: contractor.preferredPaczkomatName,
        targetPointAddress: contractor.preferredPaczkomatAddress,
        shipmentId: firstShipmentId,
        approvedAt: new Date(), // Auto-approved by workflow
      },
    });

    log.info(
      { taskRunId, contractorId },
      'auto-created InPost return shipment for offboarding task',
    );

    // Fire-and-forget: notify contractor with return label info (D-13)
    // Note: dispatch is not available in this service context, so we log it
    // The notification will be sent via the webhook handler when status updates arrive
  } catch (error) {
    // Do NOT fail the task start — equipment stays in RETURN_REQUESTED
    log.error(
      { err: error, taskRunId: params.taskRunId },
      'auto-shipment creation failed for task',
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
  tx: EquipmentWorkflowDb,
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
      t.status === 'DONE' || t.status === 'SKIPPED' || t.status === 'CANCELLED',
  );

  const progressPercent = Math.round((doneTasks.length / total) * 100);

  // Check if all required tasks are DONE
  const requiredTasks = allTasks.filter((t: { required: boolean }) => t.required);
  const allRequiredDone = requiredTasks.every(
    (t: { status: string }) =>
      t.status === 'DONE' || t.status === 'SKIPPED' || t.status === 'CANCELLED',
  );

  if (allRequiredDone && requiredTasks.length > 0) {
    await tx.workflowRun.update({
      where: { id: workflowRunId },
      data: {
        progressPercent,
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    log.info(
      { workflowRunId, progressPercent },
      'workflow run auto-completed: all required tasks done',
    );
  } else {
    await tx.workflowRun.update({
      where: { id: workflowRunId },
      data: { progressPercent },
    });
  }
}
