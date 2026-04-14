// packages/api/src/services/__tests__/einvoice-finalize.test.ts
//
// Phase 61 · Plan 61-06 Task 1 — finalize service unit tests.
//
// Uses an in-memory fake Prisma + a lightweight R2 mock + a lightweight
// profile mock. The real generator + KoSIT validator run in the einvoice
// package's test suite (Plan 02 + Plan 03); here we exercise the
// orchestration contract:
//
//   1. Happy path VALID → creates lifecycle + 2 events, puts XML to R2,
//      returns 300s signed URL.
//   2. DE public-sector + no resolver match → LEITWEG_ID_MISSING warning.
//   3. DE public-sector + GBP → BR_DE_17_NON_EUR_CURRENCY warning.
//   4. force=true replaces existing lifecycle; event log retains VALIDATED
//      + RE_VALIDATED (force replay).
//   5. force=false on existing lifecycle → throws EInvoiceAlreadyFinalizedError.
//   6. Cross-tenant invoiceId → throws EInvoiceInvoiceNotFoundError.

import type { XRechnungValidationReport } from '@contractor-ops/einvoice';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  EInvoiceAlreadyFinalizedError,
  EInvoiceInvoiceNotFoundError,
  FINALIZE_MAX_XML_BYTES,
  finalizeEInvoice,
  type R2Service,
} from '../einvoice-finalize.js';

// ---------------------------------------------------------------------------
// In-memory fake Prisma surface (only the delegates the service touches).
// ---------------------------------------------------------------------------

interface InvoiceRow {
  id: string;
  organizationId: string;
  contractorId: string | null;
  contractId: string | null;
  invoiceNumber: string;
  issueDate: Date;
  dueDate: Date;
  currency: string;
  subtotalMinor: number;
  vatRate: string | null;
  vatAmountMinor: number | null;
  totalMinor: number;
  amountToPayMinor: number;
  sellerTaxId: string | null;
  sellerName: string | null;
  buyerTaxId: string | null;
  isReverseCharge: boolean;
  contractor: {
    id: string;
    legalName: string;
    taxId: string | null;
    countryCode: string;
    isPublicSectorBuyer: boolean;
  } | null;
  contract: { id: string } | null;
  organization: {
    id: string;
    name: string;
    taxId: string | null;
    countryCode: string;
  };
  lines: Array<{
    id: string;
    lineNumber: number;
    description: string;
    quantity: unknown;
    unit: string | null;
    unitPriceMinor: number | null;
    netAmountMinor: number | null;
    vatRate: string | null;
    vatAmountMinor: number | null;
    grossAmountMinor: number | null;
  }>;
}

interface LifecycleRow {
  id: string;
  organizationId: string;
  invoiceId: string;
  profileId: string;
  xmlKey: string | null;
  xmlSha256: string | null;
  ruleSetVersion: string | null;
  validatedAt: Date | null;
  validationStatus: 'NOT_VALIDATED' | 'VALID' | 'INVALID' | 'WARNINGS';
  validationReportSummary: unknown;
}

interface EventRow {
  id: string;
  organizationId: string;
  lifecycleId: string;
  eventType: string;
  occurredAt: Date;
  actorUserId: string | null;
  detailsJson: unknown;
}

interface LeitwegIdRow {
  id: string;
  organizationId: string;
  contractorId: string | null;
  contractId: string | null;
  value: string;
  isDefaultForContractor: boolean;
}

