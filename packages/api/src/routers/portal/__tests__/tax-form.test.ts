// Portal W-form intake integration tests.
// Owns: pnpm --filter @contractor-ops/api test src/routers/portal/__tests__/tax-form.test.ts
//
// Proves the legally-load-bearing invariants of the portal self-cert surface:
//   - W-9 submit inserts an immutable ACTIVE row + writes a CONTRACTOR audit row.
//   - Re-cert supersedes: the prior ACTIVE row is flipped to SUPERSEDED and a
//     NEW ACTIVE row is inserted (a signed record is never mutated).
//   - The portal response AND the stored snapshotJson contain NO full SSN
//     (last-4 only).
//   - W-8BEN-E captures lobCategory (line 14b) + treatyArticle (line 15).
//   - The ESIGN attestation snapshot carries typed signerName + server signedAt
//     + server-derived ip + contractorId (never a client-supplied ip).
//   - A cross-contractor read is impossible — every query is scoped to the
//     portal-session contractorId (IDOR).
//   - The whole surface is gated behind module.us-expansion.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const ORG_ID = 'org-taxform-001';
const CONTRACTOR_ID = 'contractor-taxform-001';
const OTHER_CONTRACTOR_ID = 'contractor-taxform-evil';
const SESSION_TOKEN = 'portal-session-token-taxform';
const FULL_SSN = '078051120';

type Rec = Record<string, unknown>;

const { mockPrisma, taxFormRows, flagEnabled } = vi.hoisted(() => {
  // Hoisted factory runs before module-level consts — inline literals here.
  const ORG_ID = 'org-taxform-001';
  const CONTRACTOR_ID = 'contractor-taxform-001';
  const taxFormRows: Record<string, unknown>[] = [];
  const flagEnabled = { value: true };

  const taxFormSubmission = {
    findFirst: vi.fn(async (args: { where?: Rec }) => {
      const where = args?.where ?? {};
      return (
        taxFormRows.find(
          r =>
            r.contractorId === where.contractorId &&
            r.organizationId === where.organizationId &&
            (where.formType ? r.formType === where.formType : true) &&
            (where.status ? r.status === where.status : true),
        ) ?? null
      );
    }),
    findMany: vi.fn(async (args: { where?: Rec }) => {
      const where = args?.where ?? {};
      // Scoped strictly to the where.contractorId — proves IDOR cannot leak
      // another contractor's rows.
      return taxFormRows.filter(
        r => r.contractorId === where.contractorId && r.organizationId === where.organizationId,
      );
    }),
    updateMany: vi.fn(async (args: { where?: Rec; data?: Rec }) => {
      const where = args?.where ?? {};
      let count = 0;
      for (const r of taxFormRows) {
        if (
          r.contractorId === where.contractorId &&
          r.organizationId === where.organizationId &&
          r.formType === where.formType &&
          r.status === where.status
        ) {
          Object.assign(r, args?.data ?? {});
          count += 1;
        }
      }
      return { count };
    }),
    create: vi.fn(async (args: { data: Rec }) => {
      const row = { id: `taxform-${taxFormRows.length + 1}`, ...args.data };
      taxFormRows.push(row);
      return row;
    }),
    update: vi.fn(async (args: { where?: Rec; data?: Rec }) => {
      const row = taxFormRows.find(r => r.id === args?.where?.id);
      if (row) Object.assign(row, args?.data ?? {});
      return row ?? {};
    }),
  };

  const mockPrisma: Rec = {
    organization: {
      findUnique: vi.fn().mockResolvedValue({ id: ORG_ID, dataRegion: 'EU', status: 'ACTIVE' }),
    },
    contractor: {
      findUnique: vi.fn(async (args: { where?: Rec }) => {
        if (args?.where?.id !== CONTRACTOR_ID) return null;
        return {
          id: CONTRACTOR_ID,
          countryCode: 'PL',
          type: 'INDIVIDUAL_FREELANCER',
          legalName: 'Jan Kowalski',
          displayName: 'Jan',
        };
      }),
    },
    withholdingTaxRate: {
      findFirst: vi.fn(async () => ({
        contractorResidency: 'PL',
        serviceType: 'business_profits',
        treatyRate: 0,
        treatyArticle: 'Article 7',
      })),
    },
    taxFormSubmission,
    $transaction: vi.fn(async (fn: (tx: Rec) => Promise<unknown>) => fn(mockPrisma)),
  };

  return { mockPrisma, taxFormRows, flagEnabled };
});

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
    run: (_ctx: unknown, fn: () => unknown) => fn(),
    getStore: vi.fn(() => ({ region: 'EU' })),
  },
  withTenantScope: vi.fn((c: unknown) => c),
  withSoftDelete: vi.fn((c: unknown) => c),
  createTenantClient: vi.fn(() => mockPrisma),
  createTenantClientFrom: vi.fn(() => mockPrisma),
  getRegionalClient: vi.fn(() => mockPrisma),
}));

