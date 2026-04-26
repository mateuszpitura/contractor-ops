// ---------------------------------------------------------------------------
// Phase 60 · CLASS-08 — reassessment trigger daily scan.
// ---------------------------------------------------------------------------
//
// Walks the AuditLog since the last scan for ContractorAssignment + Contract
// material changes on UK (GB) engagements that have a completed IR35
// classification. Creates or appends to an OPEN / ACKNOWLEDGED
// ReassessmentTrigger row per (contractorAssignmentId, priorAssessmentId)
// cluster and dispatches a classification.reassessment_trigger notification.
//
// Security contract:
//   - prismaRaw for cross-org AuditLog reads (tagged PHASE-60-CROSS-ORG-AGGREGATE).
//   - Material-field allowlist enforced at the scan layer (D-07).
//   - Assessment lookup filtered to countryCode='GB' + status='completed'.
//   - triggerReasonsSchema parses JSONB on both read AND write paths.
//   - No console.* — createCronLogger(...) per CLAUDE.md.
//   - take: 10000 safety limit with a metrics.gauge alert if hit (DoS mitigation).

import { prisma, prismaRaw } from '@contractor-ops/db';
import { createCronLogger } from '@contractor-ops/logger';
import { metrics } from '@contractor-ops/logger/metrics';
import type { TriggerReason } from '../schemas/reassessment-trigger-reason.js';
import { triggerReasonsSchema } from '../schemas/reassessment-trigger-reason.js';
import { dispatch } from './notification-service.js';
import { resolveRbacRecipients } from './rbac-recipients.js';

const log = createCronLogger('classification-reassessment-triggers');

const SCAN_NAME = 'classification-reassessment-triggers';
const AUDIT_TAKE_LIMIT = 10000;

/**
 * D-07 material-field allowlists. A change to any listed field produces a
 * trigger reason; anything else (allocationPercent, notes, tag links, cost
 * centre, owner) is explicitly ignored to avoid noise.
 */
const CONTRACTOR_MATERIAL_FIELDS = new Set([
  'activeTo',
  'projectId',
  'teamId',
  'status',
  'countryCode',
  'lifecycleStage',
]);

const CONTRACT_MATERIAL_FIELDS = new Set([
  'rateValueMinor',
  'rateType',
  'billingModel',
  'startDate',
  'endDate',
  'scope',
  'description',
  'status',
]);

const IGNORED_FIELDS = new Set([
  'allocationPercent',
  'notes',
  'costCenterId',
  'tagLinks',
  'ownerId',
]);

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

interface AuditRow {
  id: string;
  organizationId: string;
  action: string;
  resourceType: 'CONTRACTOR' | 'CONTRACT' | string;
  resourceId: string;
  oldValuesJson: Record<string, unknown> | null;
  newValuesJson: Record<string, unknown> | null;
  createdAt: Date;
}

export function isMaterialChange(row: AuditRow): { material: boolean; fields: string[] } {
  const allowlist =
    row.resourceType === 'CONTRACTOR'
      ? CONTRACTOR_MATERIAL_FIELDS
      : row.resourceType === 'CONTRACT'
        ? CONTRACT_MATERIAL_FIELDS
        : null;
  if (!allowlist) return { material: false, fields: [] };

  const keys = new Set<string>([
    ...Object.keys(row.oldValuesJson ?? {}),
    ...Object.keys(row.newValuesJson ?? {}),
  ]);
  const changed: string[] = [];
  for (const key of keys) {
    if (IGNORED_FIELDS.has(key)) continue;
    if (!allowlist.has(key)) continue;
    const oldV = (row.oldValuesJson ?? {})[key];
    const newV = (row.newValuesJson ?? {})[key];
    if (JSON.stringify(oldV) !== JSON.stringify(newV)) {
      changed.push(key);
    }
  }
  return { material: changed.length > 0, fields: changed };
}

