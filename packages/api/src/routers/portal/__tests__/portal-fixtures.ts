// Shared portal-employee test fixture — two employees (peers), a manager over
// exactly one of them, and a second org, plus a mock-prisma implementation whose
// queries honour the `where` clause so IDOR scoping is a real assertion (a read
// for worker A's rows returns ONLY A's rows). No live DB — the same mock-prisma
// harness the rest of the portal suite uses.
//
// The security RED net builds callers against the not-yet-existent
// portalEmployee/portalManager routers; the router plans flip each test GREEN by
// landing the routers. This module carries no vi.mock calls of its own — each
// test file wires the (hoisted-safe) module mocks and injects the builders here
// at beforeEach time.

type Rec = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Stable identifiers + session tokens
// ---------------------------------------------------------------------------

export const ORG_A = 'org-A-portal';
export const ORG_C = 'org-C-portal';

export const WORKER_A = 'wrk-A';
export const WORKER_B = 'wrk-B';
export const WORKER_M = 'wrk-M';
export const WORKER_X = 'wrk-X';

export const LEAVE_TYPE_ID = 'lt-vacation';

/** Session tokens — one per subject. The mocked validatePortalSession resolves
 *  each to its EMPLOYEE session; an unknown token resolves to null. */
export const TOKEN_A = 'portal-token-employee-a';
export const TOKEN_B = 'portal-token-employee-b';
export const TOKEN_M = 'portal-token-manager-m';
export const TOKEN_X = 'portal-token-orgc-x';

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

export interface PortalEmployeeFixture {
  organizations: Rec[];
  workers: Rec[];
  employeeProfiles: Rec[];
  leaveTypes: Rec[];
  leaveRequests: Rec[];
  leaveBalances: Rec[];
  leaveLedger: Rec[];
  personnelFiles: Rec[];
  personnelDocuments: Rec[];
  documents: Rec[];
  timeEntries: Rec[];
  ewidencja: Rec[];
  pendingUploads: Rec[];
  portalSessions: Rec[];
}

function makeWorker(id: string, organizationId: string, displayName: string): Rec {
  return { id, organizationId, workerType: 'EMPLOYEE', displayName, deletedAt: null };
}

function makeProfile(
  workerId: string,
  organizationId: string,
  managerWorkerId: string | null,
): Rec {
  return {
    id: `profile-${workerId}`,
    workerId,
    organizationId,
    countryCode: 'PL',
    employmentStatus: 'ACTIVE',
    managerWorkerId,
    etat: 1,
  };
}

function makeLeaveRequest(id: string, workerId: string, organizationId: string): Rec {
  const leaveTypeId = organizationId === ORG_C ? 'lt-vacation-c' : LEAVE_TYPE_ID;
  return {
    id,
    organizationId,
    workerId,
    leaveTypeId,
    startDate: new Date('2026-08-01'),
    endDate: new Date('2026-08-05'),
    requestedMinutes: 2400,
    status: 'PENDING',
    approvalFlowId: null,
    deletedAt: null,
    leaveType: { kind: 'ANNUAL' },
  };
}

function makePersonnelFile(workerId: string, organizationId: string): Rec {
  return {
    id: `pf-${workerId}`,
    organizationId,
    workerId,
    countryCode: 'PL',
    deletedAt: null,
  };
}

function makeDocument(
  id: string,
  personnelFileId: string,
  organizationId: string,
  section: string | null,
): Rec {
  return {
    id,
    organizationId,
    personnelFileId,
    documentId: `doc-${id}`,
    section,
    classificationMethod: section ? 'DETERMINISTIC' : 'PENDING',
    deletedAt: null,
  };
}

function makeTimeEntry(id: string, workerId: string, organizationId: string): Rec {
  return {
    id,
    organizationId,
    workerId,
    workDate: new Date('2026-07-01'),
    workedMinutes: 480,
    nightMinutes: 0,
    deletedAt: null,
  };
}

function makeLedgerAccrual(workerId: string, organizationId: string, leaveTypeId: string): Rec {
  return {
    id: `ledger-${workerId}`,
    organizationId,
    workerId,
    leaveTypeId,
    entryType: 'ACCRUAL',
    minutes: 12000,
    effectiveDate: new Date('2026-01-01'),
  };
}