function makeDb(seed?: {
  invoice?: InvoiceRow;
  lifecycle?: LifecycleRow;
  leitwegIds?: LeitwegIdRow[];
}) {
  const invoices: InvoiceRow[] = seed?.invoice ? [seed.invoice] : [];
  const lifecycles: LifecycleRow[] = seed?.lifecycle ? [seed.lifecycle] : [];
  const events: EventRow[] = [];
  const leitwegIds: LeitwegIdRow[] = seed?.leitwegIds ?? [];

  let lifecycleCounter = lifecycles.length;
  let eventCounter = 0;

  const invoice = {
    findFirst: vi.fn(async (args: { where: { id: string; organizationId: string }; include?: unknown }) => {
      return (
        invoices.find(
          r => r.id === args.where.id && r.organizationId === args.where.organizationId,
        ) ?? null
      );
    }),
  };

  const leitwegId = {
    findFirst: vi.fn(async (args: { where: Record<string, unknown> }) => {
      const w = args.where as {
        organizationId: string;
        contractId?: string;
        contractorId?: string;
        isDefaultForContractor?: boolean;
      };
      return (
        leitwegIds.find(r => {
          if (r.organizationId !== w.organizationId) return false;
          if (w.contractId !== undefined && r.contractId !== w.contractId) return false;
          if (w.contractorId !== undefined && r.contractorId !== w.contractorId) return false;
          if (
            w.isDefaultForContractor !== undefined &&
            r.isDefaultForContractor !== w.isDefaultForContractor
          )
            return false;
          return true;
        }) ?? null
      );
    }),
  };

  function findLifecycle(organizationId: string, invoiceId: string) {
    return (
      lifecycles.find(
        r => r.organizationId === organizationId && r.invoiceId === invoiceId,
      ) ?? null
    );
  }

  const eInvoiceLifecycle = {
    findUnique: vi.fn(
      async (args: {
        where: { organizationId_invoiceId: { organizationId: string; invoiceId: string } };
        select?: Record<string, boolean>;
      }) => {
        const { organizationId, invoiceId } = args.where.organizationId_invoiceId;
        return findLifecycle(organizationId, invoiceId);
      },
    ),
    upsert: vi.fn(
      async (args: {
        where: { organizationId_invoiceId: { organizationId: string; invoiceId: string } };
        create: Partial<LifecycleRow> & {
          organizationId: string;
          invoiceId: string;
        };
        update: Partial<LifecycleRow>;
      }) => {
        const { organizationId, invoiceId } = args.where.organizationId_invoiceId;
        const existing = findLifecycle(organizationId, invoiceId);
        if (existing) {
          Object.assign(existing, args.update);
          return existing;
        }
        lifecycleCounter += 1;
        const created: LifecycleRow = {
          id: `lc-${lifecycleCounter}`,
          organizationId: args.create.organizationId,
          invoiceId: args.create.invoiceId,
          profileId: args.create.profileId ?? 'xrechnung-de',
          xmlKey: args.create.xmlKey ?? null,
          xmlSha256: args.create.xmlSha256 ?? null,
          ruleSetVersion: args.create.ruleSetVersion ?? null,
          validatedAt: args.create.validatedAt ?? null,
          validationStatus: args.create.validationStatus ?? 'NOT_VALIDATED',
          validationReportSummary: args.create.validationReportSummary ?? null,
        };
        lifecycles.push(created);
        return created;
      },
    ),
  };

  const eInvoiceLifecycleEvent = {
    create: vi.fn(async (args: { data: Partial<EventRow> & { organizationId: string; lifecycleId: string; eventType: string } }) => {
      eventCounter += 1;
      const created: EventRow = {
        id: `ev-${eventCounter}`,
        organizationId: args.data.organizationId,
        lifecycleId: args.data.lifecycleId,
        eventType: args.data.eventType,
        occurredAt: args.data.occurredAt ?? new Date(),
        actorUserId: args.data.actorUserId ?? null,
        detailsJson: args.data.detailsJson ?? null,
      };
      events.push(created);
      return created;
    }),
  };

  async function $transaction<T>(
    fn: (tx: {
      invoice: typeof invoice;
      leitwegId: typeof leitwegId;
      eInvoiceLifecycle: typeof eInvoiceLifecycle;
      eInvoiceLifecycleEvent: typeof eInvoiceLifecycleEvent;
    }) => Promise<T>,
  ): Promise<T> {
    return fn({ invoice, leitwegId, eInvoiceLifecycle, eInvoiceLifecycleEvent });
  }

  return {
    invoice,
    leitwegId,
    eInvoiceLifecycle,
    eInvoiceLifecycleEvent,
    $transaction,
    // Test-only introspection handles:
    __rows: { invoices, lifecycles, events, leitwegIds },
  };
}

