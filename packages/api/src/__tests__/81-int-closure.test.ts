// Phase 81 · Plan 06 — INT-01 + INT-02 end-to-end composition (the phase gate).
//
// v6-cross-feature-composition.test.ts:28-30 DELIBERATELY excluded F2 (the IdP
// deprovisioning saga) because that test proves the F1/F3/F4 hard-block primitives;
// F2 runs POST-offboarding off the blocked path. This file closes that gap: it is
// the binding composition for the TWO seams the v6.0 milestone audit flagged as
// broken-and-now-wired (81-02 INT-01 server, 81-03 INT-02 recovery, 81-05 INT-01 UI):
//
//   FLOW 1 (INT-01): an offboarding ACCESS_REVOKE card knows only the contractor.
//     resolveAssignmentForContractor (81-02 D-01) resolves the most-recent ENDED
//     assignment; the UI derives a deterministic per-assignment idempotencyKey
//     (deprov:<assignmentId>, 81-05 D-09) and calls startDeprovisioningRun. With the
//     org enabling GWS + Slack (both signoff-satisfied + resolver-backed), the run
//     fans out steps for BOTH providers (81-02 D-05 multi-provider derivation) and
//     one INDEPENDENT QStash job fires per step (IDP-09, no Promise.allSettled).
//     Pre-81 this was unreachable (no resolver, GWS-only hardcoded, ungated).
//
//   FLOW 2 (INT-02): a contractor's portal upload (PENDING_REVIEW document) is
//     admin-approved via approveUploadReplacement. Inside that tx the item flips
//     SATISFIED and onComplianceItemSatisfied (81-03 D-12) re-asserts eligibility:
//     the held PENDING_COMPLIANCE ApprovalFlow containing the item resumes to
//     PENDING, and a follow-up assertContractorPaymentEligibility for the contractor
//     no longer blocks. Pre-81 the recovery hook was never called, so an approved
//     upload left the contractor payment-blocked.
//
// Idempotency (carried-forward note from 81-01/02/05): this composition asserts the
// per-assignment idempotencyKey at the DETERMINISTIC-KEY level (the run is created
// exactly once for deprov:<assignmentId>) — it does NOT depend on a live-DB P2002
// unique-violation from the 76-WR1 @@unique([organizationId, idempotencyKey]) index
// (which is present in the schema source but unconfirmed against the live Neon DB).
// The dedicated P2002 path is covered at the mocked-Prisma level in
// deprovisioning-start.test.ts; re-proving it here would only re-test the mock.
//
// DB-free via a hoisted mock-Prisma store + the createCaller harness (mirrors
// deprovisioning-start.test.ts + compliance-upload-review.test.ts). No feature
// source is modified — the test composes already-wired seams and is GREEN.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The staff appRouter is a heavy cold import on a fork worker (mirrors the 20s bump
// in idp-deprovision-connections.test.ts) — the first full procedure execution per
// worker can exceed the 5s default. Give the composition cases ample headroom.
const SLOW = 30_000;

const ORG_ID = 'clorgaaaaaaaaaaaaaaaaaaaaaa';
const USER_ID = 'cluseraaaaaaaaaaaaaaaaaaaaa';

// ── Flow 1 (INT-01) fixtures ────────────────────────────────────────────────
const CONTRACTOR_ID = 'clcontractoraaaaaaaaaaaaaaa';
const ASSIGNMENT_ENDED_RECENT = 'clasgnendedrecentaaaaaaaaaa';
const ASSIGNMENT_ENDED_OLDER = 'clasgnendedolderaaaaaaaaaaa';

// ── Flow 2 (INT-02) fixtures ────────────────────────────────────────────────
const ITEM_ID = 'clitemaaaaaaaaaaaaaaaaaaaaa';
const DOC_ID = 'cldocaaaaaaaaaaaaaaaaaaaaaa';
const HELD_FLOW_ID = 'clflowheldaaaaaaaaaaaaaaaaa';

type AssignmentRow = {
  id: string;
  organizationId: string;
  status: 'ACTIVE' | 'ENDED' | 'PLANNED';
  endedAt: Date | null;
  contractorId: string;
  contractor: { id: string; countryCode: string; email: string | null };
};