/**
 * Build a fresh fixture:
 *  - Org A: employee A (managed by M), employee B (a peer — NOT managed by M),
 *    manager M (manages exactly A).
 *  - Org C: employee X (a different tenant entirely).
 * Each employee has a leave request, a personnel file with a SECTION_A and a
 * SECTION_C document, and a time entry. The manager's report edge is
 * `EmployeeProfile.managerWorkerId === WORKER_M` on A's profile only.
 */
export function makePortalEmployeeFixture(): PortalEmployeeFixture {
  return {
    organizations: [
      { id: ORG_A, dataRegion: 'EU', status: 'ACTIVE' },
      { id: ORG_C, dataRegion: 'EU', status: 'ACTIVE' },
    ],
    workers: [
      makeWorker(WORKER_A, ORG_A, 'Ada (A)'),
      makeWorker(WORKER_B, ORG_A, 'Bruno (B)'),
      makeWorker(WORKER_M, ORG_A, 'Mara (M)'),
      makeWorker(WORKER_X, ORG_C, 'Xena (X)'),
    ],
    employeeProfiles: [
      makeProfile(WORKER_A, ORG_A, WORKER_M),
      makeProfile(WORKER_B, ORG_A, null),
      makeProfile(WORKER_M, ORG_A, null),
      makeProfile(WORKER_X, ORG_C, null),
    ],
    leaveTypes: [
      { id: LEAVE_TYPE_ID, organizationId: ORG_A, name: 'Vacation', kind: 'ANNUAL', active: true },
      {
        id: 'lt-vacation-c',
        organizationId: ORG_C,
        name: 'Vacation',
        kind: 'ANNUAL',
        active: true,
      },
    ],
    leaveRequests: [
      makeLeaveRequest('lr-A', WORKER_A, ORG_A),
      makeLeaveRequest('lr-B', WORKER_B, ORG_A),
      makeLeaveRequest('lr-X', WORKER_X, ORG_C),
    ],
    leaveBalances: [
      {
        id: 'bal-A',
        workerId: WORKER_A,
        organizationId: ORG_A,
        leaveTypeId: LEAVE_TYPE_ID,
        entitledMinutes: 12000,
        usedMinutes: 2400,
      },
      {
        id: 'bal-B',
        workerId: WORKER_B,
        organizationId: ORG_A,
        leaveTypeId: LEAVE_TYPE_ID,
        entitledMinutes: 12000,
        usedMinutes: 0,
      },
      {
        id: 'bal-X',
        workerId: WORKER_X,
        organizationId: ORG_C,
        leaveTypeId: 'lt-vacation-c',
        entitledMinutes: 12000,
        usedMinutes: 0,
      },
    ],
    leaveLedger: [
      makeLedgerAccrual(WORKER_A, ORG_A, LEAVE_TYPE_ID),
      makeLedgerAccrual(WORKER_B, ORG_A, LEAVE_TYPE_ID),
      makeLedgerAccrual(WORKER_X, ORG_C, 'lt-vacation-c'),
    ],
    personnelFiles: [
      makePersonnelFile(WORKER_A, ORG_A),
      makePersonnelFile(WORKER_B, ORG_A),
      makePersonnelFile(WORKER_M, ORG_A),
      makePersonnelFile(WORKER_X, ORG_C),
    ],
    personnelDocuments: [
      makeDocument('pfd-A-secA', `pf-${WORKER_A}`, ORG_A, 'SECTION_A'),
      makeDocument('pfd-A-secC', `pf-${WORKER_A}`, ORG_A, 'SECTION_C'),
      makeDocument('pfd-B-secA', `pf-${WORKER_B}`, ORG_A, 'SECTION_A'),
      makeDocument('pfd-X-secA', `pf-${WORKER_X}`, ORG_C, 'SECTION_A'),
    ],
    documents: [
      { id: 'doc-pfd-A-secA', organizationId: ORG_A, fileName: 'contract-A.pdf' },
      { id: 'doc-pfd-A-secC', organizationId: ORG_A, fileName: 'payslip-A.pdf' },
      { id: 'doc-pfd-B-secA', organizationId: ORG_A, fileName: 'contract-B.pdf' },
      { id: 'doc-pfd-X-secA', organizationId: ORG_C, fileName: 'contract-X.pdf' },
    ],
    timeEntries: [
      makeTimeEntry('te-A', WORKER_A, ORG_A),
      makeTimeEntry('te-B', WORKER_B, ORG_A),
      makeTimeEntry('te-X', WORKER_X, ORG_C),
    ],
    ewidencja: [
      { id: 'ew-A', workerId: WORKER_A, organizationId: ORG_A, month: '2026-07', deletedAt: null },
      { id: 'ew-B', workerId: WORKER_B, organizationId: ORG_A, month: '2026-07', deletedAt: null },
      { id: 'ew-X', workerId: WORKER_X, organizationId: ORG_C, month: '2026-07', deletedAt: null },
    ],
    pendingUploads: [],
    portalSessions: [],
  };
}

