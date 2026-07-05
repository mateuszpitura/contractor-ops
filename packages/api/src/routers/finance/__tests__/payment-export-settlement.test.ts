// Settlement wiring on the export path + the ACH_NACHA / FEDWIRE dispatch
// branches.
//
// `_buildExportItems` must settle each run item BEFORE the export buffer is
// generated: it resolves the settlement currency (per-run override, else the
// contractor's currency) and converts at the payment-date ECB rate, so the
// emitted ExportItem carries the settled amount/currency — never the raw run
// amount. A missing rate surfaces an error rather than a silently zeroed payout.
//
// `_generateExportFileForFormat` must emit the hand-rolled NACHA buffer for
// ACH_NACHA and the pacs.008 XML for FEDWIRE.

import { describe, expect, it } from 'vitest';
import type { ExportItem, OrgBankInfo } from '../../../services/payment-export';
import { _buildExportItems, _generateExportFileForFormat } from '../payment-shared';

/** Stored EUR->USD rate mirroring the ECB daily feed shape. */
const EUR_USD = 1.0836;

type SettlementUpdate = { settlementRate: unknown; settlementRateDate: unknown };

/**
 * Minimal Prisma-shaped stub exposing `exchangeRate.findFirst` (the single DB
 * call `getRate` inside `convertAmount` makes) plus `paymentRunItem.update`
 * (where a cross-currency settlement persists its FX provenance). An absent rate
 * key models a missing rate (returns null). Captured update payloads are exposed
 * for provenance assertions.
 */
function makeDbStub(rates: Record<string, number>) {
  const updates: Array<{ id: string; data: SettlementUpdate }> = [];
  const db = {
    exchangeRate: {
      findFirst: async ({ where }: { where: { base: string; target: string } }) => {
        const rate = rates[`${where.base}->${where.target}`];
        if (rate === undefined) return null;
        return { rate, date: new Date('2026-04-11'), source: 'ECB' };
      },
    },
    paymentRunItem: {
      update: async ({ where, data }: { where: { id: string }; data: SettlementUpdate }) => {
        updates.push({ id: where.id, data });
        return {};
      },
    },
  } as never;
  return { db, updates };
}

type RunItem = Parameters<typeof _buildExportItems>[1][number];

function makeRunItem(overrides: Partial<RunItem> = {}): RunItem {
  return {
    id: 'item-1',
    amountMinor: 100_000,
    currency: 'PLN',
    invoice: {
      invoiceNumber: 'INV-2026-001',
      dueDate: new Date('2026-04-15'),
      servicePeriodStart: null,
      servicePeriodEnd: null,
    },
    contractor: { legalName: 'Jan Kowalski', taxId: '1234567890', currency: 'PLN' },
    billingProfile: { bankAccountMasked: '****1234', swiftBic: 'BREXPLPW', bankName: 'mBank' },
    ...overrides,
  };
}

const paymentDate = new Date('2026-04-11');