const publishJSON = vi.fn().mockResolvedValue({ messageId: 'm-1' });

const {
  mockPrisma,
  assignments,
  orgSettings,
  runCreate,
  runUpdate,
  approvalFlowUpdate,
  queryRaw,
  // Held-flow store: the recovery hook's $queryRaw returns this; flow 2 mutates it
  // so a follow-up read reflects the resume (PENDING_COMPLIANCE → PENDING).
  heldFlows,
  // EXPIRED+BLOCKING compliance items the payment gate reads. Flow 2 starts with the
  // approved item still blocking and the approve flip empties it, so the gate releases.
  blockingItems,
} = vi.hoisted(() => {
  // ── Flow 1 store ──
  const assignments = new Map<string, AssignmentRow>();
  const orgSettings: { idpDeprovisioningEnabled: Record<string, boolean> } = {
    idpDeprovisioningEnabled: { GOOGLE_WORKSPACE: true, SLACK: true },
  };
  const runCreate = vi.fn();
  const runUpdate = vi.fn().mockResolvedValue({});
  const runFindUnique = vi.fn();

  // ── Flow 2 store ──
  const heldFlows: Array<{
    id: string;
    status: string;
    resourceType: string;
    resourceId: string;
  }> = [];
  // Compliance items keyed by id. The payment gate reads EXPIRED+BLOCKING items for a
  // contractor; the approve flip removes the approved item from the blocking set.
  const blockingItems: Array<{
    id: string;
    contractorId: string;
    organizationId: string;
    policyRuleId: string | null;
    documentType: string;
    severity: string;
    status: string;
    expiresAt: Date | null;
    expiryJurisdictionTz: string | null;
    contractor: { id: string; displayName: string; organizationId: string };
  }> = [];
  const approvalFlowUpdate = vi.fn(
    async (args: { where: { id: string }; data: Record<string, unknown> }) => {
      const flow = heldFlows.find(f => f.id === args.where.id);
      if (flow && typeof args.data.status === 'string') flow.status = args.data.status as string;
      return flow ?? { id: args.where.id, status: 'PENDING' };
    },
  );
  // The recovery hook reads held PENDING_COMPLIANCE flows via a raw tagged-template.
  const queryRaw = vi.fn(async () =>
    heldFlows
      .filter(f => f.status === 'PENDING_COMPLIANCE')
      .map(f => ({ id: f.id, resourceType: f.resourceType, resourceId: f.resourceId })),
  );

  // The single compliance-item model the payment gate + approve flow both read. The
  // gate's findMany honours the contractorId.in + severity + status + org-scope where
  // so its tenant/expiry predicates are load-bearing (not false-green).
  const contractorComplianceItem = {
    // approveUploadReplacement reads the item before flipping it.
    findFirst: vi.fn(async () => ({
      id: ITEM_ID,
      contractorId: CONTRACTOR_ID,
      status: 'EXPIRED',
    })),
    // The SATISFIED flip removes the item from the blocking set so the recovery
    // hook's in-tx eligibility re-assertion (and the follow-up gate read) pass.
    update: vi.fn(async (args: { where: { id: string }; data: Record<string, unknown> }) => {
      if (args.data.status === 'SATISFIED') {
        const idx = blockingItems.findIndex(i => i.id === args.where.id);
        if (idx >= 0) blockingItems.splice(idx, 1);
      }
      return { id: args.where.id, ...args.data };
    }),
    // The payment gate's read — honours the gate's where predicates.
    findMany: vi.fn(async (args: { where?: Record<string, unknown> }) => {
      const where = args?.where ?? {};
      const cid = (where.contractorId as { in?: string[] } | undefined)?.in;
      const orgIs = (where.contractor as { is?: { organizationId?: string } } | undefined)?.is
        ?.organizationId;
      return blockingItems.filter(i => {
        if (where.severity && i.severity !== where.severity) return false;
        if (where.status && i.status !== where.status) return false;
        if (cid && !cid.includes(i.contractorId)) return false;
        if (orgIs && i.organizationId !== orgIs) return false;
        return true;
      });
    }),
  };

  const base = {
    // ── Flow 1 models ──
    contractorAssignment: {
      // Serves BOTH callers: the resolver (status='ENDED', orderBy endedAt desc) and
      // the start mutation (by id). Honours id / organizationId / status predicates
      // and the endedAt-desc ordering so the most-recent ENDED row wins (D-01).
      findFirst: vi.fn(async (args: { where?: Record<string, unknown>; orderBy?: unknown }) => {
        const where = args?.where ?? {};
        let rows = Array.from(assignments.values()).filter(a => {
          if ('id' in where && where.id !== a.id) return false;
          if ('organizationId' in where && where.organizationId !== a.organizationId) return false;
          if ('contractorId' in where && where.contractorId !== a.contractorId) return false;
          if ('status' in where && where.status !== a.status) return false;
          return true;
        });
        const orderBy = args?.orderBy as { endedAt?: 'asc' | 'desc' } | undefined;
        if (orderBy?.endedAt === 'desc') {
          rows = rows.sort((x, y) => (y.endedAt?.getTime() ?? 0) - (x.endedAt?.getTime() ?? 0));
        }
        return rows[0] ?? null;
      }),
    },
    deprovisioningRun: { create: runCreate, update: runUpdate, findUniqueOrThrow: runFindUnique },
    organization: {
      // start mutation reads settingsJson for the provider derivation; legacy reads
      // also expect region/status, so return all three from the single mock.
      findUnique: vi.fn(async () => ({
        dataRegion: 'EU',
        status: 'ACTIVE',
        settingsJson: { ...orgSettings },
      })),
    },
    // ── Flow 2 models ──
    contractorComplianceItem,
    document: {
      findFirst: vi.fn(async () => ({ id: DOC_ID, status: 'PENDING_REVIEW' })),
      update: vi.fn(async () => ({ id: DOC_ID })),
    },
    documentLink: {
      findFirst: vi.fn(async () => ({ id: 'link_1' })),
    },
    approvalFlow: { update: approvalFlowUpdate },
    $queryRaw: queryRaw,
  };

  const mockPrisma = {
    ...base,
    // $transaction runs the callback against the same mock client (both seams use it).
    $transaction: vi.fn(async (fn: (tx: typeof base) => unknown) => fn(base)),
  };

  return {
    mockPrisma,
    assignments,
    orgSettings,
    runCreate,
    runUpdate,
    approvalFlowUpdate,
    queryRaw,
    heldFlows,
    blockingItems,
  };
});

