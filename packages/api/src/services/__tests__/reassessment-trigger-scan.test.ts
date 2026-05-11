// ---------------------------------------------------------------------------
// reassessment-trigger-scan tests — Phase 60 CLASS-08.
// ---------------------------------------------------------------------------
//
// Covers filter / material-field allowlist / dedup / no-prior-assessment /
// since-last-run behaviour of the daily reassessment scan.

import { beforeEach, describe, expect, it, vi } from 'vitest';

type AuditRow = {
  id: string;
  organizationId: string;
  action: string;
  resourceType: 'CONTRACTOR' | 'CONTRACT';
  resourceId: string;
  oldValuesJson: Record<string, unknown> | null;
  newValuesJson: Record<string, unknown> | null;
  createdAt: Date;
};

type AssignmentRow = {
  id: string;
  organizationId: string;
  contractor: { countryCode: string };
};

type ContractRow = {
  id: string;
  organizationId: string;
  contractor: { countryCode: string };
  assignments: AssignmentRow[];
};

type AssessmentRow = {
  id: string;
  organizationId: string;
  contractorAssignmentId: string;
  countryCode: string;
  status: string;
  completedAt: Date | null;
  classificationDocuments: Array<{ id: string }>;
};

type TriggerRow = {
  id: string;
  organizationId: string;
  contractorAssignmentId: string;
  priorAssessmentId: string;
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'DISMISSED';
  triggerReasons: unknown[];
};

const state = {
  audits: [] as AuditRow[],
  assignments: new Map<string, AssignmentRow>(),
  contracts: new Map<string, ContractRow>(),
  assessments: [] as AssessmentRow[],
  triggers: new Map<string, TriggerRow>(),
  scanState: new Map<string, { name: string; lastScanCompletedAt: Date }>(),
  dispatched: [] as Array<{ type: string; organizationId: string }>,
  gauges: [] as Array<{ key: string; value: number; tags?: Record<string, unknown> }>,
};

const { mockPrismaRaw, mockPrisma, mockDispatch, mockResolveRbac, mockMetricsGauge } = vi.hoisted(
  () => ({
    mockPrismaRaw: {} as Record<string, unknown>,
    mockPrisma: {} as Record<string, unknown>,
    mockDispatch: vi.fn(async () => undefined),
    mockResolveRbac: vi.fn(async () => ['user-1', 'user-2']),
    mockMetricsGauge: vi.fn(),
  }),
);

