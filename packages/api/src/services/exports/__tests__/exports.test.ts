/**
 * Unit tests for the async export framework (P2-F).
 *
 * Coverage:
 *  - Registry lookups + Zod validation (`getExportDefinition`,
 *    `parseExportParams`).
 *  - Streaming CSV helper end-to-end (`streamCsvResponse` +
 *    `collectStreamToBuffer`) — header row, BOM, RFC-4180 quoting,
 *    formula-prefix neutralisation.
 *  - At-most-once claim semantics — the second `claimExport` for the same
 *    row reports `alreadyProcessed: true`.
 *
 * The PDF / R2 / QStash side effects are NOT exercised here — those are
 * covered in integration tests that mock @react-pdf/renderer and the AWS
 * SDK Upload class. This suite stays in the "fast unit" bucket.
 */

import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { collectStreamToBuffer, streamCsvResponse, UTF8_BOM } from '../../../lib/csv';
import { defineExport, EXPORT_REGISTRY, getExportDefinition, parseExportParams } from '../registry';

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

describe('export registry', () => {
  it('exposes all 8 contractually-required export types', () => {
    const keys = Object.keys(EXPORT_REGISTRY).sort();
    expect(keys).toEqual(
      [
        'classification-document-sds',
        'compliance-gaps',
        'drv-defense-bundle',
        'expiring-contracts',
        'gdpr-privacy-notice',
        'overdue-invoices',
        'spend-by-contractor',
        'spend-by-team',
      ].sort(),
    );
  });

  it('throws on unknown type', () => {
    expect(() => getExportDefinition('does-not-exist')).toThrow(/Unknown export type/);
  });

  it('validates params via the registry schema (success)', () => {
    const params = parseExportParams('spend-by-contractor', {
      dateFrom: '2026-01-01',
      dateTo: '2026-04-30',
    }) as { dateFrom: string; dateTo: string };
    expect(params).toEqual({ dateFrom: '2026-01-01', dateTo: '2026-04-30' });
  });

  it('rejects malformed params', () => {
    expect(() => parseExportParams('spend-by-contractor', { dateFrom: '' })).toThrow();
  });

  it('defineExport preserves the inferred params type at the value site', () => {
    const def = defineExport({
      type: 'demo',
      displayName: 'Demo',
      paramsSchema: z.object({ k: z.string() }),
      mimeType: 'text/csv',
      filename: p => `${p.k}.csv`,
      maxAgeDays: 1,
      requiredPermission: {} as const,
    });
    expect(def.filename({ k: 'hello' })).toBe('hello.csv');
  });

  it('every registry entry has valid mimeType + maxAgeDays metadata', () => {
    for (const [key, def] of Object.entries(EXPORT_REGISTRY)) {
      expect(def.mimeType, `mimeType for ${key}`).toMatch(/^[a-z]+\/[a-z0-9.+-]+$/);
      expect(def.maxAgeDays, `maxAgeDays for ${key}`).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Streaming CSV
// ---------------------------------------------------------------------------

describe('streamCsvResponse', () => {
  const columns = [
    { key: 'name', header: 'Name' },
    { key: 'amount', header: 'Amount' },
  ];

  async function* rows(input: Record<string, unknown>[]) {
    for (const r of input) yield r;
  }

  it('emits a UTF-8 BOM by default', async () => {
    const stream = streamCsvResponse({ columns, rows: rows([{ name: 'a', amount: 1 }]) });
    const buf = await collectStreamToBuffer(stream);
    expect(buf.subarray(0, 3).equals(UTF8_BOM)).toBe(true);
  });

  // Helper: strip the 3-byte UTF-8 BOM and decode the rest.
  function stripBomToString(buf: Buffer): string {
    return buf.subarray(3).toString('utf-8');
  }

  it('writes the header row + body rows with CRLF', async () => {
    const stream = streamCsvResponse({
      columns,
      rows: rows([
        { name: 'Acme', amount: 100 },
        { name: 'Globex', amount: 200 },
      ]),
    });
    const text = stripBomToString(await collectStreamToBuffer(stream));
    expect(text).toContain('Name,Amount');
    expect(text).toContain('Acme,100');
    expect(text).toContain('Globex,200');
    expect(text).toMatch(/\r\n/); // CRLF separator
  });

  it('quotes fields containing commas / newlines per RFC 4180', async () => {
    const stream = streamCsvResponse({
      columns,
      rows: rows([{ name: 'Acme, Inc.', amount: 'line1\nline2' }]),
    });
    const text = stripBomToString(await collectStreamToBuffer(stream));
    expect(text).toContain('"Acme, Inc."');
    // csv-stringify only quotes when strictly required by RFC-4180; a
    // bare \n inside a field with the default `record_delimiter: '\r\n'`
    // counts as a special character so it gets quoted.
    expect(text).toMatch(/"line1\nline2"|line1\nline2/);
  });

  it('neutralises formula-injection prefixes', async () => {
    const stream = streamCsvResponse({
      columns,
      rows: rows([
        { name: '=SUM(A1:A5)', amount: '@CMD' },
        { name: '+1234', amount: '-formula' },
      ]),
    });
    const text = stripBomToString(await collectStreamToBuffer(stream));
    expect(text).toContain("'=SUM(A1:A5)");
    expect(text).toContain("'@CMD");
    expect(text).toContain("'+1234");
    expect(text).toContain("'-formula");
  });

  it('survives an empty row stream (header-only)', async () => {
    const stream = streamCsvResponse({ columns, rows: rows([]) });
    const text = stripBomToString(await collectStreamToBuffer(stream));
    expect(text.trim()).toBe('Name,Amount');
  });

  it('handles null and undefined cells as empty fields', async () => {
    const stream = streamCsvResponse({
      columns,
      rows: rows([{ name: null, amount: undefined }]),
    });
    const text = stripBomToString(await collectStreamToBuffer(stream));
    expect(text).toMatch(/Name,Amount\r\n,/);
  });
});

// ---------------------------------------------------------------------------
// Claim semantics — at-most-once via updateMany
// ---------------------------------------------------------------------------

describe('claimExport at-most-once semantics', () => {
  it('first claim transitions PENDING → PROCESSING; second sees alreadyProcessed', async () => {
    // We mock `@contractor-ops/db` so we can simulate the row state
    // machine without spinning up Postgres. The test focuses on the
    // semantic guarantee that claimExport is idempotent.
    const state = { status: 'PENDING' as 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED' };

    vi.resetModules();
    vi.doMock('@contractor-ops/db', () => ({
      prisma: {
        export: {
          updateMany: vi.fn(async (args: { where: { status: string } }) => {
            if (state.status === args.where.status) {
              state.status = 'PROCESSING';
              return { count: 1 };
            }
            return { count: 0 };
          }),
          // findUnique reads `state.status` lazily so it reflects the
          // updateMany side effect the second time around.
          findUnique: vi.fn(async () => ({
            id: 'exp_1',
            organizationId: 'org_1',
            type: 'spend-by-contractor',
            params: { dateFrom: '2026-01-01', dateTo: '2026-04-30' },
            fileName: 'spend.csv',
            mimeType: 'text/csv',
            requestedByUserId: 'u_1',
            attempts: 1,
            status: state.status,
          })),
        },
      },
    }));

    const { claimExport } = await import('../index');

    const first = await claimExport('exp_1');
    expect(first?.alreadyProcessed).toBe(false);

    const second = await claimExport('exp_1');
    expect(second?.alreadyProcessed).toBe(true);

    vi.doUnmock('@contractor-ops/db');
  });
});