const { auditWriteSpy, dispatchSpy, rbacSpy } = vi.hoisted(() => ({
  auditWriteSpy: vi.fn(async () => undefined),
  dispatchSpy: vi.fn(async () => undefined),
  rbacSpy: vi.fn(async () => ['admin_user_1']),
}));

vi.mock('@contractor-ops/auth', () => ({
  auth: {
    api: { getSession: vi.fn(), hasPermission: vi.fn().mockResolvedValue({ success: true }) },
  },
  authApi: { hasPermission: vi.fn().mockResolvedValue({ success: true }) },
}));

vi.mock('@contractor-ops/db', () => ({
  withRlsTransactions: <T>(c: T) => c,
  withRlsReads: <T>(c: T) => c,
  prisma: mockPrisma,
  prismaRaw: mockPrisma,
  tenantStore: {
    run: (_c: unknown, fn: () => unknown) => fn(),
    getStore: vi.fn(() => ({ region: 'EU' })),
  },
  withTenantScope: vi.fn((c: unknown) => c),
  withSoftDelete: vi.fn((c: unknown) => c),
  createTenantClient: vi.fn(() => mockPrisma),
  createTenantClientFrom: vi.fn(() => mockPrisma),
  getRegionalClient: vi.fn(() => mockPrisma),
}));

// compliance-recovery imports Prisma.DbNull from the generated client for the
// complianceHoldsJson clear; provide it without pulling the real client.
vi.mock('@contractor-ops/db/generated/prisma/client', () => ({
  Prisma: { DbNull: Symbol('DbNull') },
}));