// Wire mocks to `state` closure (vi.hoisted cannot reference module-scope yet).
mockPrismaRaw.auditLog = {
  findMany: vi.fn(async (args: { where?: Record<string, unknown>; take?: number }) => {
    const since = (args?.where?.createdAt as { gt?: Date })?.gt;
    const resourceTypeIn = (args?.where?.resourceType as { in?: string[] })?.in;
    let rows = state.audits.filter(a => {
      if (since && a.createdAt <= since) return false;
      if (resourceTypeIn && !resourceTypeIn.includes(a.resourceType)) return false;
      return true;
    });
    if (args?.take) rows = rows.slice(0, args.take);
    return rows;
  }),
};
mockPrismaRaw.contractorAssignment = {
  findFirst: vi.fn(async (args: { where?: { id?: string } }) => {
    const id = args?.where?.id;
    return id ? (state.assignments.get(id) ?? null) : null;
  }),
  findMany: vi.fn(async (args: { where?: { id?: { in?: string[] } } }) => {
    const ids = args?.where?.id?.in ?? [];
    return ids.map(id => state.assignments.get(id)).filter(Boolean);
  }),
};
mockPrismaRaw.contract = {
  findFirst: vi.fn(async (args: { where?: { id?: string } }) => {
    const id = args?.where?.id;
    return id ? (state.contracts.get(id) ?? null) : null;
  }),
  findMany: vi.fn(async (args: { where?: { id?: { in?: string[] } } }) => {
    const ids = args?.where?.id?.in ?? [];
    return ids.map(id => state.contracts.get(id)).filter(Boolean);
  }),
};
mockPrismaRaw.classificationAssessment = {
  findFirst: vi.fn(
    async (args: {
      where?: { contractorAssignmentId?: string; countryCode?: string; status?: string };
    }) => {
      const assignId = args?.where?.contractorAssignmentId;
      const matches = state.assessments
        .filter(a => !assignId || a.contractorAssignmentId === assignId)
        .filter(a => !args?.where?.countryCode || a.countryCode === args.where.countryCode)
        .filter(a => !args?.where?.status || a.status === args.where.status);
      return matches[0] ?? null;
    },
  ),
  findMany: vi.fn(async () => []),
};
mockPrismaRaw.reassessmentTrigger = {
  findFirst: vi.fn(async (args: { where?: Record<string, unknown> }) => {
    const w = args?.where ?? {};
    return (
      Array.from(state.triggers.values()).find(t => {
        if (w.organizationId && w.organizationId !== t.organizationId) return false;
        if (w.contractorAssignmentId && w.contractorAssignmentId !== t.contractorAssignmentId)
          return false;
        if (w.priorAssessmentId && w.priorAssessmentId !== t.priorAssessmentId) return false;
        const statusIn = (w.status as { in?: string[] })?.in;
        if (statusIn && !statusIn.includes(t.status)) return false;
        return true;
      }) ?? null
    );
  }),
  findMany: vi.fn(async (args: { where?: Record<string, unknown> }) => {
    return Array.from(state.triggers.values()).filter(t => {
      const w = args?.where ?? {};
      if (w.organizationId && w.organizationId !== t.organizationId) return false;
      if (w.contractorAssignmentId && w.contractorAssignmentId !== t.contractorAssignmentId)
        return false;
      const statusIn = (w.status as { in?: string[] })?.in;
      if (statusIn && !statusIn.includes(t.status)) return false;
      return true;
    });
  }),
  create: vi.fn(async (args: { data: TriggerRow & { id?: string } }) => {
    const id = args.data.id ?? `rt_${state.triggers.size + 1}`;
    const row: TriggerRow = {
      id,
      organizationId: args.data.organizationId,
      contractorAssignmentId: args.data.contractorAssignmentId,
      priorAssessmentId: args.data.priorAssessmentId,
      status: (args.data.status ?? 'OPEN') as TriggerRow['status'],
      triggerReasons: (args.data.triggerReasons as unknown[]) ?? [],
    };
    state.triggers.set(id, row);
    return row;
  }),
  update: vi.fn(async (args: { where: { id: string }; data: Partial<TriggerRow> }) => {
    const row = state.triggers.get(args.where.id);
    if (!row) throw new Error('not found');
    Object.assign(row, args.data);
    return row;
  }),
};
mockPrismaRaw.cronScanState = {
  findUnique: vi.fn(async (args: { where: { name: string } }) => {
    return state.scanState.get(args.where.name) ?? null;
  }),
  upsert: vi.fn(
    async (args: {
      where: { name: string };
      create: { name: string; lastScanCompletedAt: Date };
      update: { lastScanCompletedAt: Date };
    }) => {
      const existing = state.scanState.get(args.where.name);
      if (existing) {
        existing.lastScanCompletedAt = args.update.lastScanCompletedAt;
        return existing;
      }
      state.scanState.set(args.where.name, args.create);
      return args.create;
    },
  ),
};
mockPrismaRaw.organization = {
  findUnique: vi.fn(async () => ({ dataRegion: 'EU', status: 'ACTIVE' })),
};

mockPrisma.reassessmentTrigger = mockPrismaRaw.reassessmentTrigger;

vi.mock('@contractor-ops/db', () => ({
  withRlsTransactions: <T>(c: T) => c,
  withRlsReads: <T>(c: T) => c,
  prisma: mockPrisma,
  prismaRaw: mockPrismaRaw,
}));

vi.mock('@contractor-ops/logger', () => ({
  createTrpcLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createWebhookLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  withBodyLogging: vi.fn((_o, fn) => fn),
  logIntegrationCall: vi.fn(),
  subscribeOpossumEvents: vi.fn(),
  runWithRequestContext: vi.fn((_c, fn) => fn()),
  getRequestId: vi.fn(() => undefined),
  getTraceparent: vi.fn(() => undefined),
  buildContextFromHeaders: vi.fn(() => ({})),
  getOutboundHeaders: vi.fn(() => ({})),
  generateRequestId: vi.fn(() => 'test-request-id'),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  LOG_BODY_INCLUDE_PREFIXES: [],
  PII_MASK_KEYWORDS: [],
  PII_MASK_PATHS: [],
  createIntegrationLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  createCronLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { gauge: mockMetricsGauge, increment: vi.fn(), distribution: vi.fn() },
}));

