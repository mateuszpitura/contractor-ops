import { describe, expect, it, vi } from 'vitest';
import type { AchReturnEntry } from '../ach-return.service';
import {
  applyAchReturns,
  mapReturnCodeToStatus,
  parseNachaReturnFile,
} from '../ach-return.service';

// Right-justify / left-justify helpers so each fixed-width NACHA field lands at
// the exact column offset the parser reads (mirroring the generator's layout).
const padRight = (value: string, len: number): string => value.padEnd(len, ' ').slice(0, len);
const padLeftZero = (value: string, len: number): string => value.padStart(len, '0').slice(-len);

// A minimal NACHA return file: one entry-detail (type 6) record for the returned
// credit, followed by its addenda (type 7, addenda type code 99) carrying the
// return reason. Field widths match the entry-detail / addenda-99 column layout.
const RETURN_FILE = [
  [
    '6',
    '21', // transaction code — return of a checking credit
    padLeftZero('12345678', 8), // RDFI routing (first 8 digits)
    '9', // routing check digit
    padRight('000987654321', 17), // DFI account number
    padLeftZero('5000000', 10), // amount in cents ($50,000.00)
    padRight('INV-US-001', 15), // individual id — the original invoice reference
    padRight('US PAYEE LLC', 22), // receiver name
    padRight('', 2), // discretionary data
    '1', // addenda record indicator
    padRight('021000020000001', 15), // trace number
  ].join(''),
  [
    '7',
    '99', // addenda type code — return
    'R01', // return reason code
    padRight('021000020000001', 15), // original entry trace
    padRight('', 6), // date of death (unused)
    padLeftZero('12345678', 8), // original receiving DFI id
    padRight('INSUFFICIENT FUNDS', 44), // addenda information
    padRight('021000020000001', 15), // trace number
  ].join(''),
].join('\r\n');

describe('mapReturnCodeToStatus', () => {
  it('maps R01 (insufficient funds) to a FAILED disposition', () => {
    const mapping = mapReturnCodeToStatus('R01');
    expect(mapping.disposition).toBe('FAILED');
    expect(mapping.reason.toLowerCase()).toContain('insufficient');
  });

  it('maps R02 (account closed) to a FAILED disposition', () => {
    const mapping = mapReturnCodeToStatus('R02');
    expect(mapping.disposition).toBe('FAILED');
    expect(mapping.reason.toLowerCase()).toContain('closed');
  });

  it('maps R03 (no account / unable to locate) to a FAILED disposition', () => {
    const mapping = mapReturnCodeToStatus('R03');
    expect(mapping.disposition).toBe('FAILED');
    expect(mapping.reason.toLowerCase()).toMatch(/no account|unable to locate/);
  });

  it('maps a NOC/COR correction code to an ADVISORY disposition (never a failure)', () => {
    expect(mapReturnCodeToStatus('C01').disposition).toBe('ADVISORY');
    expect(mapReturnCodeToStatus('NOC').disposition).toBe('ADVISORY');
  });
});

describe('parseNachaReturnFile', () => {
  it('parses a returned entry + its addenda-99 R-code into one AchReturnEntry', () => {
    const entries = parseNachaReturnFile(RETURN_FILE);

    expect(entries).toHaveLength(1);
    const [entry] = entries;
    expect(entry?.traceNumber).toBe('021000020000001');
    expect(entry?.individualId).toBe('INV-US-001');
    expect(entry?.amountMinor).toBe(50_000_00);
    expect(entry?.returnCode).toBe('R01');
    expect(entry?.addendaInfo).toContain('INSUFFICIENT FUNDS');
  });

  it('skips stray / malformed records defensively and never throws', () => {
    const noisy = ['GARBAGE LINE — NOT A NACHA RECORD', RETURN_FILE, '', '7 tiny'].join('\r\n');

    const entries = parseNachaReturnFile(noisy);

    expect(entries).toHaveLength(1);
    expect(entries[0]?.returnCode).toBe('R01');
    expect(entries[0]?.individualId).toBe('INV-US-001');
  });
});

// --- applyAchReturns: idempotent, tenant-scoped status transition ------------
// A bounced ACH credit must reliably flip its live PaymentRunItem to FAILED,
// exactly once, with a masked audit row — and a re-delivered file must be a
// no-op. A wrong-run / mis-uploaded file surfaces via `unmatched`, never a
// silent no-op. The fake db mirrors the payout-init harness (findMany/update
// spies + a $transaction that runs its callback), no live DB.

