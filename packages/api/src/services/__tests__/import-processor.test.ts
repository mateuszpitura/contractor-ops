import ExcelJS from 'exceljs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as E from '../../errors';
import {
  autoMapColumns,
  normalizeHeader,
  processImportFile,
  validateContractorRow,
  validateContractRow,
} from '../import-processor';

const { mockContractorFindMany } = vi.hoisted(() => ({
  mockContractorFindMany: vi.fn(),
}));

vi.mock('@contractor-ops/db', () => {
  const MockDbPrisma = {
    contractor: {
      findMany: mockContractorFindMany,
    },
  };
  return {
    withRlsTransactions: <T>(c: T) => c,
    withRlsReads: <T>(c: T) => c,
    prisma: MockDbPrisma,
    prismaRaw: MockDbPrisma,
  };
});

describe('normalizeHeader', () => {
  it('lowercases and strips punctuation', () => {
    expect(normalizeHeader('Legal Name!')).toBe('legalname');
    expect(normalizeHeader('NIP / Tax')).toBe('niptax');
  });
});

describe('autoMapColumns', () => {
  it('maps contractor headers by alias', () => {
    const m = autoMapColumns(['Company Name', 'NIP', 'Email', 'Waluta'], 'contractor');
    expect(m.legalName).toBe('Company Name');
    expect(m.taxId).toBe('NIP');
    expect(m.email).toBe('Email');
    expect(m.currency).toBe('Waluta');
  });

  it('maps contract headers', () => {
    const m = autoMapColumns(['tytul', 'rodzaj', 'start', 'koniec', 'nip'], 'contract');
    expect(m.title).toBe('tytul');
    expect(m.contractorTaxId).toBe('nip');
  });
});

describe('validateContractorRow', () => {
  it('rejects missing required fields', () => {
    const r = validateContractorRow({});
    expect(r.valid).toBe(false);
    expect(r.errors.map(e => e.message)).toEqual(
      expect.arrayContaining([
        E.VALIDATION_LEGAL_NAME_REQUIRED,
        E.VALIDATION_TAX_ID_REQUIRED,
        E.VALIDATION_EMAIL_REQUIRED,
      ]),
    );
  });

  it('rejects invalid email format', () => {
    const r = validateContractorRow({
      legalName: 'A',
      taxId: '1',
      email: 'not-an-email',
    });
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.message === E.VALIDATION_EMAIL_INVALID)).toBe(true);
  });

  it('applies defaults and passes for valid row', () => {
    const data: Record<string, unknown> = {
      legalName: 'Acme',
      taxId: '5260250995',
      email: 'a@b.com',
    };
    const r = validateContractorRow(data);
    expect(r.valid).toBe(true);
    expect(data.type).toBe('COMPANY');
    expect(data.countryCode).toBe('PL');
    expect(data.currency).toBe('PLN');
  });
});

describe('validateContractRow', () => {
  it('requires title, type, startDate, contractorTaxId', () => {
    const r = validateContractRow({});
    expect(r.valid).toBe(false);
    expect(r.errors.length).toBeGreaterThanOrEqual(4);
  });

  it('rejects invalid start date', () => {
    const r = validateContractRow({
      title: 'T',
      type: 'NDA',
      startDate: 'not-a-date',
      contractorTaxId: '1',
    });
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.message === E.VALIDATION_DATE_INVALID)).toBe(true);
  });
});

describe('processImportFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContractorFindMany.mockResolvedValue([]);
  });

  async function buildXlsxBuffer(headers: string[], row: string[]) {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Sheet1');
    ws.addRow(headers);
    ws.addRow(row);
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  it('returns one valid contractor row when mapping matches sheet', async () => {
    const buf = await buildXlsxBuffer(
      ['legalName', 'taxId', 'email'],
      ['Test Ltd', '5260250995', 'x@example.com'],
    );
    const columnMapping = autoMapColumns(['legalName', 'taxId', 'email'], 'contractor');
    const result = await processImportFile(buf, 'contractor', 'org_1', columnMapping);
    expect(result.totalRows).toBe(1);
    expect(result.validRows).toHaveLength(1);
    expect(result.invalidRows).toHaveLength(0);
    expect(mockContractorFindMany).toHaveBeenCalled();
  });

  it('flags duplicate contractor by taxId', async () => {
    mockContractorFindMany.mockResolvedValue([{ id: 'c-existing', taxId: '5260250995' }]);
    const buf = await buildXlsxBuffer(
      ['legalName', 'taxId', 'email'],
      ['Test Ltd', '5260250995', 'x@example.com'],
    );
    const columnMapping = autoMapColumns(['legalName', 'taxId', 'email'], 'contractor');
    const result = await processImportFile(buf, 'contractor', 'org_1', columnMapping);
    expect(result.duplicateRows).toHaveLength(1);
    expect(result.duplicateRows[0]?.duplicateOf).toBe('c-existing');
    expect(result.validRows).toHaveLength(0);
  });

  it('rejects a sheet exceeding the row cap before processing any row', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Sheet1');
    ws.addRow(['legalName', 'taxId', 'email']);
    // 5001 data rows > MAX_IMPORT_ROWS (5000) — must reject at the parse cap.
    for (let i = 0; i < 5001; i++) {
      ws.addRow([`Co ${i}`, '5260250995', `u${i}@example.com`]);
    }
    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    const columnMapping = autoMapColumns(['legalName', 'taxId', 'email'], 'contractor');

    await expect(processImportFile(buf, 'contractor', 'org_1', columnMapping)).rejects.toThrow(
      'File exceeds maximum of 5000 rows',
    );

    // The parse cap fired before any duplicate-detection DB work.
    expect(mockContractorFindMany).not.toHaveBeenCalled();
  });
});