// ---------------------------------------------------------------------------
// where-honouring mock prisma
// ---------------------------------------------------------------------------

function matchWhere(row: Rec, where: unknown): boolean {
  if (!where || typeof where !== 'object') return true;
  for (const [key, value] of Object.entries(where as Rec)) {
    if (value === undefined) continue;
    if (key === 'AND') {
      if (!(value as unknown[]).every(w => matchWhere(row, w))) return false;
      continue;
    }
    if (key === 'OR') {
      if (!(value as unknown[]).some(w => matchWhere(row, w))) return false;
      continue;
    }
    if (value !== null && typeof value === 'object') {
      const op = value as Rec;
      if ('in' in op) {
        if (!(op.in as unknown[]).includes(row[key])) return false;
        continue;
      }
      if ('not' in op) {
        if (row[key] === op.not) return false;
        continue;
      }
      // A relation/scalar filter shape we do not model — ignore (permissive).
      continue;
    }
    if (row[key] !== value) return false;
  }
  return true;
}

function makeModelStub(rows: Rec[]) {
  return {
    findMany: async (args: { where?: unknown } = {}) => rows.filter(r => matchWhere(r, args.where)),
    findFirst: async (args: { where?: unknown } = {}) =>
      rows.find(r => matchWhere(r, args.where)) ?? null,
    findUnique: async (args: { where?: unknown } = {}) =>
      rows.find(r => matchWhere(r, args.where)) ?? null,
    findUniqueOrThrow: async (args: { where?: unknown } = {}) => {
      const hit = rows.find(r => matchWhere(r, args.where));
      if (!hit) throw new Error('No record found');
      return hit;
    },
    count: async (args: { where?: unknown } = {}) =>
      rows.filter(r => matchWhere(r, args.where)).length,
    create: async (args: { data: Rec }) => {
      const row = {
        id: (args.data.id as string) ?? `gen-${rows.length + 1}`,
        deletedAt: null,
        ...args.data,
      };
      rows.push(row);
      return row;
    },
    upsert: async (args: { where?: unknown; create: Rec; update?: Rec }) => {
      const existing = rows.find(r => matchWhere(r, args.where));
      if (existing) {
        Object.assign(existing, args.update ?? {});
        return existing;
      }
      const row = {
        id: (args.create.id as string) ?? `gen-${rows.length + 1}`,
        deletedAt: null,
        ...args.create,
      };
      rows.push(row);
      return row;
    },
    update: async (args: { where?: unknown; data?: Rec }) => {
      const row = rows.find(r => matchWhere(r, args.where));
      if (row) Object.assign(row, args.data ?? {});
      return row ?? {};
    },
    updateMany: async (args: { where?: unknown; data?: Rec }) => {
      let count = 0;
      for (const row of rows) {
        if (matchWhere(row, args.where)) {
          Object.assign(row, args.data ?? {});
          count += 1;
        }
      }
      return { count };
    },
    delete: async (args: { where?: unknown }) => {
      const idx = rows.findIndex(r => matchWhere(r, args.where));
      return idx >= 0 ? (rows.splice(idx, 1)[0] as Rec) : {};
    },
    deleteMany: async (args: { where?: unknown } = {}) => {
      let count = 0;
      for (let i = rows.length - 1; i >= 0; i -= 1) {
        if (matchWhere(rows[i] as Rec, args.where)) {
          rows.splice(i, 1);
          count += 1;
        }
      }
      return { count };
    },
    aggregate: async () => ({ _sum: {}, _count: 0 }),
    groupBy: async () => [],
  };
}

