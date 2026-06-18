// Portal W-8BEN-E (foreign-entity) intake integration tests.
// Owns: pnpm --filter @contractor-ops/api test src/routers/portal/__tests__/tax-form-w8bene.test.ts
//
// Sibling to tax-form.test.ts (W-9 + W-8BEN). This file exercises the
// foreign-ENTITY branch of portal.submitTaxForm in depth — the path the
// W-9/W-8BEN coverage only grazes:
//   - The W-8BEN-E variant lands the chapter-3 entityType (line 4) +
//     limitation-on-benefits lobCategory (line 14b) into the immutable snapshot
//     fields, and the resolved treaty article (line 15) + rate onto the row.
//   - The ESIGN "under penalties of perjury" certification is mandatory: a
//     false perjuryAccepted or an empty/whitespace signerName is rejected at the
//     input boundary before any row is written.
//   - The record is append-only: a re-cert supersedes the prior ACTIVE entity
//     row and inserts a NEW ACTIVE row, writing a CONTRACTOR audit row each time.
//   - The whole surface is gated behind module.us-expansion (FORBIDDEN off).

import { beforeEach, describe, expect, it, vi } from 'vitest';

const ORG_ID = 'org-taxform-001';
const CONTRACTOR_ID = 'contractor-taxform-001';
const SESSION_TOKEN = 'portal-session-token-taxform';

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
          type: 'COMPANY',
          legalName: 'Kowalski sp. z o.o.',
          displayName: 'Kowalski',
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

const w8beneSubmission = {
  formType: 'W8BENE' as const,
  treatyCountry: 'PL',
  entityType: 'CORPORATION' as const,
  lobCategory: 'PUBLICLY_TRADED_CORPORATION' as const,
  ftin: 'PL1234567890',
  addressLine1: '1 Market St',
  city: 'Warsaw',
  perjuryAccepted: true as const,
  signerName: 'Jan Kowalski',
};

describe('portal.submitTaxForm — W-8BEN-E entity branch (snapshot fields)', () => {
  it('lands entityType (line 4) + lobCategory (line 14b) in the snapshot fields, never the attestation', async () => {
    const result = await caller.portal.submitTaxForm(w8beneSubmission);

    expect(result.formType).toBe('W8BENE');
    expect(result.status).toBe('ACTIVE');

    const snapshot = taxFormRows[0]?.snapshotJson as Rec;
    const fields = snapshot.fields as Rec;
    expect(fields.entityType).toBe('CORPORATION');
    expect(fields.lobCategory).toBe('PUBLICLY_TRADED_CORPORATION');

    // The perjury/signer split: captured fields hold the form data, the
    // attestation holds the ESIGN block — never the reverse.
    expect(fields.perjuryAccepted).toBeUndefined();
    expect(fields.signerName).toBeUndefined();
    const attestation = snapshot.attestation as Rec;
    expect(attestation.signerName).toBe('Jan Kowalski');
    expect(attestation.perjuryAccepted).toBe(true);
  });

  it('resolves the treaty article (line 15) + rate onto the row + snapshot claim', async () => {
    await caller.portal.submitTaxForm(w8beneSubmission);

    const row = taxFormRows[0];
    expect(row.treatyArticle).toBe('Article 7');
    expect(Number(row.treatyRate)).toBe(0);
    expect(row.contractorResidency).toBe('PL');

    const claim = (taxFormRows[0]?.snapshotJson as Rec).treatyClaim as Rec;
    expect(claim.article).toBe('Article 7');
    expect(claim.residency).toBe('PL');
    expect(Number(claim.rate)).toBe(0);
  });

  it('mirrors the resolved treaty claim into the CONTRACTOR audit metadata', async () => {
    await caller.portal.submitTaxForm(w8beneSubmission);

    expect(auditWrites).toHaveLength(1);
    expect(auditWrites[0]).toMatchObject({
      action: 'tax.form.submitted',
      actorType: 'CONTRACTOR',
      actorId: CONTRACTOR_ID,
      resourceType: 'CONTRACTOR',
      resourceId: CONTRACTOR_ID,
    });
    const metadata = auditWrites[0]?.metadata as Rec;
    expect(metadata.formType).toBe('W8BENE');
    expect(metadata.treatyArticle).toBe('Article 7');
    expect(Number(metadata.treatyRate)).toBe(0);
  });

  it('sets an expiry ~3 years out (W-8BEN-E claims are time-bound, unlike a W-9)', async () => {
    await caller.portal.submitTaxForm(w8beneSubmission);

    const expiresAt = taxFormRows[0]?.expiresAt as Date;
    const signedAt = taxFormRows[0]?.signedAt as Date;
    expect(expiresAt).toBeInstanceOf(Date);
    expect(expiresAt.getUTCFullYear() - signedAt.getUTCFullYear()).toBe(3);
  });
});

