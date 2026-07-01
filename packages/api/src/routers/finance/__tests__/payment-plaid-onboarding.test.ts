// Reachable Plaid onboarding verification (paymentCore.verifyBillingProfilePlaid).
//
// Proves the tRPC entry point — not just the underlying seam — is wired, gated,
// tenant-scoped, and writes the persisted verification status the payout path
// later reads. An operator verifies a US contractor's bank account at onboarding;
// the procedure runs the deterministic Plaid mock and persists the outcome on
// ContractorBillingProfile.
//
// Invariants exercised through the caller:
//   - write half: a VERIFIED profile ends with a non-null plaidVerificationStatus
//     + plaidVerifiedAt and a masked audit row (the payout advisory read now has a
//     real non-null value to differentiate)
//   - fail-open: a mock returning PENDING / FAILED never throws or blocks — the
//     non-VERIFIED status is still persisted
//   - differentiation: a VERIFIED and a PENDING profile persist distinct statuses,
//     so the per-item payout advisory can tell verified from unverified
//   - tenant isolation: a foreign-org billingProfileId is NOT_FOUND and nothing is
//     written
//   - gating: assertUsExpansionEnabled throws (before any load/write) when the US
//     surface is off
//   - masked audit: the audit metadata carries billingProfileId + status only —
//     never routing / account

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Controllable module state (hoisted so the mock factories can close over it)
// ---------------------------------------------------------------------------

const { flagState, dbState } = vi.hoisted(() => ({
  flagState: { usExpansion: true },
  dbState: { current: null as unknown },
}));

// ---------------------------------------------------------------------------
// Mocks — the minimal surface paymentCoreRouter's import graph needs to load
// and run hermetically (no live Postgres / Redis / Unleash / provider SDK).
// ---------------------------------------------------------------------------

vi.mock('@contractor-ops/feature-flags', () => ({
  // assertUsExpansionEnabled evaluates 'module.us-expansion'; every other flag
  // is irrelevant to verifyBillingProfilePlaid and defaults enabled.
  evaluate: (key: string) => ({
    enabled: key === 'module.us-expansion' ? flagState.usExpansion : true,
    reason: 'mock',
  }),
}));

vi.mock('@contractor-ops/db', () => {
  const passthrough = <T>(c: T) => c;
  return {
    prisma: {},
    prismaRaw: {},
    withRlsTransactions: passthrough,
    withRlsReads: passthrough,
    withTenantScope: vi.fn(passthrough),
    withSoftDelete: vi.fn(passthrough),
    tenantStore: {
      run: (_ctx: unknown, fn: () => unknown) => fn(),
      getStore: vi.fn(() => ({ region: 'US' })),
    },
    createTenantClient: vi.fn(() => dbState.current),
    createTenantClientFrom: vi.fn(() => dbState.current),
    getRegionalClient: vi.fn(() => dbState.current),
  };
});

vi.mock('@contractor-ops/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
      hasPermission: vi.fn().mockResolvedValue({ success: true }),
    },
  },
  authApi: {
    hasPermission: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock('../../../services/org-cache', () => ({
  getOrgMeta: vi.fn(async () => ({
    id: 'org-1',
    dataRegion: 'US',
    status: 'ACTIVE',
    name: 'US Test Org',
  })),
  invalidateOrgMeta: vi.fn(async () => undefined),
  invalidateOrgBranding: vi.fn(async () => undefined),
  ORG_META_TTL_SECONDS: 300,
  orgMetaKey: (orgId: string) => `org:${orgId}:meta`,
}));

// The mock Plaid client is a faithful reproduction of the shipped
// MockPlaidIdentityClient: deterministic status by account id (VERIFIED default,
// PENDING / FAILED for the two known fixture ids), with an advisory warning on any
// non-VERIFIED status. The verification-status write path is what is under test.
vi.mock('@contractor-ops/integrations', () => ({
  MockModernTreasuryAdapter: class {},
  StripeTreasuryAdapter: class {},
  MockPlaidIdentityClient: class {
    async verify(input: {
      accountId: string;
      legalName: string;
      routingNumber: string;
      accountNumber: string;
    }) {
      const status =
        input.accountId === 'plaid-acct-mismatch'
          ? 'FAILED'
          : input.accountId === 'plaid-acct-pending'
            ? 'PENDING'
            : 'VERIFIED';
      if (status === 'VERIFIED') {
        return { status, plaidAccountId: input.accountId, nameMatchScore: 1 };
      }
      return {
        status,
        advisoryWarning: `Plaid could not verify "${input.legalName}" — payout may proceed advisory-only.`,
        plaidAccountId: input.accountId,
        nameMatchScore: status === 'PENDING' ? 0.5 : 0,
      };
    }
  },
}));

vi.mock('@contractor-ops/logger', () => {
  const stub = () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    child: vi.fn(),
  });
  return {
    createLogger: vi.fn(stub),
    createTrpcLogger: vi.fn(stub),
    createWebhookLogger: vi.fn(stub),
    createCronLogger: vi.fn(stub),
    createIntegrationLogger: vi.fn(stub),
    getIdpAuditLogger: vi.fn(stub),
    withBodyLogging: vi.fn((_o, fn) => fn),
    logIntegrationCall: vi.fn(),
    subscribeOpossumEvents: vi.fn(),
    runWithRequestContext: vi.fn((_c, fn) => fn()),
    getRequestId: vi.fn(() => undefined),
    getTraceparent: vi.fn(() => undefined),
    buildContextFromHeaders: vi.fn(() => ({})),
    getOutboundHeaders: vi.fn(() => ({})),
    generateRequestId: vi.fn(() => 'test-request-id'),
    logger: Object.assign(stub(), { child: () => stub() }),
    LOG_BODY_INCLUDE_PREFIXES: [],
    PII_MASK_KEYWORDS: [],
    PII_MASK_PATHS: [],
  };
});

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

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import * as E from '../../../errors';
import { createCallerFactory, router } from '../../../init';
import { paymentCoreRouter } from '../payment-core';