/**
 * A `where`-honouring mock prisma backed by the fixture arrays. Known models map
 * to their fixture array; any other model name resolves to an empty stub (so a
 * Wave-4 router touching a model the fixture does not seed still runs — it simply
 * reads nothing, which the test then seeds or asserts on).
 */
export function createDbFromFixture(fx: PortalEmployeeFixture) {
  const arrays: Record<string, Rec[]> = {
    organization: fx.organizations,
    worker: fx.workers,
    employeeProfile: fx.employeeProfiles,
    leaveType: fx.leaveTypes,
    leaveRequest: fx.leaveRequests,
    leaveBalance: fx.leaveBalances,
    leaveLedgerEntry: fx.leaveLedger,
    personnelFile: fx.personnelFiles,
    personnelFileDocument: fx.personnelDocuments,
    document: fx.documents,
    timeEntry: fx.timeEntries,
    employeeTimeRecord: fx.timeEntries,
    ewidencjaSnapshot: fx.ewidencja,
    pendingUpload: fx.pendingUploads,
    portalSession: fx.portalSessions,
  };

  const base: Rec = {};
  for (const [model, rows] of Object.entries(arrays)) {
    base[model] = makeModelStub(rows);
  }

  const db: Rec = new Proxy(base, {
    get(target, prop: string) {
      if (prop === '$transaction') {
        return async (arg: unknown) =>
          Array.isArray(arg) ? Promise.all(arg) : (arg as (tx: unknown) => Promise<unknown>)(db);
      }
      if (prop in target) return target[prop];
      if (typeof prop === 'string' && !prop.startsWith('$') && !prop.startsWith('_')) {
        const stub = makeModelStub([]);
        target[prop] = stub;
        return stub;
      }
      return;
    },
  });

  return db;
}

// ---------------------------------------------------------------------------
// Session resolution
// ---------------------------------------------------------------------------

const TOKEN_TO_WORKER: Record<string, { workerId: string; organizationId: string }> = {
  [TOKEN_A]: { workerId: WORKER_A, organizationId: ORG_A },
  [TOKEN_B]: { workerId: WORKER_B, organizationId: ORG_A },
  [TOKEN_M]: { workerId: WORKER_M, organizationId: ORG_A },
  [TOKEN_X]: { workerId: WORKER_X, organizationId: ORG_C },
};

/**
 * Resolve a session token to the discriminated EMPLOYEE session shape
 * `validatePortalSession` returns (subjectType EMPLOYEE, workerId + worker +
 * employeeProfile, contractor subject null). Unknown token → null.
 */
export function resolveEmployeeSession(fx: PortalEmployeeFixture, token: string): Rec | null {
  const subject = TOKEN_TO_WORKER[token];
  if (!subject) return null;
  const worker = fx.workers.find(w => w.id === subject.workerId);
  const employeeProfile = fx.employeeProfiles.find(p => p.workerId === subject.workerId);
  if (!(worker && employeeProfile)) return null;
  return {
    id: `session-${subject.workerId}`,
    subjectType: 'EMPLOYEE',
    workerId: subject.workerId,
    worker,
    employeeProfile,
    contractorId: null,
    contractor: null,
    organizationId: subject.organizationId,
    expiresAt: new Date(Date.now() + 86_400_000),
  };
}

/** Cookie headers carrying a portal session token. */
export function portalCookie(token: string): Headers {
  return new Headers({ cookie: `portal_session=${token}`, 'x-forwarded-for': '203.0.113.10' });
}

/** Build a portal caller for a token from a router caller factory. */
export function makePortalCaller(createCaller: (ctx: Rec) => Rec, token: string): Rec {
  return createCaller({
    headers: portalCookie(token),
    session: null,
    user: null,
  });
}