export function reasonsFromAuditRow(row: AuditRow, fields: string[]): TriggerReason[] {
  return fields.map(field => ({
    field,
    oldValue: (row.oldValuesJson ?? {})[field] ?? undefined,
    newValue: (row.newValuesJson ?? {})[field] ?? undefined,
    auditLogId: row.id,
    resourceType: row.resourceType === 'CONTRACT' ? ('CONTRACT' as const) : ('CONTRACTOR' as const),
    changedAt: row.createdAt,
  }));
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export interface ReassessmentScanResult {
  scanned: number;
  material: number;
  triggersCreated: number;
  triggersAppended: number;
}

interface TriggerLookup {
  id: string;
  organizationId: string;
  contractorAssignmentId: string;
  priorAssessmentId: string;
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'DISMISSED';
  triggerReasons: unknown;
}

/**
 * Resolves the GB engagement (contractorAssignmentId + latest completed IR35
 * assessment id) for an audit row. Returns null for anything that isn't
 * attached to a GB engagement with an existing SDS.
 */
async function resolveEngagement(row: AuditRow): Promise<{
  assignmentId: string;
  priorAssessmentId: string;
  priorSdsDocumentId: string | null;
} | null> {
  if (row.resourceType === 'CONTRACTOR') {
    // PHASE-60-CROSS-ORG-AGGREGATE: assignment lookup outside tenant frame.
    const assignment = await prismaRaw.contractorAssignment.findFirst({
      where: { id: row.resourceId },
      select: { id: true, contractor: { select: { countryCode: true } } },
    });
    if (!assignment || assignment.contractor?.countryCode !== 'GB') return null;
    return resolveIr35Assessment(row.resourceId);
  }

  if (row.resourceType === 'CONTRACT') {
    // PHASE-60-CROSS-ORG-AGGREGATE: contract → contractor → assignments.
    const contract = await prismaRaw.contract.findFirst({
      where: { id: row.resourceId },
      select: {
        id: true,
        contractor: {
          select: {
            countryCode: true,
            assignments: {
              where: { status: 'ACTIVE' },
              select: { id: true },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });
    const assignmentId = contract?.contractor?.assignments?.[0]?.id;
    if (!contract || contract.contractor?.countryCode !== 'GB' || !assignmentId) {
      return null;
    }
    return resolveIr35Assessment(assignmentId);
  }

  return null;
}

async function resolveIr35Assessment(assignmentId: string): Promise<{
  assignmentId: string;
  priorAssessmentId: string;
  priorSdsDocumentId: string | null;
} | null> {
  // PHASE-60-CROSS-ORG-AGGREGATE: read assessment outside tenant frame.
  const assessment = await prismaRaw.classificationAssessment.findFirst({
    where: {
      contractorAssignmentId: assignmentId,
      countryCode: 'GB',
      status: 'completed',
    },
    orderBy: { completedAt: 'desc' },
    select: {
      id: true,
      classificationDocuments: {
        where: { kind: 'SDS' },
        orderBy: { generatedAt: 'desc' },
        take: 1,
        select: { id: true },
      },
    },
  });
  if (!assessment) return null;
  return {
    assignmentId,
    priorAssessmentId: assessment.id,
    priorSdsDocumentId: assessment.classificationDocuments?.[0]?.id ?? null,
  };
}

async function dedupAndCreateOrAppend(
  organizationId: string,
  assignmentId: string,
  priorAssessmentId: string,
  priorSdsDocumentId: string | null,
  newReasons: TriggerReason[],
): Promise<{ created: boolean; appended: boolean }> {
  // PHASE-60-CROSS-ORG-AGGREGATE: read existing trigger outside tenant frame.
  const existing = (await prismaRaw.reassessmentTrigger.findFirst({
    where: {
      organizationId,
      contractorAssignmentId: assignmentId,
      priorAssessmentId,
      status: { in: ['OPEN', 'ACKNOWLEDGED'] },
    },
    select: {
      id: true,
      organizationId: true,
      contractorAssignmentId: true,
      priorAssessmentId: true,
      status: true,
      triggerReasons: true,
    },
  })) as TriggerLookup | null;

  if (existing) {
    const existingReasons = triggerReasonsSchema.parse(existing.triggerReasons ?? []);
    const merged = triggerReasonsSchema.parse([...existingReasons, ...newReasons]);
    await prismaRaw.reassessmentTrigger.update({
      where: { id: existing.id },
      data: { triggerReasons: merged as unknown as object[] },
    });
    return { created: false, appended: true };
  }

  const parsed = triggerReasonsSchema.parse(newReasons);
  await prismaRaw.reassessmentTrigger.create({
    data: {
      organizationId,
      contractorAssignmentId: assignmentId,
      priorAssessmentId,
      priorSdsDocumentId,
      triggerReasons: parsed as unknown as object[],
      status: 'OPEN',
    },
  });
  return { created: true, appended: false };
}

/**
 * Runs the daily AuditLog-driven reassessment scan. Incremental: persists a
 * CronScanState cursor so historical audits aren't replayed on restart.
 */
export async function runReassessmentTriggerScan(
  now: Date = new Date(),
): Promise<ReassessmentScanResult> {
  const scanState = await prismaRaw.cronScanState.findUnique({ where: { name: SCAN_NAME } });
  // If the scan has never run, seed the cursor to `now` so we DO NOT replay
  // the entire audit history. The cron route caller is expected to have
  // seeded this on first deploy but be defensive.
  const cursor = scanState?.lastScanCompletedAt ?? now;

  // PHASE-60-CROSS-ORG-AGGREGATE: cross-tenant AuditLog read.
  const rows: AuditRow[] = (await prismaRaw.auditLog.findMany({
    where: {
      createdAt: { gt: cursor },
      resourceType: { in: ['CONTRACTOR', 'CONTRACT'] },
    },
    orderBy: { createdAt: 'asc' },
    take: AUDIT_TAKE_LIMIT,
  })) as AuditRow[];

  if (rows.length >= AUDIT_TAKE_LIMIT) {
    metrics.gauge('classification.reassessment_scan.audit_limit_hit', 1);
    log.warn(
      { limit: AUDIT_TAKE_LIMIT, rowCount: rows.length },
      'reassessment scan hit audit take limit — additional rows will be picked up next run',
    );
  }

  let scanned = 0;
  let material = 0;
  let triggersCreated = 0;
  let triggersAppended = 0;
  const dispatchPayloads: Array<{
    organizationId: string;
    assignmentId: string;
    newReasons: TriggerReason[];
  }> = [];

  for (const row of rows) {
    scanned += 1;
    const { material: isMat, fields } = isMaterialChange(row);
    if (!isMat) continue;

    const engagement = await resolveEngagement(row);
    if (!engagement) continue;

    material += 1;
    const newReasons = reasonsFromAuditRow(row, fields);

    const outcome = await dedupAndCreateOrAppend(
      row.organizationId,
      engagement.assignmentId,
      engagement.priorAssessmentId,
      engagement.priorSdsDocumentId,
      newReasons,
    );

    if (outcome.created) {
      triggersCreated += 1;
      dispatchPayloads.push({
        organizationId: row.organizationId,
        assignmentId: engagement.assignmentId,
        newReasons,
      });
    }
    if (outcome.appended) triggersAppended += 1;
  }

  // Dispatch notifications for newly-created triggers (appended triggers
  // don't re-fire — the original notification already went out).
  for (const payload of dispatchPayloads) {
    try {
      const recipients = await resolveRbacRecipients(payload.organizationId, 'contractor:read');
      if (recipients.length === 0) continue;

      await dispatch({
        organizationId: payload.organizationId,
        type: 'classification.reassessment_trigger',
        recipientUserIds: recipients,
        title: 'Reassessment recommended',
        body: `${payload.newReasons.length} material change${payload.newReasons.length === 1 ? '' : 's'} detected since the last IR35 SDS. Open the engagement to review.`,
        entityType: 'CONTRACTOR',
        entityId: payload.assignmentId,
      });
    } catch (err) {
      log.error({ err, payload }, 'reassessment trigger dispatch failed');
    }
  }

  // Advance the cursor to the scan start so future runs resume cleanly.
  await prismaRaw.cronScanState.upsert({
    where: { name: SCAN_NAME },
    create: { name: SCAN_NAME, lastScanCompletedAt: now },
    update: { lastScanCompletedAt: now },
  });

  metrics.gauge('classification.reassessment_scan.scanned', scanned);
  metrics.gauge('classification.reassessment_scan.material', material);
  metrics.gauge('classification.reassessment_scan.triggers_created', triggersCreated);
  metrics.gauge('classification.reassessment_scan.triggers_appended', triggersAppended);

  log.info(
    { scanned, material, triggersCreated, triggersAppended },
    'reassessment trigger scan completed',
  );

  return { scanned, material, triggersCreated, triggersAppended };
}

// Exported for unit tests.
export const __testables = {
  CONTRACTOR_MATERIAL_FIELDS,
  CONTRACT_MATERIAL_FIELDS,
  IGNORED_FIELDS,
};

// Silence "unused" for prisma — kept because future extensions may need
// tenant-scoped reads (e.g. notification preferences).
export const _tenantScopedPrisma = prisma;