// paymentCoreRouter merges into paymentRouter under no sub-namespace and mounts
// at `payment` in appRouter, so `payment.verifyBillingProfilePlaid` here is the
// real reachable path.
const testRouter = router({ payment: paymentCoreRouter });
const createCaller = createCallerFactory(testRouter);

const ORG_ID = 'org-1';
const OTHER_ORG_ID = 'org-2';
const USER_ID = 'user-1';
const CONTRACTOR_ID = 'clctr00000000000000000001';
const PROFILE_VERIFIED = 'clbp00000000000000000001a';
const PROFILE_PENDING = 'clbp00000000000000000002a';
const PROFILE_MISMATCH = 'clbp00000000000000000003a';
const PROFILE_FOREIGN = 'clbp00000000000000000004a';

function makeCaller(userId: string, orgId: string) {
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
      name: 'Test User',
      email: `${userId}@example.com`,
      emailVerified: true,
      image: null,
      banned: false,
      banReason: null,
      banExpires: null,
      role: 'admin',
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

const caller = makeCaller(USER_ID, ORG_ID);

// ---------------------------------------------------------------------------
// Stateful in-memory Prisma stub. `contractorBillingProfile.update` mutates the
// seeded profile in place so a subsequent read observes the persisted status —
// the "later readable" differentiation guarantee is only meaningful if the write
// is durable across the call.
// ---------------------------------------------------------------------------

type Profile = {
  id: string;
  organizationId: string;
  contractorId: string;
  plaidAccountId: string | null;
  plaidVerificationStatus: string | null;
  plaidVerifiedAt: Date | null;
  usRoutingNumberMasked: string | null;
  usAccountNumberMasked: string | null;
  contractor: { legalName: string };
};

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: PROFILE_VERIFIED,
    organizationId: ORG_ID,
    contractorId: CONTRACTOR_ID,
    plaidAccountId: null,
    plaidVerificationStatus: null,
    plaidVerifiedAt: null,
    usRoutingNumberMasked: '****0021',
    usAccountNumberMasked: '****6789',
    contractor: { legalName: 'Jan Kowalski' },
    ...overrides,
  };
}

function seedDb(profiles: Profile[]) {
  const auditCreate = vi.fn(async () => ({}));
  const findFirst = vi.fn(
    async ({ where }: { where: { id: string; organizationId: string } }) =>
      profiles.find(p => p.id === where.id && p.organizationId === where.organizationId) ?? null,
  );
  const update = vi.fn(
    async ({ where, data }: { where: { id: string }; data: Partial<Profile> }) => {
      const profile = profiles.find(p => p.id === where.id);
      if (profile) Object.assign(profile, data);
      return profile;
    },
  );
  const db = {
    contractorBillingProfile: { findFirst, update },
    auditLog: { create: auditCreate },
  };
  dbState.current = db;
  return { profiles, auditCreate, findFirst, update };
}

beforeEach(() => {
  flagState.usExpansion = true;
  dbState.current = null;
});