vi.mock('@contractor-ops/feature-flags', async importOriginal => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    // Flow 2's payment gate must ENFORCE (so a remaining block would throw); flow 2
    // proves the gate releases because the approved item is no longer blocking.
    isPaymentBlockEnforced: vi.fn(() => true),
  };
});

vi.mock('@contractor-ops/logger', () => {
  const noop = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  return {
    createWebhookLogger: vi.fn(() => noop),
    withBodyLogging: vi.fn((_o, fn) => fn),
    logIntegrationCall: vi.fn(),
    subscribeOpossumEvents: vi.fn(),
    runWithRequestContext: vi.fn((_c, fn) => fn()),
    getRequestId: vi.fn(() => undefined),
    getTraceparent: vi.fn(() => undefined),
    buildContextFromHeaders: vi.fn(() => ({})),
    getOutboundHeaders: vi.fn(() => ({})),
    generateRequestId: vi.fn(() => 'test-request-id'),
    logger: noop,
    LOG_BODY_INCLUDE_PREFIXES: [],
    PII_MASK_KEYWORDS: [],
    PII_MASK_PATHS: [],
    createIntegrationLogger: vi.fn(() => noop),
    createLogger: vi.fn(() => noop),
    createTrpcLogger: vi.fn(() => noop),
    createCronLogger: vi.fn(() => noop),
    getIdpAuditLogger: vi.fn(() => noop),
  };
});

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), gauge: vi.fn(), histogram: vi.fn(), distribution: vi.fn() },
}));

vi.mock('@contractor-ops/integrations/services/qstash-client', () => ({
  getQStashClient: () => ({ publishJSON }),
}));

vi.mock('../services/audit-writer', () => ({ writeAuditLog: auditWriteSpy }));
vi.mock('../services/notification-service', () => ({ dispatch: dispatchSpy }));
vi.mock('../services/rbac-recipients', () => ({ resolveRbacRecipients: rbacSpy }));

vi.mock('@sentry/node', () => {
  const span = { setStatus: vi.fn(), setAttribute: vi.fn(), end: vi.fn() };
  return {
    getCurrentScope: vi.fn(() => ({
      setUser: vi.fn(),
      setTag: vi.fn(),
      setTags: vi.fn(),
      setContext: vi.fn(),
      setExtra: vi.fn(),
      clear: vi.fn(),
    })),
    setUser: vi.fn(),
    setTag: vi.fn(),
    setTags: vi.fn(),
    setContext: vi.fn(),
    startSpan: vi.fn((_o: unknown, fn: (s: typeof span) => unknown) => fn(span)),
    captureException: vi.fn(),
  };
});

import { authApi } from '@contractor-ops/auth';
import { createCallerFactory } from '../init';
import { appRouter } from '../root';
import { assertContractorPaymentEligibility } from '../services/compliance-payment-gate';

const createCaller = createCallerFactory(appRouter);

/** The UI's deterministic per-assignment idempotency key (81-05 D-09). */
function deriveIdempotencyKey(assignmentId: string): string {
  return `deprov:${assignmentId}`.slice(0, 128);
}

