import { describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock exceljs — the package is not installed in this workspace;
// the source dynamically imports it at runtime.
// We build a minimal Workbook stub that simulates ExcelJS CSV/XLSX parsing.
// ---------------------------------------------------------------------------

function makeCell(value: unknown) {
  return { value };
}

function makeRow(cells: unknown[]) {
  return {
    cellCount: cells.length,
    getCell: (col: number) => makeCell(cells[col - 1] ?? null),
  };
}

interface SheetStub {
  getRow: (r: number) => ReturnType<typeof makeRow>;
  rowCount: number;
  columnCount: number;
}

interface WorkbookSetup {
  worksheets: SheetStub[];
}

function buildSetup(headerCells: unknown[], dataRows: unknown[][]): WorkbookSetup {
  const allRows = [headerCells, ...dataRows];
  return {
    worksheets: [
      {
        getRow: (r: number) => makeRow(allRows[r - 1] ?? []),
        rowCount: allRows.length,
        columnCount: headerCells.length,
      },
    ],
  };
}

let pendingSetup: WorkbookSetup | null = null;

vi.mock('exceljs', () => {
  class Workbook {
    worksheets: SheetStub[] = [];

    csv: { read: ReturnType<typeof vi.fn> };
    xlsx: { load: ReturnType<typeof vi.fn> };

    constructor() {
      this.csv = {
        read: vi.fn(async () => {
          if (pendingSetup) {
            this.worksheets = pendingSetup.worksheets;
            pendingSetup = null;
          }
        }),
      };
      this.xlsx = {
        load: vi.fn(async () => {
          if (pendingSetup) {
            this.worksheets = pendingSetup.worksheets;
            pendingSetup = null;
          }
        }),
      };
    }
  }

  return {
    default: { Workbook },
  };
});

// Must import AFTER the mock is registered
const { parseSpreadsheetBuffer } = await import('../excel-parse');

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function prepareWorkbook(headerCells: unknown[], dataRows: unknown[][]) {
  pendingSetup = buildSetup(headerCells, dataRows);
}

// ---------------------------------------------------------------------------
// parseSpreadsheetBuffer
// ---------------------------------------------------------------------------

describe('parseSpreadsheetBuffer', () => {
  it('parses rows into objects keyed by header values', async () => {
    prepareWorkbook(
      ['Name', 'Email'],
      [
        ['Alice', 'alice@example.com'],
        ['Bob', 'bob@example.com'],
      ],
    );

    const rows = await parseSpreadsheetBuffer(Buffer.from('ignored'));

    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ Name: 'Alice', Email: 'alice@example.com' });
    expect(rows[1]).toEqual({ Name: 'Bob', Email: 'bob@example.com' });
  });

  it('uses header row as object keys', async () => {
    prepareWorkbook(['First', 'Last'], [['John', 'Doe']]);

    const rows = await parseSpreadsheetBuffer(Buffer.from('ignored'));

    expect(Object.keys(rows[0] ?? {})).toEqual(['First', 'Last']);
  });

  it('skips rows where all cells are empty strings', async () => {
    prepareWorkbook(
      ['Name', 'Email'],
      [
        ['Alice', 'alice@example.com'],
        ['', ''],
        ['Bob', 'bob@example.com'],
      ],
    );

    const rows = await parseSpreadsheetBuffer(Buffer.from('ignored'));

    expect(rows).toHaveLength(2);
    expect(rows[0]?.Name).toBe('Alice');
    expect(rows[1]?.Name).toBe('Bob');
  });

  it('converts null/undefined cells to empty strings', async () => {
    prepareWorkbook(['Name', 'Email'], [['Alice', null]]);

    const rows = await parseSpreadsheetBuffer(Buffer.from('ignored'));

    expect(rows).toHaveLength(1);
    expect(rows[0]?.Email).toBe('');
  });

  it('converts Date cells to ISO date strings (YYYY-MM-DD)', async () => {
    const date = new Date('2025-06-15T10:30:00Z');
    prepareWorkbook(['Name', 'JoinDate'], [['Alice', date]]);

    const rows = await parseSpreadsheetBuffer(Buffer.from('ignored'));

    expect(rows[0]?.JoinDate).toBe('2025-06-15');
  });

  it('handles richText cells by joining text parts', async () => {
    const richText = { richText: [{ text: 'Hello ' }, { text: 'World' }] };
    prepareWorkbook(['Note'], [[richText]]);

    const rows = await parseSpreadsheetBuffer(Buffer.from('ignored'));

    expect(rows[0]?.Note).toBe('Hello World');
  });

  it('handles formula cells with a result property', async () => {
    const formula = { result: 42 };
    prepareWorkbook(['Total'], [[formula]]);

    const rows = await parseSpreadsheetBuffer(Buffer.from('ignored'));

    expect(rows[0]?.Total).toBe('42');
  });

  it('handles formula cells with a Date result', async () => {
    const formula = { result: new Date('2024-01-01T00:00:00Z') };
    prepareWorkbook(['Date'], [[formula]]);

    const rows = await parseSpreadsheetBuffer(Buffer.from('ignored'));

    expect(rows[0]?.Date).toBe('2024-01-01');
  });

  it('handles formula cells with null result', async () => {
    const formula = { result: null };
    prepareWorkbook(['Name', 'Val'], [['Keep', formula]]);

    const rows = await parseSpreadsheetBuffer(Buffer.from('ignored'));

    expect(rows[0]?.Val).toBe('');
  });

  it('returns empty array when there are no data rows', async () => {
    prepareWorkbook(['Header'], []);

    const rows = await parseSpreadsheetBuffer(Buffer.from('ignored'));

    expect(rows).toEqual([]);
  });

  it('detects XLSX by ZIP magic bytes and uses xlsx.load', async () => {
    prepareWorkbook(['Col'], [['val']]);

    // ZIP magic bytes: 0x50 0x4B
    const xlsxBuffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, ...Buffer.from('rest')]);
    const rows = await parseSpreadsheetBuffer(xlsxBuffer);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.Col).toBe('val');
  });

  it('throws when file contains no sheets', async () => {
    pendingSetup = { worksheets: [] };

    await expect(parseSpreadsheetBuffer(Buffer.from('data'))).rejects.toThrow(
      'File contains no sheets',
    );
  });

  it('rejects an oversized buffer before unzipping the workbook', async () => {
    // The mocked Workbook.load/read consume `pendingSetup`; if the byte cap
    // fires first, the workbook is never materialized and the setup is left
    // untouched.
    prepareWorkbook(['Col'], [['val']]);

    // 10 MiB + 1 byte, ZIP magic so it routes to the xlsx path.
    const oversized = Buffer.alloc(10 * 1024 * 1024 + 1, 0);
    oversized[0] = 0x50;
    oversized[1] = 0x4b;

    await expect(parseSpreadsheetBuffer(oversized)).rejects.toThrow('File exceeds maximum size');

    // The cap fired before any workbook materialization (setup not consumed).
    expect(pendingSetup).not.toBeNull();
    pendingSetup = null;
  });

  it('rejects a sheet whose declared rowCount exceeds the row cap without reading every row', async () => {
    const getRow = vi.fn((r: number) => makeRow([`v${r}`]));
    pendingSetup = {
      worksheets: [
        {
          getRow,
          // header + 5001 data rows = 5002 declared rows (cap is 5000 data rows)
          rowCount: 5002,
          columnCount: 1,
        },
      ],
    };

    await expect(parseSpreadsheetBuffer(Buffer.from('data'))).rejects.toThrow(
      'File exceeds maximum of 5000 rows',
    );

    // Only the header row (and the cheap colCount probe) is touched — the
    // per-row materialization loop never runs.
    expect(getRow.mock.calls.length).toBeLessThan(5000);
  });
});