const ORG_ID = 'org-1';
const OTHER_ORG_ID = 'org-2';
const ACTOR_ID = 'user-1';
const RUN_ID = 'run-1';

type FakeItem = {
  id: string;
  organizationId: string;
  paymentRunId: string;
  status: string;
  failureReason: string | null;
  paymentReference: string | null;
  amountMinor: number;
  invoiceId: string | null;
  invoice: {
    id: string;
    invoiceNumber: string | null;
    currency: string;
    paymentStatus: string;
  } | null;
};

function makeItem(overrides: Partial<FakeItem> = {}): FakeItem {
  return {
    id: 'item-1',
    organizationId: ORG_ID,
    paymentRunId: RUN_ID,
    status: 'EXPORTED',
    failureReason: null,
    paymentReference: null,
    amountMinor: 50_000_00,
    invoiceId: 'inv-1',
    invoice: {
      id: 'inv-1',
      invoiceNumber: 'INV-US-001',
      currency: 'USD',
      paymentStatus: 'IN_RUN',
    },
    ...overrides,
  };
}

function makeEntry(overrides: Partial<AchReturnEntry> = {}): AchReturnEntry {
  return {
    traceNumber: '021000020000001',
    individualId: 'INV-US-001',
    amountMinor: 50_000_00,
    returnCode: 'R01',
    addendaInfo: 'INSUFFICIENT FUNDS',
    ...overrides,
  };
}

/**
 * Minimal Prisma-shaped stub. `paymentRunItem.findMany` echoes the tenant-scoped
 * subset, `paymentRunItem.update` mutates the in-memory row so a re-apply sees
 * the FAILED state (the idempotency assertion), `auditLog.create` is spied. The
 * `$transaction` runs its callback against the same client.
 */
function makeDb(items: FakeItem[]) {
  const findMany = vi.fn(
    async ({ where }: { where: { paymentRunId: string; organizationId: string } }) =>
      items.filter(
        i => i.paymentRunId === where.paymentRunId && i.organizationId === where.organizationId,
      ),
  );
  const update = vi.fn(
    async ({ where, data }: { where: { id: string }; data: Partial<FakeItem> }) => {
      const item = items.find(i => i.id === where.id);
      if (item) Object.assign(item, data);
      return item ?? {};
    },
  );
  const auditCreate = vi.fn(async () => ({}));
  const client = {
    paymentRun: { findFirst: vi.fn(async () => ({ runNumber: 'RUN-001' })) },
    paymentRunItem: { findMany, update },
    member: { findMany: vi.fn(async () => []) },
    invoice: {
      updateMany: vi.fn(async () => ({ count: 1 })),
      findUnique: vi.fn(async () => ({ amountToPayMinor: 50_000_00 })),
      update: vi.fn(async () => ({})),
    },
    invoicePayment: {
      deleteMany: vi.fn(async () => ({ count: 0 })),
      aggregate: vi.fn(async () => ({ _sum: { amountMinor: 0 } })),
    },
    auditLog: { create: auditCreate },
    outboxEvent: { create: vi.fn(async () => ({})) },
  };
  const db = {
    ...client,
    $transaction: async (fn: (tx: typeof client) => Promise<unknown>) => fn(client),
  } as never;
  return { db, findMany, update, auditCreate };
}

describe('applyAchReturns — failure transition', () => {
  it('flips a matched live item to FAILED with a reason and one masked audit row', async () => {
    const items = [makeItem({ status: 'EXPORTED' })];
    const { db, update, auditCreate } = makeDb(items);

    const result = await applyAchReturns(db, {
      organizationId: ORG_ID,
      paymentRunId: RUN_ID,
      actorId: ACTOR_ID,
      entries: [makeEntry({ returnCode: 'R01' })],
    });

    expect(result).toEqual({ failed: 1, advisory: 0, skipped: 0, unmatched: 0 });

    expect(update).toHaveBeenCalledTimes(1);
    const upd = update.mock.calls[0]?.[0] as { data: { status: string; failureReason: string } };
    expect(upd.data.status).toBe('FAILED');
    expect(upd.data.failureReason).toContain('R01');
    expect(upd.data.failureReason.toLowerCase()).toContain('insufficient');

    expect(auditCreate).toHaveBeenCalledTimes(1);
    const row = auditCreate.mock.calls[0]?.[0] as {
      data: { action: string; metadataJson: unknown };
    };
    expect(row.data.action).toBe('payment_run.ach_return_applied');
    const serialized = JSON.stringify(row.data.metadataJson);
    expect(serialized).toContain('R01');
    expect(serialized).not.toContain('routingNumber');
    expect(serialized).not.toContain('accountNumber');
  });
});