function makeCaller(role = 'it_admin', orgId = ORG_ID, userId = USER_ID) {
  const session = {
    session: {
      id: `session-${userId}`,
      userId,
      activeOrganizationId: orgId,
      expiresAt: new Date('2099-01-01'),
      token: 'mock-token',
      createdAt: new Date(),
      updatedAt: new Date(),
      ipAddress: null,
      userAgent: null,
    },
    user: {
      id: userId,
      name: 'IT Admin',
      email: `${userId}@x.com`,
      emailVerified: true,
      image: null,
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };
  return createCaller({
    headers: new Headers(),
    session: session as never,
    user: session.user as never,
  });
}

/**
 * Seed a contractor with TWO ENDED assignments — an older one and a most-recent one
 * — so the resolver's `endedAt desc` disambiguation (D-01) is load-bearing: it must
 * return the recently-offboarded engagement, not the older row.
 */
function seedOffboardedContractor() {
  assignments.clear();
  assignments.set(ASSIGNMENT_ENDED_OLDER, {
    id: ASSIGNMENT_ENDED_OLDER,
    organizationId: ORG_ID,
    status: 'ENDED',
    endedAt: new Date('2025-01-01T00:00:00Z'),
    contractorId: CONTRACTOR_ID,
    contractor: { id: CONTRACTOR_ID, countryCode: 'DE', email: 'offboarded@example.com' },
  });
  assignments.set(ASSIGNMENT_ENDED_RECENT, {
    id: ASSIGNMENT_ENDED_RECENT,
    organizationId: ORG_ID,
    status: 'ENDED',
    // Well past the 14-day cooldown so canStartDeprovisioning allows the run.
    endedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    contractorId: CONTRACTOR_ID,
    contractor: { id: CONTRACTOR_ID, countryCode: 'DE', email: 'offboarded@example.com' },
  });
}

/** Seed one held PENDING_COMPLIANCE flow + the approved item still blocking payment. */
function seedHeldComplianceState() {
  heldFlows.length = 0;
  heldFlows.push({
    id: HELD_FLOW_ID,
    status: 'PENDING_COMPLIANCE',
    resourceType: 'INVOICE',
    resourceId: 'inv-held-1',
  });
  blockingItems.length = 0;
  blockingItems.push({
    id: ITEM_ID,
    contractorId: CONTRACTOR_ID,
    organizationId: ORG_ID,
    policyRuleId: 'uk.right_to_work@v1',
    documentType: 'RIGHT_TO_WORK',
    severity: 'BLOCKING',
    status: 'EXPIRED',
    expiresAt: new Date('2026-03-01T00:00:00Z'),
    expiryJurisdictionTz: 'Europe/London',
    contractor: { id: CONTRACTOR_ID, displayName: 'Offboarded Contractor', organizationId: ORG_ID },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // The provider derivation gates each provider on its signoff flag; bypass the flag
  // service in unit tests so the GWS+Slack enabled org derives both (mirrors the
  // multi-provider RED cases in deprovisioning-start.test.ts).
  process.env.FLAG_SIGNOFF_BYPASS = 'local';
  orgSettings.idpDeprovisioningEnabled = { GOOGLE_WORKSPACE: true, SLACK: true };
  runUpdate.mockResolvedValue({});
  // Echo the steps the router asked us to create so the multi-provider assertion can
  // read the derived provider set off the created run (mirrors a real insert).
  runCreate.mockImplementation(async (args: { data?: { steps?: { create?: unknown[] } } }) => {
    const created = (args?.data?.steps?.create ?? []) as Array<{
      provider: string;
      stepKind: string;
      externalUserId: string;
    }>;
    return {
      id: 'run-1',
      steps: created.map((s, i) => ({
        id: `s-${i + 1}`,
        provider: s.provider,
        stepKind: s.stepKind,
        externalUserId: s.externalUserId,
      })),
    };
  });
  vi.mocked(authApi.hasPermission).mockResolvedValue({ success: true } as never);
});

afterEach(() => {
  // Don't leak the signoff bypass into other test files in the same worker.
  process.env.FLAG_SIGNOFF_BYPASS = undefined;
});

// ---------------------------------------------------------------------------
// FLOW 1 (INT-01) — offboarding ACCESS_REVOKE → resolve → multi-provider run.
// ---------------------------------------------------------------------------

describe('Flow 1 (INT-01) — ACCESS_REVOKE resolve → startDeprovisioningRun composes the multi-provider run', () => {
  it(
    'resolves the most-recent ENDED assignment, then creates a run with steps for BOTH enabled providers and fans out one QStash job per step',
    async () => {
      seedOffboardedContractor();
      const caller = makeCaller(); // it_admin holds idp:start_run (the ACCESS_REVOKE assignee, D-10)

      // 1. The task card knows only contractorId → server-side resolver returns the
      //    most-recent ENDED assignment (NOT the older one — endedAt desc, D-01).
      const resolved = await caller.deprovisioning.resolveAssignmentForContractor({
        contractorId: CONTRACTOR_ID,
      });
      expect(resolved.assignmentId).toBe(ASSIGNMENT_ENDED_RECENT);

      // 2. The UI derives a deterministic per-assignment idempotencyKey (D-09) and starts.
      const idempotencyKey = deriveIdempotencyKey(resolved.assignmentId as string);
      const result = await caller.deprovisioning.startDeprovisioningRun({
        assignmentId: resolved.assignmentId as string,
        idempotencyKey,
      });
      expect(result).toEqual({ runId: 'run-1', idempotent: false });

      // 3. The run derived BOTH providers (GWS + Slack), suspend + revoke each (D-05).
      const createArg = runCreate.mock.calls[0]?.[0];
      const created = (createArg?.data?.steps?.create ?? []) as Array<{ provider: string }>;
      const providers = new Set(created.map(s => s.provider));
      expect(providers).toEqual(new Set(['GOOGLE_WORKSPACE', 'SLACK']));
      expect(created).toHaveLength(4); // 2 providers × {SUSPEND_ACCOUNT, REVOKE_ALL_SESSIONS}

      // 4. One INDEPENDENT QStash job per step — no Promise.allSettled aggregation (IDP-09).
      expect(publishJSON).toHaveBeenCalledTimes(4);
      const stepUrls = publishJSON.mock.calls.map(c => (c[0] as { url: string }).url);
      for (const url of stepUrls) expect(url).toMatch(/\/idp-deprovisioning\/_step-runner$/);
      // Each job carries a unique per-step deduplicationId (run:step:attempt).
      const dedupIds = new Set(
        publishJSON.mock.calls.map(c => (c[0] as { deduplicationId: string }).deduplicationId),
      );
      expect(dedupIds.size).toBe(4);

      // 5. The deterministic key was carried verbatim into the run insert (D-09): a
      //    re-trigger would collide on the same key, returning the existing run.
      expect(createArg?.data?.idempotencyKey).toBe(idempotencyKey);
    },
    SLOW,
  );

  it(
    'would FAIL against pre-81 code: a contractor with no ENDED assignment resolves to null (the trigger disables instead of picking an ACTIVE row)',
    async () => {
      assignments.clear();
      assignments.set('clasgnactiveaaaaaaaaaaaaaaa', {
        id: 'clasgnactiveaaaaaaaaaaaaaaa',
        organizationId: ORG_ID,
        status: 'ACTIVE',
        endedAt: null,
        contractorId: CONTRACTOR_ID,
        contractor: { id: CONTRACTOR_ID, countryCode: 'DE', email: 'active@example.com' },
      });
      const caller = makeCaller();
      const resolved = await caller.deprovisioning.resolveAssignmentForContractor({
        contractorId: CONTRACTOR_ID,
      });
      expect(resolved.assignmentId).toBeNull();
    },
    SLOW,
  );

  it(
    'the idp:start_run gate is composed end-to-end: a caller WITHOUT the permission cannot resolve or start (the seam is gated, not just reachable)',
    async () => {
      seedOffboardedContractor();
      vi.mocked(authApi.hasPermission).mockResolvedValue({ success: false } as never);
      const caller = makeCaller('readonly');
      await expect(
        caller.deprovisioning.resolveAssignmentForContractor({ contractorId: CONTRACTOR_ID }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      await expect(
        caller.deprovisioning.startDeprovisioningRun({
          assignmentId: ASSIGNMENT_ENDED_RECENT,
          idempotencyKey: deriveIdempotencyKey(ASSIGNMENT_ENDED_RECENT),
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      expect(runCreate).not.toHaveBeenCalled();
    },
    SLOW,
  );
});

// ---------------------------------------------------------------------------
// FLOW 2 (INT-02) — portal upload → admin approve → held flow resume → payment release.
// ---------------------------------------------------------------------------

describe('Flow 2 (INT-02) — approveUploadReplacement → recovery → held flow PENDING + payment gate releases', () => {
  it(
    'flips the item SATISFIED, resumes the held PENDING_COMPLIANCE flow to PENDING in-tx, and a follow-up payment-eligibility check no longer blocks the contractor',
    async () => {
      seedHeldComplianceState();
      const caller = makeCaller('admin'); // compliance:override holder

      // Pre-condition: the contractor IS payment-blocked by the EXPIRED+BLOCKING item.
      const before = await assertContractorPaymentEligibility([CONTRACTOR_ID], {
        tx: mockPrisma as never,
        throwOnFail: false,
        organizationId: ORG_ID,
      });
      expect(before.blocked).toBe(true);
      expect(before.contractorReasons).toHaveLength(1);

      // Admin approves the contractor's PENDING_REVIEW upload.
      const out = (await caller.complianceAdmin.approveUploadReplacement({
        itemId: ITEM_ID,
        documentId: DOC_ID,
        expiresAt: '2027-01-15',
      })) as { status: string };

      // (a) item SATISFIED.
      expect(out.status).toBe('SATISFIED');

      // (b) the recovery hook ran in-tx — it read held flows by JSONB containment and
      //     flipped the held flow PENDING_COMPLIANCE → PENDING (D-12).
      expect(queryRaw).toHaveBeenCalled();
      expect(approvalFlowUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: HELD_FLOW_ID },
          data: expect.objectContaining({ status: 'PENDING' }),
        }),
      );
      expect(heldFlows.find(f => f.id === HELD_FLOW_ID)?.status).toBe('PENDING');

      // (c) the payment gate now RELEASES — the approved item is no longer EXPIRED+BLOCKING,
      //     so a fresh eligibility check for the contractor does not block (COMPL-07/08/11).
      const after = await assertContractorPaymentEligibility([CONTRACTOR_ID], {
        tx: mockPrisma as never,
        throwOnFail: false,
        organizationId: ORG_ID,
      });
      expect(after.blocked).toBe(false);
      expect(after.contractorReasons).toEqual([]);
    },
    SLOW,
  );

  it(
    'would FAIL against pre-81 code (D-14): a post-tx notification failure does NOT roll back the approval or the in-tx recovery flip',
    async () => {
      seedHeldComplianceState();
      dispatchSpy.mockRejectedValueOnce(new Error('notification provider down'));
      const caller = makeCaller('admin');

      const out = (await caller.complianceAdmin.approveUploadReplacement({
        itemId: ITEM_ID,
        documentId: DOC_ID,
        expiresAt: '2027-01-15',
      })) as { status: string };

      // Approval still commits and the in-tx recovery flip survives the post-tx failure.
      expect(out.status).toBe('SATISFIED');
      expect(heldFlows.find(f => f.id === HELD_FLOW_ID)?.status).toBe('PENDING');
    },
    SLOW,
  );

  it(
    'leaves a held flow blocked when ANOTHER BLOCKING item remains (recovery re-asserts FULL eligibility, not just the approved item)',
    async () => {
      seedHeldComplianceState();
      // A second EXPIRED+BLOCKING item for the same contractor — approving ITEM_ID does
      // not clear it, so the recovery hook keeps the flow held (eligibility still blocked).
      blockingItems.push({
        id: 'clitembbbbbbbbbbbbbbbbbbbbb',
        contractorId: CONTRACTOR_ID,
        organizationId: ORG_ID,
        policyRuleId: 'de.a1@v1',
        documentType: 'A1_CERTIFICATE',
        severity: 'BLOCKING',
        status: 'EXPIRED',
        expiresAt: new Date('2026-02-01T00:00:00Z'),
        expiryJurisdictionTz: 'Europe/Berlin',
        contractor: {
          id: CONTRACTOR_ID,
          displayName: 'Offboarded Contractor',
          organizationId: ORG_ID,
        },
      });
      const caller = makeCaller('admin');

      const out = (await caller.complianceAdmin.approveUploadReplacement({
        itemId: ITEM_ID,
        documentId: DOC_ID,
        expiresAt: '2027-01-15',
      })) as { status: string };

      expect(out.status).toBe('SATISFIED');
      // The held flow stays PENDING_COMPLIANCE — the other item still blocks the contractor.
      expect(approvalFlowUpdate).not.toHaveBeenCalled();
      expect(heldFlows.find(f => f.id === HELD_FLOW_ID)?.status).toBe('PENDING_COMPLIANCE');
    },
    SLOW,
  );
});