// ---------------------------------------------------------------------------
// R2 mock
// ---------------------------------------------------------------------------

function makeR2(): R2Service & {
  putCalls: Array<{ key: string; contentType: string; bodyLength: number }>;
  signCalls: Array<{ key: string; ttlSeconds: number }>;
} {
  const putCalls: Array<{ key: string; contentType: string; bodyLength: number }> = [];
  const signCalls: Array<{ key: string; ttlSeconds: number }> = [];
  return {
    putCalls,
    signCalls,
    putObject: vi.fn(async (params: { key: string; body: string | Uint8Array | Buffer; contentType: string }) => {
      const length =
        typeof params.body === 'string'
          ? Buffer.byteLength(params.body, 'utf8')
          : params.body.length;
      putCalls.push({ key: params.key, contentType: params.contentType, bodyLength: length });
    }),
    signDownloadUrl: vi.fn(async (key: string, ttlSeconds: number) => {
      signCalls.push({ key, ttlSeconds });
      return {
        signedUrl: `https://r2.test.local/${key}?sig=mock&expires=${ttlSeconds}`,
        expiresInSeconds: ttlSeconds,
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// Profile mock — returns a canned XML + report (the real generator is
// exercised in @contractor-ops/einvoice tests).
// ---------------------------------------------------------------------------

function makeProfile(
  opts: {
    xml?: string;
    report?: XRechnungValidationReport;
  } = {},
) {
  const xml =
    opts.xml ??
    '<?xml version="1.0" encoding="UTF-8"?><rsm:CrossIndustryInvoice/>';
  const report: XRechnungValidationReport = opts.report ?? {
    status: 'VALID',
    ruleSetVersion: 'XRechnung 3.0.2',
    layers: [
      { layer: 'XSD', status: 'PASS', errors: [], warnings: [], infos: [] },
      {
        layer: 'EN16931-SCH',
        status: 'PASS',
        errors: [],
        warnings: [],
        infos: [],
      },
      {
        layer: 'XRECHNUNG-SCH',
        status: 'PASS',
        errors: [],
        warnings: [],
        infos: [],
      },
    ],
  };
  return {
    generateAndValidate: vi.fn(async () => ({ xml, report })),
  };
}

function makeLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

const ORG_A = 'org_A';
const ORG_B = 'org_B';
const INVOICE_1 = 'inv_1';
const USER_1 = 'user_1';

function makeInvoice(overrides: Partial<InvoiceRow> = {}): InvoiceRow {
  return {
    id: INVOICE_1,
    organizationId: ORG_A,
    contractorId: 'ctr_1',
    contractId: 'con_1',
    invoiceNumber: 'INV-2026-0001',
    issueDate: new Date('2026-04-10'),
    dueDate: new Date('2026-05-10'),
    currency: 'EUR',
    subtotalMinor: 100_000,
    vatRate: '19',
    vatAmountMinor: 19_000,
    totalMinor: 119_000,
    amountToPayMinor: 119_000,
    sellerTaxId: 'DE123456789',
    sellerName: 'Acme GmbH',
    buyerTaxId: 'DE987654321',
    isReverseCharge: false,
    contractor: {
      id: 'ctr_1',
      legalName: 'Bundesministerium',
      taxId: 'DE987654321',
      countryCode: 'DE',
      isPublicSectorBuyer: true,
    },
    contract: { id: 'con_1' },
    organization: {
      id: ORG_A,
      name: 'Acme GmbH',
      taxId: 'DE123456789',
      countryCode: 'DE',
    },
    lines: [
      {
        id: 'ln_1',
        lineNumber: 1,
        description: 'Consulting services',
        quantity: 10,
        unit: 'HUR',
        unitPriceMinor: 10_000,
        netAmountMinor: 100_000,
        vatRate: '19',
        vatAmountMinor: 19_000,
        grossAmountMinor: 119_000,
      },
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe('finalizeEInvoice — happy path (VALID)', () => {
  it('creates lifecycle row, writes GENERATED + VALIDATED events, persists XML to R2, returns 300s signed URL', async () => {
    const invoice = makeInvoice();
    const db = makeDb({
      invoice,
      leitwegIds: [
        {
          id: 'lw_1',
          organizationId: ORG_A,
          contractorId: 'ctr_1',
          contractId: 'con_1',
          value: '991-12345-06',
          isDefaultForContractor: false,
        },
      ],
    });
    const r2 = makeR2();
    const profile = makeProfile();
    const logger = makeLogger();

    const result = await finalizeEInvoice(
      {
        db: db as never,
        r2,
        profile: profile as never,
        logger,
        now: () => new Date('2026-04-14T12:00:00Z'),
      },
      {
        organizationId: ORG_A,
        invoiceId: INVOICE_1,
        actorUserId: USER_1,
      },
    );

    // Lifecycle row persisted
    expect(db.__rows.lifecycles).toHaveLength(1);
    const lifecycle = db.__rows.lifecycles[0];
    expect(lifecycle?.validationStatus).toBe('VALID');
    expect(lifecycle?.xmlSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(lifecycle?.xmlKey).toContain(`einvoice-xml/${ORG_A}/${INVOICE_1}/`);
    expect(lifecycle?.ruleSetVersion).toContain('XRechnung 3.0.2');

    // Two events
    expect(db.__rows.events).toHaveLength(2);
    expect(db.__rows.events[0]?.eventType).toBe('GENERATED');
    expect(db.__rows.events[1]?.eventType).toBe('VALIDATED');
    expect(db.__rows.events[0]?.actorUserId).toBe(USER_1);

    // R2 put + sign
    expect(r2.putCalls).toHaveLength(1);
    expect(r2.putCalls[0]?.contentType).toBe('application/xml');
    expect(r2.signCalls).toHaveLength(1);
    expect(r2.signCalls[0]?.ttlSeconds).toBe(300);

    // Result shape
    expect(result.validationStatus).toBe('VALID');
    expect(result.warnings).toEqual([]);
    expect(result.resolvedLeitwegId).not.toBeNull();
    expect(result.resolvedLeitwegId?.source).toBe('contract_override');
    expect(result.xmlDownloadExpiresInSeconds).toBe(300);
    expect(result.xmlDownloadUrl).toMatch(/^https:\/\/r2\.test\.local\//);

    // Profile was called with the resolved Leitweg-ID
    expect(profile.generateAndValidate).toHaveBeenCalledOnce();
    const [, opts] = profile.generateAndValidate.mock.calls[0] ?? [];
    expect((opts as { leitwegId?: string | null }).leitwegId).toBe('991-12345-06');
  });
});

describe('finalizeEInvoice — warnings', () => {
  it('adds LEITWEG_ID_MISSING on DE public-sector buyer when resolver returns null', async () => {
    const invoice = makeInvoice();
    const db = makeDb({ invoice, leitwegIds: [] });
    const r2 = makeR2();
    const profile = makeProfile();

    const result = await finalizeEInvoice(
      { db: db as never, r2, profile: profile as never, logger: makeLogger() },
      { organizationId: ORG_A, invoiceId: INVOICE_1, actorUserId: null },
    );

    expect(result.warnings).toContain('LEITWEG_ID_MISSING');
    expect(result.resolvedLeitwegId).toBeNull();
  });

  it('adds BR_DE_17_NON_EUR_CURRENCY on DE public-sector + GBP invoice', async () => {
    const invoice = makeInvoice({ currency: 'GBP' });
    const db = makeDb({
      invoice,
      leitwegIds: [
        {
          id: 'lw_1',
          organizationId: ORG_A,
          contractorId: 'ctr_1',
          contractId: 'con_1',
          value: '991-12345-06',
          isDefaultForContractor: false,
        },
      ],
    });
    const r2 = makeR2();
    const profile = makeProfile();

    const result = await finalizeEInvoice(
      { db: db as never, r2, profile: profile as never, logger: makeLogger() },
      { organizationId: ORG_A, invoiceId: INVOICE_1, actorUserId: null },
    );

    expect(result.warnings).toContain('BR_DE_17_NON_EUR_CURRENCY');
    expect(result.warnings).not.toContain('LEITWEG_ID_MISSING');
  });

  it('emits no warnings for a DE private-sector buyer (isPublicSectorBuyer=false)', async () => {
    const invoice = makeInvoice({
      contractor: {
        id: 'ctr_1',
        legalName: 'ACME Holdings',
        taxId: 'DE987654321',
        countryCode: 'DE',
        isPublicSectorBuyer: false,
      },
      currency: 'GBP',
    });
    const db = makeDb({ invoice });
    const r2 = makeR2();
    const profile = makeProfile();

    const result = await finalizeEInvoice(
      { db: db as never, r2, profile: profile as never, logger: makeLogger() },
      { organizationId: ORG_A, invoiceId: INVOICE_1, actorUserId: null },
    );

    expect(result.warnings).toEqual([]);
  });
});

describe('finalizeEInvoice — force re-finalize', () => {
  it('force=true on an existing lifecycle replaces the row + writes RE_VALIDATED event', async () => {
    const invoice = makeInvoice();
    const existing: LifecycleRow = {
      id: 'lc-pre',
      organizationId: ORG_A,
      invoiceId: INVOICE_1,
      profileId: 'xrechnung-de',
      xmlKey: 'einvoice-xml/org_A/inv_1/oldhash.xml',
      xmlSha256: 'a'.repeat(64),
      ruleSetVersion: 'XRechnung 3.0.2',
      validatedAt: new Date('2026-04-01'),
      validationStatus: 'VALID',
      validationReportSummary: { status: 'VALID', ruleSetVersion: 'XRechnung 3.0.2' },
    };
    const db = makeDb({ invoice, lifecycle: existing });
    const r2 = makeR2();
    const profile = makeProfile();

    const result = await finalizeEInvoice(
      { db: db as never, r2, profile: profile as never, logger: makeLogger() },
      { organizationId: ORG_A, invoiceId: INVOICE_1, actorUserId: USER_1, force: true },
    );

    // Still exactly one lifecycle row (upsert respects uniqueness).
    expect(db.__rows.lifecycles).toHaveLength(1);
    // But the row was updated (new xmlKey).
    expect(db.__rows.lifecycles[0]?.xmlKey).not.toBe(
      'einvoice-xml/org_A/inv_1/oldhash.xml',
    );

    // Two new events written, the second is RE_VALIDATED.
    const eventTypes = db.__rows.events.map(e => e.eventType);
    expect(eventTypes).toEqual(['GENERATED', 'RE_VALIDATED']);

    expect(result.lifecycleId).toBe(existing.id);
  });

  it('force=false on an existing lifecycle throws EInvoiceAlreadyFinalizedError', async () => {
    const invoice = makeInvoice();
    const existing: LifecycleRow = {
      id: 'lc-pre',
      organizationId: ORG_A,
      invoiceId: INVOICE_1,
      profileId: 'xrechnung-de',
      xmlKey: 'k',
      xmlSha256: 'a'.repeat(64),
      ruleSetVersion: 'XRechnung 3.0.2',
      validatedAt: new Date(),
      validationStatus: 'VALID',
      validationReportSummary: {},
    };
    const db = makeDb({ invoice, lifecycle: existing });
    const r2 = makeR2();
    const profile = makeProfile();

    await expect(
      finalizeEInvoice(
        { db: db as never, r2, profile: profile as never, logger: makeLogger() },
        {
          organizationId: ORG_A,
          invoiceId: INVOICE_1,
          actorUserId: null,
          force: false,
        },
      ),
    ).rejects.toThrow(EInvoiceAlreadyFinalizedError);

    // No R2 write attempted
    expect(r2.putCalls).toHaveLength(0);
  });
});

describe('finalizeEInvoice — cross-tenant + missing invoice', () => {
  it('rejects cross-tenant invoiceId with EInvoiceInvoiceNotFoundError', async () => {
    const invoice = makeInvoice(); // owned by ORG_A
    const db = makeDb({ invoice });
    const r2 = makeR2();
    const profile = makeProfile();

    await expect(
      finalizeEInvoice(
        { db: db as never, r2, profile: profile as never, logger: makeLogger() },
        {
          organizationId: ORG_B, // wrong tenant
          invoiceId: INVOICE_1,
          actorUserId: null,
        },
      ),
    ).rejects.toThrow(EInvoiceInvoiceNotFoundError);

    expect(r2.putCalls).toHaveLength(0);
    expect(db.__rows.lifecycles).toHaveLength(0);
  });

  it('rejects unknown invoiceId with EInvoiceInvoiceNotFoundError', async () => {
    const db = makeDb(); // empty
    const r2 = makeR2();
    const profile = makeProfile();

    await expect(
      finalizeEInvoice(
        { db: db as never, r2, profile: profile as never, logger: makeLogger() },
        {
          organizationId: ORG_A,
          invoiceId: 'does_not_exist',
          actorUserId: null,
        },
      ),
    ).rejects.toThrow(EInvoiceInvoiceNotFoundError);
  });
});

// ---------------------------------------------------------------------------
// Edge cases — XML size guard + R2 failure propagation
// ---------------------------------------------------------------------------

describe('einvoice-finalize — edge cases', () => {
  it('throws when generated XML exceeds FINALIZE_MAX_XML_BYTES (5 MiB)', async () => {
    const invoice = makeInvoice();
    const db = makeDb({ invoice });
    const r2 = makeR2();
    const oversizedXml = 'x'.repeat(6 * 1024 * 1024); // 6 MiB > 5 MiB limit
    const profile = makeProfile({ xml: oversizedXml });
    const logger = makeLogger();

    await expect(
      finalizeEInvoice(
        { db: db as never, r2, profile: profile as never, logger, now: () => new Date('2026-04-14T12:00:00Z') },
        { organizationId: ORG_A, invoiceId: INVOICE_1, actorUserId: USER_1 },
      ),
    ).rejects.toThrow(/XRechnung XML exceeds/);

    // Verify the error message includes the byte counts
    await expect(
      finalizeEInvoice(
        { db: db as never, r2, profile: profile as never, logger, now: () => new Date('2026-04-14T12:00:00Z') },
        { organizationId: ORG_A, invoiceId: INVOICE_1, actorUserId: USER_1 },
      ),
    ).rejects.toThrow(`${FINALIZE_MAX_XML_BYTES} bytes`);

    // R2 should never have been called — the guard fires before persistence
    expect(r2.putCalls).toHaveLength(0);

    // Logger.error should have been called
    expect(logger.error).toHaveBeenCalled();
  });

  it('propagates R2 putObject failure as-is', async () => {
    const invoice = makeInvoice();
    const db = makeDb({ invoice });
    const r2 = makeR2();
    const r2Error = new Error('R2 connection timeout');
    r2.putObject = vi.fn().mockRejectedValue(r2Error);
    const profile = makeProfile();
    const logger = makeLogger();

    await expect(
      finalizeEInvoice(
        { db: db as never, r2, profile: profile as never, logger, now: () => new Date('2026-04-14T12:00:00Z') },
        { organizationId: ORG_A, invoiceId: INVOICE_1, actorUserId: USER_1 },
      ),
    ).rejects.toThrow('R2 connection timeout');

    // putObject was called exactly once before it threw
    expect(r2.putObject).toHaveBeenCalledOnce();

    // signDownloadUrl should NOT have been called since putObject failed first
    expect(r2.signCalls).toHaveLength(0);
  });
});