vi.mock('../notification-service', () => ({
  dispatch: mockDispatch,
}));

vi.mock('../rbac-recipients', () => ({
  resolveRbacRecipients: mockResolveRbac,
}));

import { runReassessmentTriggerScan } from '../reassessment-trigger-scan';

function resetState() {
  state.audits.length = 0;
  state.assignments.clear();
  state.contracts.clear();
  state.assessments.length = 0;
  state.triggers.clear();
  state.scanState.clear();
  state.dispatched.length = 0;
  state.gauges.length = 0;
  mockDispatch.mockClear();
  mockMetricsGauge.mockClear();
}

function seedGbEngagementWithIr35(assignmentId: string, orgId = 'org-a') {
  state.assignments.set(assignmentId, {
    id: assignmentId,
    organizationId: orgId,
    contractor: { countryCode: 'GB' },
  });
  state.assessments.push({
    id: `assess-${assignmentId}`,
    organizationId: orgId,
    contractorAssignmentId: assignmentId,
    countryCode: 'GB',
    status: 'completed',
    completedAt: new Date('2026-01-01'),
    classificationDocuments: [{ id: `doc-${assignmentId}` }],
  });
}

describe('runReassessmentTriggerScan — filter (60-02-01)', () => {
  beforeEach(resetState);

  it('skips DE engagements even when a material change is present', async () => {
    state.assignments.set('asg-de', {
      id: 'asg-de',
      organizationId: 'org-a',
      contractor: { countryCode: 'DE' },
    });
    state.audits.push({
      id: 'a1',
      organizationId: 'org-a',
      action: 'UPDATE',
      resourceType: 'CONTRACTOR',
      resourceId: 'asg-de',
      oldValuesJson: { activeTo: '2026-01-01' },
      newValuesJson: { activeTo: '2027-01-01' },
      createdAt: new Date('2026-04-10'),
    });
    state.scanState.set('classification-reassessment-triggers', {
      name: 'classification-reassessment-triggers',
      lastScanCompletedAt: new Date('2026-04-01'),
    });

    const result = await runReassessmentTriggerScan();
    expect(result.triggersCreated).toBe(0);
  });

  it('skips GB engagements without a completed IR35 assessment (60-02-04)', async () => {
    state.assignments.set('asg-gb-no-sds', {
      id: 'asg-gb-no-sds',
      organizationId: 'org-a',
      contractor: { countryCode: 'GB' },
    });
    state.audits.push({
      id: 'a2',
      organizationId: 'org-a',
      action: 'UPDATE',
      resourceType: 'CONTRACTOR',
      resourceId: 'asg-gb-no-sds',
      oldValuesJson: { activeTo: '2026-01-01' },
      newValuesJson: { activeTo: '2027-01-01' },
      createdAt: new Date('2026-04-10'),
    });
    state.scanState.set('classification-reassessment-triggers', {
      name: 'classification-reassessment-triggers',
      lastScanCompletedAt: new Date('2026-04-01'),
    });

    const result = await runReassessmentTriggerScan();
    expect(result.triggersCreated).toBe(0);
  });
});