describe('applyAchReturns — advisory (NOC/COR never fails a payout)', () => {
  it('records a COR/NOC entry as advisory without changing status', async () => {
    const items = [
      makeItem({
        status: 'PAID',
        invoice: {
          id: 'inv-2',
          invoiceNumber: 'INV-US-002',
          currency: 'USD',
          paymentStatus: 'PAID',
        },
      }),
    ];
    const { db, update, auditCreate } = makeDb(items);

    const result = await applyAchReturns(db, {
      organizationId: ORG_ID,
      paymentRunId: RUN_ID,
      actorId: ACTOR_ID,
      entries: [makeEntry({ individualId: 'INV-US-002', returnCode: 'C01' })],
    });

    expect(result).toEqual({ failed: 0, advisory: 1, skipped: 0, unmatched: 0 });
    expect(update).not.toHaveBeenCalled();
    expect(items[0]?.status).toBe('PAID');

    expect(auditCreate).toHaveBeenCalledTimes(1);
    const row = auditCreate.mock.calls[0]?.[0] as { data: { action: string } };
    expect(row.data.action).toBe('payment_run.ach_correction_advised');
  });
});

describe('applyAchReturns — idempotency (re-delivered file is a no-op)', () => {
  it('skips an already-FAILED item on a second identical apply (no re-update, no duplicate audit)', async () => {
    const items = [makeItem({ status: 'EXPORTED' })];
    const { db, update, auditCreate } = makeDb(items);
    const args = {
      organizationId: ORG_ID,
      paymentRunId: RUN_ID,
      actorId: ACTOR_ID,
      entries: [makeEntry({ returnCode: 'R01' })],
    };

    const first = await applyAchReturns(db, args);
    expect(first).toEqual({ failed: 1, advisory: 0, skipped: 0, unmatched: 0 });

    const second = await applyAchReturns(db, args);
    expect(second).toEqual({ failed: 0, advisory: 0, skipped: 1, unmatched: 0 });

    expect(update).toHaveBeenCalledTimes(1);
    expect(auditCreate).toHaveBeenCalledTimes(1);
  });
});

describe('applyAchReturns — unmatched signal (operator safety)', () => {
  it('counts a FAILED-disposition entry with no matching item as unmatched, not skipped', async () => {
    const items = [makeItem({ status: 'EXPORTED', invoice: { invoiceNumber: 'INV-US-001' } })];
    const { db, update, auditCreate } = makeDb(items);

    const result = await applyAchReturns(db, {
      organizationId: ORG_ID,
      paymentRunId: RUN_ID,
      actorId: ACTOR_ID,
      entries: [makeEntry({ individualId: 'INV-WRONG-999', returnCode: 'R01' })],
    });

    expect(result).toEqual({ failed: 0, advisory: 0, skipped: 0, unmatched: 1 });
    expect(update).not.toHaveBeenCalled();
    expect(auditCreate).not.toHaveBeenCalled();
  });
});

describe('applyAchReturns — tenant isolation', () => {
  it('never touches a foreign-org item; its entry surfaces as unmatched', async () => {
    const items = [
      makeItem({
        id: 'item-foreign',
        organizationId: OTHER_ORG_ID,
        status: 'EXPORTED',
        invoice: { invoiceNumber: 'INV-US-001' },
      }),
    ];
    const { db, findMany, update, auditCreate } = makeDb(items);

    const result = await applyAchReturns(db, {
      organizationId: ORG_ID,
      paymentRunId: RUN_ID,
      actorId: ACTOR_ID,
      entries: [makeEntry({ individualId: 'INV-US-001', returnCode: 'R01' })],
    });

    expect(result).toEqual({ failed: 0, advisory: 0, skipped: 0, unmatched: 1 });
    expect(update).not.toHaveBeenCalled();
    expect(auditCreate).not.toHaveBeenCalled();
    expect(items[0]?.status).toBe('EXPORTED');

    const call = findMany.mock.calls[0]?.[0] as {
      where: { paymentRunId: string; organizationId: string };
    };
    expect(call.where).toEqual({ paymentRunId: RUN_ID, organizationId: ORG_ID });
    expect(call.where.organizationId).not.toBe(OTHER_ORG_ID);
  });
});