describe('_buildExportItems settlement wiring', () => {
  it('leaves the amount unchanged when the settlement currency equals the run currency', async () => {
    const { db, updates } = makeDbStub({});
    const items = await _buildExportItems(db, [makeRunItem()], '{invoice_number}', { paymentDate });
    expect(items).toHaveLength(1);
    expect(items[0]?.amountMinor).toBe(100_000);
    expect(items[0]?.currency).toBe('PLN');
    // Same-currency settlement: no FX provenance persisted (rate 1, nothing to reconstruct).
    expect(updates).toHaveLength(0);
  });

  it('exports the converted amount when a per-run override differs from the run currency', async () => {
    const { db } = makeDbStub({ 'EUR->USD': EUR_USD });
    const items = await _buildExportItems(
      db,
      [
        makeRunItem({
          amountMinor: 100_000,
          currency: 'EUR',
          contractor: { legalName: 'Jan', taxId: null, currency: 'PLN' },
        }),
      ],
      '{invoice_number}',
      { paymentDate, perRunOverride: 'USD' },
    );
    // Settled in USD at the payment-date rate — NOT the raw 100_000 EUR amount.
    expect(items[0]?.currency).toBe('USD');
    expect(items[0]?.amountMinor).toBe(Math.round(100_000 * EUR_USD));
  });

  it('defaults the settlement currency to the contractor currency and converts', async () => {
    const { db } = makeDbStub({ 'EUR->USD': EUR_USD });
    const items = await _buildExportItems(
      db,
      [
        makeRunItem({
          amountMinor: 100_000,
          currency: 'EUR',
          contractor: { legalName: 'Jan', taxId: null, currency: 'USD' },
        }),
      ],
      '{invoice_number}',
      { paymentDate },
    );
    expect(items[0]?.currency).toBe('USD');
    expect(items[0]?.amountMinor).toBe(Math.round(100_000 * EUR_USD));
  });

  it('persists FX provenance so the settled amount reconstructs from the stored columns', async () => {
    const { db, updates } = makeDbStub({ 'EUR->USD': EUR_USD });
    const items = await _buildExportItems(
      db,
      [
        makeRunItem({
          id: 'item-42',
          amountMinor: 100_000,
          currency: 'EUR',
          contractor: { legalName: 'Jan', taxId: null, currency: 'USD' },
        }),
      ],
      '{invoice_number}',
      { paymentDate },
    );

    expect(updates).toHaveLength(1);
    expect(updates[0]?.id).toBe('item-42');
    const persistedRate = updates[0]?.data.settlementRate as number;
    expect(updates[0]?.data.settlementRateDate).toEqual(paymentDate);
    // A payout audit reconstructs the settled amount from the persisted rate.
    expect(Math.round(100_000 * persistedRate)).toBe(items[0]?.amountMinor);
  });

  it('throws rather than emitting a zeroed amount when the settlement rate is missing', async () => {
    const { db } = makeDbStub({});
    await expect(
      _buildExportItems(db, [makeRunItem({ currency: 'EUR' })], '{invoice_number}', {
        paymentDate,
        perRunOverride: 'USD',
      }),
    ).rejects.toMatchObject({ code: 'UNPROCESSABLE_CONTENT' });
  });
});

describe('_generateExportFileForFormat US dispatch', () => {
  const orgBank: OrgBankInfo = {
    name: 'ACME CONTRACTOR',
    iban: 'US64SVBKUS6S3300958879',
    bic: 'SVBKUS6S',
    achImmediateDestination: '021000021',
    achImmediateOrigin: '1234567890',
    achCompanyId: '1234567890',
    achOdfiRoutingPrefix: '02100002',
  };

  const exportItems: ExportItem[] = [
    {
      contractorName: 'Jan Kowalski',
      iban: '000123456789',
      amountMinor: 50_000,
      currency: 'USD',
      invoiceNumber: 'INV-2026-001',
      taxId: '123456789',
      bankName: 'Bank of America',
      swiftBic: 'BOFAUS3N',
      dueDate: new Date('2026-04-15'),
      transferTitle: 'Payment for INV-2026-001',
      usRoutingNumber: '021000021',
      usAccountNumber: '000123456789',
    },
  ];

  it('emits a 94-char NACHA buffer (ext txt) for ACH_NACHA', async () => {
    const result = await _generateExportFileForFormat(
      'ACH_NACHA',
      exportItems,
      orgBank,
      'PR-2026-1',
    );
    expect(result.ext).toBe('txt');
    const firstLine = result.fileBuffer.toString('ascii').split('\r\n')[0];
    expect(firstLine?.[0]).toBe('1');
    expect(firstLine?.length).toBe(94);
  });

  it('emits a pacs.008 XML buffer (ext xml) for FEDWIRE', async () => {
    const result = await _generateExportFileForFormat('FEDWIRE', exportItems, orgBank, 'PR-2026-1');
    expect(result.ext).toBe('xml');
    expect(result.fileBuffer.toString('utf-8')).toContain('pacs.008');
  });
});