describe('portal.submitTaxForm — W-8BEN-E ESIGN certification is mandatory', () => {
  it('rejects a submission whose perjury box is not checked (no row written)', async () => {
    await expect(
      caller.portal.submitTaxForm({
        ...w8beneSubmission,
        perjuryAccepted: false as never,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    expect(taxFormRows).toHaveLength(0);
    expect(auditWrites).toHaveLength(0);
  });

  it('rejects a submission with an empty / whitespace-only typed signerName', async () => {
    await expect(
      caller.portal.submitTaxForm({
        ...w8beneSubmission,
        signerName: '   ',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    expect(taxFormRows).toHaveLength(0);
  });

  it('rejects an invalid lobCategory at the input boundary', async () => {
    await expect(
      caller.portal.submitTaxForm({
        ...w8beneSubmission,
        lobCategory: 'NOT_A_REAL_LOB' as never,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    expect(taxFormRows).toHaveLength(0);
  });
});

describe('portal.submitTaxForm — W-8BEN-E append-only re-certification', () => {
  it('inserts a single immutable ACTIVE row + one CONTRACTOR audit row on first cert', async () => {
    await caller.portal.submitTaxForm(w8beneSubmission);

    expect(taxFormRows).toHaveLength(1);
    expect(taxFormRows[0]).toMatchObject({
      contractorId: CONTRACTOR_ID,
      organizationId: ORG_ID,
      formType: 'W8BENE',
      status: 'ACTIVE',
    });
    expect(auditWrites).toHaveLength(1);
  });

  it('supersedes the prior ACTIVE row and inserts a NEW ACTIVE row on re-cert', async () => {
    await caller.portal.submitTaxForm(w8beneSubmission);
    // Re-cert with a changed LOB category — a signed row is never mutated in place.
    await caller.portal.submitTaxForm({
      ...w8beneSubmission,
      lobCategory: 'COMPANY_MEETS_DERIVATIVE_BENEFITS_TEST',
    });

    expect(taxFormRows).toHaveLength(2);
    const active = taxFormRows.filter(r => r.status === 'ACTIVE');
    const superseded = taxFormRows.filter(r => r.status === 'SUPERSEDED');
    expect(active).toHaveLength(1);
    expect(superseded).toHaveLength(1);

    // The surviving ACTIVE row carries the re-certified LOB category.
    const activeFields = (active[0]?.snapshotJson as Rec).fields as Rec;
    expect(activeFields.lobCategory).toBe('COMPANY_MEETS_DERIVATIVE_BENEFITS_TEST');
    expect(auditWrites).toHaveLength(2);
  });
});

describe('portal.submitTaxForm — W-8BEN-E module.us-expansion gating', () => {
  it('throws FORBIDDEN (not NOT_FOUND) when the flag is off — no row written', async () => {
    flagEnabled.value = false;
    await expect(caller.portal.submitTaxForm(w8beneSubmission)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(taxFormRows).toHaveLength(0);
    expect(auditWrites).toHaveLength(0);
  });
});