vi.mock('@contractor-ops/feature-flags', () => ({
  evaluate: vi.fn(() => ({ enabled: flagEnabled.value, reason: 'unleash' })),
  buildFlagBag: vi.fn(() => ({ isEnabled: () => flagEnabled.value })),
}));

vi.mock('../../../services/portal-session', () => ({
  validatePortalSession: vi.fn(async (token: string) => {
    if (token !== SESSION_TOKEN) return null;
    return {
      contractorId: CONTRACTOR_ID,
      organizationId: ORG_ID,
      contractor: { id: CONTRACTOR_ID, email: 'contractor@test.com' },
    };
  }),
  createPortalSession: vi.fn(),
  deletePortalSession: vi.fn(),
}));

vi.mock('@contractor-ops/logger', () => ({
  getIdpAuditLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  createWebhookLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createCronLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
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
  createTrpcLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), histogram: vi.fn(), distribution: vi.fn() },
}));

vi.mock('@sentry/node', () => {
  const mockSpan = { setStatus: vi.fn(), setAttribute: vi.fn(), end: vi.fn() };
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
    startSpan: vi.fn((_o: unknown, fn: (span: typeof mockSpan) => unknown) => fn(mockSpan)),
    captureException: vi.fn(),
  };
});

const auditWrites: Record<string, unknown>[] = [];
vi.mock('../../../services/audit-writer', () => ({
  writeAuditLog: vi.fn(async (input: Rec) => {
    auditWrites.push(input);
  }),
}));

import { createCallerFactory } from '../../../init';
import { portalAppRouter } from '../../../portal-root';

const createCaller = createCallerFactory(portalAppRouter);

function makePortalCaller(ip = '203.0.113.7') {
  return createCaller({
    headers: new Headers({
      cookie: `portal_session=${SESSION_TOKEN}`,
      'x-forwarded-for': ip,
    }),
    session: null as never,
    user: null as never,
  });
}

const caller = makePortalCaller();

beforeEach(() => {
  taxFormRows.length = 0;
  auditWrites.length = 0;
  flagEnabled.value = true;
  vi.clearAllMocks();
});

const w9Submission = {
  formType: 'W9' as const,
  usEntityType: 'INDIVIDUAL' as const,
  backupWithholding: false,
  tin: { ssnLast4: '1120' },
  perjuryAccepted: true as const,
  signerName: 'Jane Q. Contractor',
};

describe('portal.submitTaxForm — immutable insert + audit (US-FORM-01)', () => {
  it('inserts an ACTIVE row and writes a CONTRACTOR audit row', async () => {
    const result = await caller.portal.submitTaxForm(w9Submission);

    expect(result.status).toBe('ACTIVE');
    expect(taxFormRows).toHaveLength(1);
    expect(taxFormRows[0]).toMatchObject({
      contractorId: CONTRACTOR_ID,
      organizationId: ORG_ID,
      formType: 'W9',
      status: 'ACTIVE',
    });

    expect(auditWrites).toHaveLength(1);
    expect(auditWrites[0]).toMatchObject({
      action: 'tax.form.submitted',
      actorType: 'CONTRACTOR',
      actorId: CONTRACTOR_ID,
      resourceType: 'CONTRACTOR',
    });
  });
});

describe('portal.submitTaxForm — re-certification supersedes (US-FORM-01)', () => {
  it('flips the prior ACTIVE row to SUPERSEDED and inserts a NEW ACTIVE row', async () => {
    await caller.portal.submitTaxForm(w9Submission);
    await caller.portal.submitTaxForm(w9Submission);

    expect(taxFormRows).toHaveLength(2);
    const superseded = taxFormRows.filter(r => r.status === 'SUPERSEDED');
    const active = taxFormRows.filter(r => r.status === 'ACTIVE');
    expect(superseded).toHaveLength(1);
    expect(active).toHaveLength(1);
  });
});