describe('paymentCore.verifyBillingProfilePlaid — write half (US-PAY-05)', () => {
  it('persists a VERIFIED status + plaidVerifiedAt + masked audit for a verifiable profile', async () => {
    const { profiles, auditCreate } = seedDb([makeProfile()]);

    const result = await caller.payment.verifyBillingProfilePlaid({
      billingProfileId: PROFILE_VERIFIED,
    });

    expect(result.status).toBe('VERIFIED');
    expect(profiles[0]?.plaidVerificationStatus).toBe('VERIFIED');
    expect(profiles[0]?.plaidVerifiedAt).toBeInstanceOf(Date);

    expect(auditCreate).toHaveBeenCalledTimes(1);
    const row = auditCreate.mock.calls[0]?.[0] as {
      data: { action: string; resourceType: string; resourceId: string; metadataJson: unknown };
    };
    expect(row.data.action).toBe('contractor_billing_profile.plaid_verified');
    expect(row.data.resourceType).toBe('CONTRACTOR');
    expect(row.data.resourceId).toBe(CONTRACTOR_ID);
    const metadata = row.data.metadataJson as { billingProfileId: string; status: string };
    expect(metadata.billingProfileId).toBe(PROFILE_VERIFIED);
    expect(metadata.status).toBe('VERIFIED');
  });

  it('carries no bank routing / account in the masked audit metadata', async () => {
    const { auditCreate } = seedDb([makeProfile()]);

    await caller.payment.verifyBillingProfilePlaid({ billingProfileId: PROFILE_VERIFIED });

    const serialized = JSON.stringify(auditCreate.mock.calls[0]?.[0]);
    expect(serialized).not.toContain('0021');
    expect(serialized).not.toContain('6789');
    expect(serialized).not.toContain('routingNumber');
    expect(serialized).not.toContain('accountNumber');
  });
});

describe('paymentCore.verifyBillingProfilePlaid — fail-open (never throws / blocks)', () => {
  it('persists a PENDING status and returns an advisory warning without throwing', async () => {
    const { profiles } = seedDb([
      makeProfile({ id: PROFILE_PENDING, plaidAccountId: 'plaid-acct-pending' }),
    ]);

    const result = await caller.payment.verifyBillingProfilePlaid({
      billingProfileId: PROFILE_PENDING,
    });

    expect(result.status).toBe('PENDING');
    expect(result.advisoryWarning).toBeTruthy();
    expect(profiles[0]?.plaidVerificationStatus).toBe('PENDING');
    expect(profiles[0]?.plaidVerifiedAt).toBeInstanceOf(Date);
  });

  it('persists a FAILED status without throwing (an unverified account is advisory)', async () => {
    const { profiles } = seedDb([
      makeProfile({ id: PROFILE_MISMATCH, plaidAccountId: 'plaid-acct-mismatch' }),
    ]);

    const result = await caller.payment.verifyBillingProfilePlaid({
      billingProfileId: PROFILE_MISMATCH,
    });

    expect(result.status).toBe('FAILED');
    expect(result.advisoryWarning).toBeTruthy();
    expect(profiles[0]?.plaidVerificationStatus).toBe('FAILED');
  });
});

describe('paymentCore.verifyBillingProfilePlaid — persisted status differentiates', () => {
  it('persists distinct statuses so the payout advisory can tell verified from unverified', async () => {
    const { profiles } = seedDb([
      makeProfile(),
      makeProfile({ id: PROFILE_PENDING, plaidAccountId: 'plaid-acct-pending' }),
    ]);

    await caller.payment.verifyBillingProfilePlaid({ billingProfileId: PROFILE_VERIFIED });
    await caller.payment.verifyBillingProfilePlaid({ billingProfileId: PROFILE_PENDING });

    const verified = profiles.find(p => p.id === PROFILE_VERIFIED);
    const pending = profiles.find(p => p.id === PROFILE_PENDING);
    expect(verified?.plaidVerificationStatus).toBe('VERIFIED');
    expect(pending?.plaidVerificationStatus).toBe('PENDING');
    expect(verified?.plaidVerificationStatus).not.toBe(pending?.plaidVerificationStatus);
  });
});

describe('paymentCore.verifyBillingProfilePlaid — tenant isolation', () => {
  it('rejects a foreign-org billingProfileId with NOT_FOUND and writes nothing', async () => {
    const { profiles, update, auditCreate } = seedDb([
      makeProfile({ id: PROFILE_FOREIGN, organizationId: OTHER_ORG_ID }),
    ]);

    await expect(
      caller.payment.verifyBillingProfilePlaid({ billingProfileId: PROFILE_FOREIGN }),
    ).rejects.toMatchObject({ message: E.BILLING_PROFILE_NOT_FOUND });

    expect(update).not.toHaveBeenCalled();
    expect(auditCreate).not.toHaveBeenCalled();
    expect(profiles[0]?.plaidVerificationStatus).toBeNull();
  });
});

describe('paymentCore.verifyBillingProfilePlaid — US-expansion gating', () => {
  it('rejects with US_EXPANSION_DISABLED when the surface is off, before any load / write', async () => {
    flagState.usExpansion = false;
    const { findFirst, update } = seedDb([makeProfile()]);

    await expect(
      caller.payment.verifyBillingProfilePlaid({ billingProfileId: PROFILE_VERIFIED }),
    ).rejects.toMatchObject({ message: E.US_EXPANSION_DISABLED });

    expect(findFirst).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
});