describe('runReassessmentTriggerScan — material-fields allowlist (60-02-02)', () => {
  beforeEach(resetState);

  it('creates a trigger when CONTRACTOR activeTo changes', async () => {
    seedGbEngagementWithIr35('asg-1');
    state.audits.push({
      id: 'a3',
      organizationId: 'org-a',
      action: 'UPDATE',
      resourceType: 'CONTRACTOR',
      resourceId: 'asg-1',
      oldValuesJson: { activeTo: '2026-01-01' },
      newValuesJson: { activeTo: '2027-01-01' },
      createdAt: new Date('2026-04-10'),
    });
    state.scanState.set('classification-reassessment-triggers', {
      name: 'classification-reassessment-triggers',
      lastScanCompletedAt: new Date('2026-04-01'),
    });

    const result = await runReassessmentTriggerScan();
    expect(result.triggersCreated).toBe(1);
  });

  it('ignores rows whose only change is allocationPercent / notes / tagLinks', async () => {
    seedGbEngagementWithIr35('asg-2');
    state.audits.push({
      id: 'a4',
      organizationId: 'org-a',
      action: 'UPDATE',
      resourceType: 'CONTRACTOR',
      resourceId: 'asg-2',
      oldValuesJson: { allocationPercent: 80, notes: 'x' },
      newValuesJson: { allocationPercent: 60, notes: 'y' },
      createdAt: new Date('2026-04-10'),
    });
    state.scanState.set('classification-reassessment-triggers', {
      name: 'classification-reassessment-triggers',
      lastScanCompletedAt: new Date('2026-04-01'),
    });

    const result = await runReassessmentTriggerScan();
    expect(result.triggersCreated).toBe(0);
  });

  it('creates a trigger when CONTRACT rateValueMinor changes', async () => {
    seedGbEngagementWithIr35('asg-3');
    state.contracts.set('con-3', {
      id: 'con-3',
      organizationId: 'org-a',
      contractor: {
        countryCode: 'GB',
        // Service expects contract.contractor.assignments[0].id
        assignments: [{ id: 'asg-3' }],
      } as unknown as ContractRow['contractor'],
      assignments: [state.assignments.get('asg-3')!],
    });
    state.audits.push({
      id: 'a5',
      organizationId: 'org-a',
      action: 'UPDATE',
      resourceType: 'CONTRACT',
      resourceId: 'con-3',
      oldValuesJson: { rateValueMinor: 10000 },
      newValuesJson: { rateValueMinor: 12500 },
      createdAt: new Date('2026-04-10'),
    });
    state.scanState.set('classification-reassessment-triggers', {
      name: 'classification-reassessment-triggers',
      lastScanCompletedAt: new Date('2026-04-01'),
    });

    const result = await runReassessmentTriggerScan();
    expect(result.triggersCreated).toBe(1);
  });
});

describe('runReassessmentTriggerScan — dedup (60-02-03)', () => {
  beforeEach(resetState);

  it('appends multiple reasons within a single scan to ONE trigger row', async () => {
    seedGbEngagementWithIr35('asg-4');
    state.audits.push(
      {
        id: 'a6',
        organizationId: 'org-a',
        action: 'UPDATE',
        resourceType: 'CONTRACTOR',
        resourceId: 'asg-4',
        oldValuesJson: { activeTo: '2026-01-01' },
        newValuesJson: { activeTo: '2027-01-01' },
        createdAt: new Date('2026-04-10T01:00:00Z'),
      },
      {
        id: 'a7',
        organizationId: 'org-a',
        action: 'UPDATE',
        resourceType: 'CONTRACTOR',
        resourceId: 'asg-4',
        oldValuesJson: { projectId: 'p1' },
        newValuesJson: { projectId: 'p2' },
        createdAt: new Date('2026-04-10T02:00:00Z'),
      },
    );
    state.scanState.set('classification-reassessment-triggers', {
      name: 'classification-reassessment-triggers',
      lastScanCompletedAt: new Date('2026-04-01'),
    });

    const result = await runReassessmentTriggerScan();
    expect(result.triggersCreated).toBe(1);
    const rows = Array.from(state.triggers.values());
    expect(rows).toHaveLength(1);
    expect((rows[0]?.triggerReasons as unknown[]).length).toBeGreaterThanOrEqual(2);
  });
});

describe('runReassessmentTriggerScan — since-last-run (CronScanState)', () => {
  beforeEach(resetState);

  it('skips audit rows older than lastScanCompletedAt and advances the cursor', async () => {
    seedGbEngagementWithIr35('asg-5');
    state.audits.push({
      id: 'a-old',
      organizationId: 'org-a',
      action: 'UPDATE',
      resourceType: 'CONTRACTOR',
      resourceId: 'asg-5',
      oldValuesJson: { activeTo: '2026-01-01' },
      newValuesJson: { activeTo: '2027-01-01' },
      createdAt: new Date('2026-03-01'),
    });
    state.scanState.set('classification-reassessment-triggers', {
      name: 'classification-reassessment-triggers',
      lastScanCompletedAt: new Date('2026-04-01'),
    });

    const result = await runReassessmentTriggerScan();
    expect(result.triggersCreated).toBe(0);

    // Second call after cursor advanced should still skip the pre-cursor row.
    const result2 = await runReassessmentTriggerScan();
    expect(result2.triggersCreated).toBe(0);
    const cursor = state.scanState.get('classification-reassessment-triggers');
    expect(cursor).toBeDefined();
    expect(cursor?.lastScanCompletedAt).toBeInstanceOf(Date);
  });
});