describe('portal.submitTaxForm — PII non-leak (US-FORM-01)', () => {
  it('never writes a full SSN into the snapshot or the response (last-4 only)', async () => {
    const result = await caller.portal.submitTaxForm({
      ...w9Submission,
      // A buggy/hostile client smuggling a full SSN must be stripped.
      tin: { ssnLast4: '1120', ssn: FULL_SSN } as never,
    });

    const storedSnapshot = JSON.stringify(taxFormRows[0]?.snapshotJson ?? {});
    expect(storedSnapshot).not.toContain(FULL_SSN);
    expect(storedSnapshot).toContain('1120');
    expect(JSON.stringify(result)).not.toContain(FULL_SSN);
  });
});

describe('portal.submitTaxForm — ESIGN attestation capture (US-FORM-01/02)', () => {
  it('captures typed signerName + server signedAt + server-derived ip + contractorId', async () => {
    await caller.portal.submitTaxForm(w9Submission);

    const snapshot = taxFormRows[0]?.snapshotJson as Rec;
    const attestation = snapshot.attestation as Rec;
    expect(attestation.signerName).toBe('Jane Q. Contractor');
    expect(attestation.perjuryAccepted).toBe(true);
    expect(attestation.actorId).toBe(CONTRACTOR_ID);
    expect(attestation.ip).toBe('203.0.113.7');
    expect(typeof attestation.signedAt).toBe('string');
  });

  it('derives the attestation ip server-side from x-forwarded-for, not the client body', async () => {
    const otherCaller = makePortalCaller('198.51.100.42');
    await otherCaller.portal.submitTaxForm(w9Submission);
    const attestation = (taxFormRows[0]?.snapshotJson as Rec).attestation as Rec;
    expect(attestation.ip).toBe('198.51.100.42');
  });
});

describe('portal.submitTaxForm — W-8BEN-E LOB + treaty article (US-FORM-02/US-LOC-03)', () => {
  it('captures lobCategory + treatyArticle on the snapshot/claim', async () => {
    const result = await caller.portal.submitTaxForm({
      formType: 'W8BENE',
      treatyCountry: 'PL',
      entityType: 'CORPORATION',
      lobCategory: 'PUBLICLY_TRADED_CORPORATION',
      ftin: 'PL1234567890',
      addressLine1: '1 Market St',
      city: 'Warsaw',
      perjuryAccepted: true,
      signerName: 'Jan Kowalski',
    });

    expect(result.formType).toBe('W8BENE');
    const row = taxFormRows[0];
    expect(row.treatyArticle).toBe('Article 7');
    expect(Number(row.treatyRate)).toBe(0);
    expect(row.contractorResidency).toBe('PL');

    const snapshot = row.snapshotJson as Rec;
    const fields = snapshot.fields as Rec;
    expect(fields.lobCategory).toBe('PUBLICLY_TRADED_CORPORATION');
    expect((snapshot.treatyClaim as Rec).article).toBe('Article 7');
  });
});

describe('portal.saveTaxFormDraft — PII non-leak (US-FORM-01)', () => {
  it('strips a full SSN/TIN from the draft before it reaches snapshotJson', async () => {
    await caller.portal.saveTaxFormDraft({
      formType: 'W9',
      draft: {
        usEntityType: 'INDIVIDUAL',
        tin: { ssnLast4: '1120', ssn: FULL_SSN },
        fullSsn: FULL_SSN,
      },
    });

    const storedSnapshot = JSON.stringify(taxFormRows[0]?.snapshotJson ?? {});
    expect(storedSnapshot).not.toContain(FULL_SSN);
    expect(storedSnapshot).toContain('1120');
  });
});

describe('portal.getMyTaxForms — IDOR scoping (US-FORM-01)', () => {
  it('returns only the session contractor rows, never another contractor', async () => {
    await caller.portal.submitTaxForm(w9Submission);
    // Inject a foreign-contractor row directly into the store.
    taxFormRows.push({
      id: 'foreign-row',
      contractorId: OTHER_CONTRACTOR_ID,
      organizationId: ORG_ID,
      formType: 'W9',
      status: 'ACTIVE',
    });

    const mine = await caller.portal.getMyTaxForms();
    expect(mine.every(r => r.id !== 'foreign-row')).toBe(true);
    expect(mine.some(r => r.formType === 'W9')).toBe(true);
  });
});

describe('portal tax-form surface — module.us-expansion gating (US-FORM-01)', () => {
  it('throws FORBIDDEN on every procedure when the flag is off', async () => {
    flagEnabled.value = false;
    await expect(caller.portal.getMyTaxForms()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(caller.portal.submitTaxForm(w9Submission)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});
