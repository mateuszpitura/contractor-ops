// packages/api/src/services/__tests__/invoice-intake-service.test.ts
//
// Orchestration tests for the invoice intake service. The real parser +
// KoSIT validator are exercised in the einvoice package's own test suite;
// here we inject lightweight mocks via the
// service's `IntakeServiceDeps` surface so we test the orchestration logic
// (gates, dedup, state machine, idempotency) in isolation.

import { createHash } from 'node:crypto';
import type { ParsedZugferd, XRechnungValidationReport } from '@contractor-ops/einvoice';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IntakeServiceDeps } from '../invoice-intake-service';
import {
  acknowledgeValidation,
  confirmMatch,
  convertToInvoice,
  INTAKE_MAX_FILE_BYTES,
  reject,
  uploadAndPersist,
} from '../invoice-intake-service';
import {
  buildHappyPathPdfBase64,
  buildMinimalInvoice,
  buildXmlBase64,
  buildXmlFixture,
  FIXTURE_INVOICE_NUMBER,
  FIXTURE_SUPPLIER_NAME,
  FIXTURE_SUPPLIER_VAT,
  padBase64BufferTo,
} from './fixtures/intake-fixtures';

// ---------------------------------------------------------------------------
// In-memory Prisma surface
// ---------------------------------------------------------------------------

interface IntakeRow {
  id: string;
  organizationId: string;
  uploadedByUserId: string;
  sourceKind: 'UPLOAD_PDF' | 'UPLOAD_XML';
  rawFileKey: string;
  rawFileSha256: string;
  rawFileMime: string;
  rawFileSizeBytes: number;
  extractedXmlKey: string | null;
  validationReportKey: string | null;
  profileLevel: 'COMFORT' | 'XRECHNUNG' | 'EXTENDED';
  parsedInvoiceJson: unknown;
  extractedSupplierName: string | null;
  extractedSupplierVatId: string | null;
  extractedSupplierLeitwegId: string | null;
  extractedInvoiceNumber: string | null;
  extractedInvoiceDate: Date | null;
  extractedTotalMinor: bigint | null;
  extractedCurrency: string | null;
  matchedContractorId: string | null;
  matchedContractId: string | null;
  convertedInvoiceId: string | null;
  status: 'PARSED' | 'NEEDS_REVIEW' | 'MATCHED' | 'CONVERTED' | 'REJECTED';
  validationStatus: 'VALID' | 'WARNINGS' | 'INVALID';
  validationAcknowledgedAt: Date | null;
  validationAcknowledgedByUserId: string | null;
  rejectionReason: string | null;
  unmappedFieldsJson: unknown;
}

interface InvoiceRow {
  id: string;
  organizationId: string;
  contractorId: string | null;
  contractId: string | null;
  invoiceNumber: string;
  source: string;
  issueDate: Date;
  dueDate: Date;
  currency: string;
  subtotalMinor: number;
  totalMinor: number;
  amountToPayMinor: number;
  vatAmountMinor: number | null;
  sellerTaxId: string | null;
  sellerName: string | null;
  buyerTaxId: string | null;
  duplicateCheckHash: string | null;
  lines: Array<{
    lineNumber: number;
    description: string;
    netAmountMinor: number | null;
  }>;
}

function makeDb(seed: { intakes?: IntakeRow[] } = {}) {
  const intakes: IntakeRow[] = seed.intakes ? [...seed.intakes] : [];
  const invoices: InvoiceRow[] = [];
  let intakeCounter = intakes.length;
  let invoiceCounter = 0;

  const invoiceIntakeRequest = {
    findUnique: vi.fn(
      async (args: {
        where: {
          id?: string;
          organizationId_rawFileSha256?: {
            organizationId: string;
            rawFileSha256: string;
          };
        };
      }) => {
        if (args.where.id) {
          return intakes.find(r => r.id === args.where.id) ?? null;
        }
        if (args.where.organizationId_rawFileSha256) {
          const { organizationId, rawFileSha256 } = args.where.organizationId_rawFileSha256;
          return (
            intakes.find(
              r => r.organizationId === organizationId && r.rawFileSha256 === rawFileSha256,
            ) ?? null
          );
        }
        return null;
      },
    ),
    create: vi.fn(async (args: { data: Partial<IntakeRow> & { organizationId: string } }) => {
      // Simulate the unique constraint on (organizationId, rawFileSha256).
      if (args.data.rawFileSha256) {
        const clash = intakes.find(
          r =>
            r.organizationId === args.data.organizationId &&
            r.rawFileSha256 === args.data.rawFileSha256,
        );
        if (clash) {
          const err: Error & { code?: string } = new Error(
            'Unique constraint failed on (organizationId,rawFileSha256)',
          );
          err.code = 'P2002';
          throw err;
        }
      }
      intakeCounter += 1;
      const created: IntakeRow = {
        id: `intake_${intakeCounter}`,
        organizationId: args.data.organizationId,
        uploadedByUserId: args.data.uploadedByUserId ?? '',
        sourceKind: args.data.sourceKind ?? 'UPLOAD_PDF',
        rawFileKey: args.data.rawFileKey ?? '',
        rawFileSha256: args.data.rawFileSha256 ?? '',
        rawFileMime: args.data.rawFileMime ?? '',
        rawFileSizeBytes: args.data.rawFileSizeBytes ?? 0,
        extractedXmlKey: args.data.extractedXmlKey ?? null,
        validationReportKey: args.data.validationReportKey ?? null,
        profileLevel: args.data.profileLevel ?? 'XRECHNUNG',
        parsedInvoiceJson: args.data.parsedInvoiceJson ?? null,
        extractedSupplierName: args.data.extractedSupplierName ?? null,
        extractedSupplierVatId: args.data.extractedSupplierVatId ?? null,
        extractedSupplierLeitwegId: args.data.extractedSupplierLeitwegId ?? null,
        extractedInvoiceNumber: args.data.extractedInvoiceNumber ?? null,
        extractedInvoiceDate: args.data.extractedInvoiceDate ?? null,
        extractedTotalMinor: args.data.extractedTotalMinor ?? null,
        extractedCurrency: args.data.extractedCurrency ?? null,
        matchedContractorId: null,
        matchedContractId: null,
        convertedInvoiceId: null,
        status: args.data.status ?? 'PARSED',
        validationStatus: args.data.validationStatus ?? 'VALID',
        validationAcknowledgedAt: null,
        validationAcknowledgedByUserId: null,
        rejectionReason: null,
        unmappedFieldsJson: args.data.unmappedFieldsJson ?? null,
      };
      intakes.push(created);
      return created;
    }),
    update: vi.fn(async (args: { where: { id: string }; data: Partial<IntakeRow> }) => {
      const row = intakes.find(r => r.id === args.where.id);
      if (!row) throw new Error(`intake ${args.where.id} not found`);
      Object.assign(row, args.data);
      return row;
    }),
    count: vi.fn(async () => intakes.length),
  };

  const invoice = {
    create: vi.fn(
      async (args: {
        data: Partial<InvoiceRow> & {
          organizationId: string;
          invoiceNumber: string;
          lines?: {
            create: Array<{
              lineNumber: number;
              description: string;
              netAmountMinor?: number | null;
            }>;
          };
        };
      }) => {
        invoiceCounter += 1;
        const created: InvoiceRow = {
          id: `inv_${invoiceCounter}`,
          organizationId: args.data.organizationId,
          contractorId: args.data.contractorId ?? null,
          contractId: args.data.contractId ?? null,
          invoiceNumber: args.data.invoiceNumber,
          source: (args.data.source as string) ?? 'PEPPOL',
          issueDate: args.data.issueDate ?? new Date(),
          dueDate: args.data.dueDate ?? new Date(),
          currency: (args.data.currency as string) ?? 'EUR',
          subtotalMinor: args.data.subtotalMinor ?? 0,
          totalMinor: args.data.totalMinor ?? 0,
          amountToPayMinor: args.data.amountToPayMinor ?? 0,
          vatAmountMinor: args.data.vatAmountMinor ?? null,
          sellerTaxId: args.data.sellerTaxId ?? null,
          sellerName: args.data.sellerName ?? null,
          buyerTaxId: args.data.buyerTaxId ?? null,
          duplicateCheckHash: args.data.duplicateCheckHash ?? null,
          lines: (args.data.lines?.create ?? []).map(l => ({
            lineNumber: l.lineNumber,
            description: l.description,
            netAmountMinor: l.netAmountMinor ?? null,
          })),
        };
        invoices.push(created);
        return created;
      },
    ),
  };

  // Cross-tenant FK guards added to confirmMatch / convertToInvoice re-query
  // contractor + contract by id AND organizationId. Defense-in-depth: Prisma's
  // tenant extension does not re-scope `include`'d relations, so a malicious
  // contractorId from another org could otherwise be persisted on the intake.
  // In the test harness both models always resolve positively; individual
  // tests can override with mockImplementationOnce when they want to assert
  // the guard fires.
  const contractor = {
    findFirst: vi.fn(async (args: { where: { id: string; organizationId: string } }) => ({
      id: args.where.id,
    })),
  };

  const contract = {
    findFirst: vi.fn(async (args: { where: { id: string; organizationId: string } }) => ({
      id: args.where.id,
    })),
  };

  async function $transaction<T>(fn: (tx: typeof client) => Promise<T>): Promise<T> {
    return fn(client);
  }

  const client = {
    invoiceIntakeRequest,
    invoice,
    contractor,
    contract,
    $transaction,
    __rows: { intakes, invoices },
  } as const;

  return client;
}

// ---------------------------------------------------------------------------
// Mock deps (parse / validate / R2)
// ---------------------------------------------------------------------------

function makeValidReport(): XRechnungValidationReport {
  return {
    status: 'VALID',
    ruleSetVersion: 'XRechnung-3.0.2-test',
    layers: [
      { layer: 'XSD', status: 'PASS', errors: [], warnings: [], infos: [] },
      { layer: 'EN16931-SCH', status: 'PASS', errors: [], warnings: [], infos: [] },
      { layer: 'XRECHNUNG-SCH', status: 'PASS', errors: [], warnings: [], infos: [] },
    ],
  };
}

function makeXsdFailReport(): XRechnungValidationReport {
  return {
    status: 'INVALID',
    ruleSetVersion: 'XRechnung-3.0.2-test',
    layers: [
      {
        layer: 'XSD',
        status: 'FAIL',
        errors: [
          {
            ruleId: 'XSD',
            xpath: '',
            severity: 'fatal',
            message: 'Element rsm:CrossIndustryInvoice is missing',
          },
        ],
        warnings: [],
        infos: [],
      },
      { layer: 'EN16931-SCH', status: 'SKIPPED', errors: [], warnings: [], infos: [] },
      { layer: 'XRECHNUNG-SCH', status: 'SKIPPED', errors: [], warnings: [], infos: [] },
    ],
  };
}

function makeWarningsReport(): XRechnungValidationReport {
  return {
    status: 'WARNINGS',
    ruleSetVersion: 'XRechnung-3.0.2-test',
    layers: [
      { layer: 'XSD', status: 'PASS', errors: [], warnings: [], infos: [] },
      {
        layer: 'EN16931-SCH',
        status: 'PASS',
        errors: [],
        warnings: [
          {
            ruleId: 'BR-DE-17',
            xpath: '/rsm:CrossIndustryInvoice',
            severity: 'warning',
            message: 'Currency is non-EUR for DE public-sector buyer',
          },
        ],
        infos: [],
      },
      { layer: 'XRECHNUNG-SCH', status: 'PASS', errors: [], warnings: [], infos: [] },
    ],
  };
}

function makeMockParsedZugferd(): ParsedZugferd {
  return {
    invoice: buildMinimalInvoice(),
    profileLevel: 'XRECHNUNG',
    warnings: [],
    unmappedFields: [],
    rawPdfBuffer: new Uint8Array([0]),
    extractedXml: buildXmlFixture(),
  };
}

function makeR2Mock() {
  const puts: Array<{ key: string; contentType: string; bodyLength: number }> = [];
  return {
    puts,
    putObjectString: vi.fn(async (p: { key: string; body: string; contentType: string }) => {
      puts.push({
        key: p.key,
        contentType: p.contentType,
        bodyLength: Buffer.byteLength(p.body, 'utf8'),
      });
    }),
    putObjectAndSignDownload: vi.fn(
      async (p: { key: string; body: Uint8Array | Buffer; contentType: string }) => {
        puts.push({
          key: p.key,
          contentType: p.contentType,
          bodyLength: p.body.length,
        });
        return { signedUrl: `https://r2.test.local/${p.key}?sig=mock`, expiresInSeconds: 300 };
      },
    ),
  };
}

function buildHappyDeps(
  overrides: Partial<IntakeServiceDeps> = {},
): IntakeServiceDeps & { r2: ReturnType<typeof makeR2Mock> } {
  const r2 = overrides.r2 ? (overrides.r2 as ReturnType<typeof makeR2Mock>) : makeR2Mock();
  return {
    parseZugferdPdf: vi.fn(async () => makeMockParsedZugferd()),
    parseXrechnungCii: vi.fn(() => ({
      invoice: buildMinimalInvoice(),
      profileLevel: 'XRECHNUNG' as const,
      warnings: [],
      unmappedFields: [],
    })),
    validateEmbeddedXml: vi.fn(async () => makeValidReport()),
    r2,
    now: () => new Date('2026-04-14T00:00:00Z'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ORG_A = 'org_A';
const ORG_B = 'org_B';
const USER_1 = 'user_1';

let HappyPdfBase64: string;
let HappyXmlBase64: string;

beforeEach(async () => {
  HappyPdfBase64 = await buildHappyPathPdfBase64();
  HappyXmlBase64 = buildXmlBase64();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('uploadAndPersist', () => {
  it('1. happy-path PDF upload → PARSED + VALID + R2 uploads + supplier metadata recorded', async () => {
    const db = makeDb();
    const deps = buildHappyDeps();

    const result = await uploadAndPersist(
      db as never,
      {
        orgId: ORG_A,
        userId: USER_1,
        fileKind: 'pdf',
        fileBase64: HappyPdfBase64,
        mime: 'application/pdf',
        originalFilename: 'invoice.pdf',
      },
      deps,
    );

    expect(result.kind).toBe('CREATED');
    if (result.kind !== 'CREATED') throw new Error('expected CREATED');
    expect(result.validationStatus).toBe('VALID');
    expect(result.profileLevel).toBe('XRECHNUNG');

    // intake row exists with expected metadata
    expect(db.__rows.intakes).toHaveLength(1);
    const row = db.__rows.intakes[0];
    expect(row?.status).toBe('PARSED');
    expect(row?.validationStatus).toBe('VALID');
    expect(row?.extractedSupplierVatId).toBe(FIXTURE_SUPPLIER_VAT);
    expect(row?.extractedSupplierName).toBe(FIXTURE_SUPPLIER_NAME);
    expect(row?.extractedInvoiceNumber).toBe(FIXTURE_INVOICE_NUMBER);
    expect(row?.extractedCurrency).toBe('EUR');

    // R2: raw PDF + extracted XML + report = 3 objects
    expect(deps.r2.puts.length).toBe(3);
    const keys = deps.r2.puts.map(p => p.key);
    expect(keys.some(k => k.endsWith('.pdf'))).toBe(true);
    expect(keys.some(k => k.endsWith('-extracted.xml'))).toBe(true);
    expect(keys.some(k => k.includes('-report.html'))).toBe(true);
  });

  it('2. uploading the same PDF twice returns DEDUP_RETURNED on the second call with same intakeId', async () => {
    const db = makeDb();
    const deps = buildHappyDeps();

    const first = await uploadAndPersist(
      db as never,
      {
        orgId: ORG_A,
        userId: USER_1,
        fileKind: 'pdf',
        fileBase64: HappyPdfBase64,
        mime: 'application/pdf',
        originalFilename: 'invoice.pdf',
      },
      deps,
    );
    const second = await uploadAndPersist(
      db as never,
      {
        orgId: ORG_A,
        userId: USER_1,
        fileKind: 'pdf',
        fileBase64: HappyPdfBase64,
        mime: 'application/pdf',
        originalFilename: 'invoice.pdf',
      },
      deps,
    );

    expect(first.kind).toBe('CREATED');
    expect(second.kind).toBe('DEDUP_RETURNED');
    if (first.kind !== 'CREATED' || second.kind !== 'DEDUP_RETURNED')
      throw new Error('unexpected kinds');
    expect(second.intakeId).toBe(first.intakeId);
    expect(db.__rows.intakes).toHaveLength(1);
  });

  it('3. XML with XSD failure throws CII_XSD_INVALID and does NOT persist an intake row', async () => {
    const db = makeDb();
    const deps = buildHappyDeps({
      validateEmbeddedXml: vi.fn(async () => makeXsdFailReport()),
    });

    await expect(
      uploadAndPersist(
        db as never,
        {
          orgId: ORG_A,
          userId: USER_1,
          fileKind: 'xml',
          fileBase64: HappyXmlBase64,
          mime: 'application/xml',
          originalFilename: 'invoice.xml',
        },
        deps,
      ),
    ).rejects.toMatchObject({ code: 'CII_XSD_INVALID' });

    expect(db.__rows.intakes).toHaveLength(0);
  });

  it('4. XML with schematron warnings creates the row with NEEDS_REVIEW + WARNINGS', async () => {
    const db = makeDb();
    const deps = buildHappyDeps({
      validateEmbeddedXml: vi.fn(async () => makeWarningsReport()),
    });

    const result = await uploadAndPersist(
      db as never,
      {
        orgId: ORG_A,
        userId: USER_1,
        fileKind: 'xml',
        fileBase64: HappyXmlBase64,
        mime: 'application/xml',
        originalFilename: 'invoice.xml',
      },
      deps,
    );

    expect(result.kind).toBe('CREATED');
    if (result.kind !== 'CREATED') throw new Error('expected CREATED');
    expect(result.validationStatus).toBe('WARNINGS');
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('BR-DE-17');

    const row = db.__rows.intakes[0];
    expect(row?.status).toBe('NEEDS_REVIEW');
    expect(row?.validationStatus).toBe('WARNINGS');
  });

  it('5. PDF > 5 MB throws FILE_TOO_LARGE and performs zero R2 uploads', async () => {
    const db = makeDb();
    const deps = buildHappyDeps();

    const oversized = padBase64BufferTo(HappyPdfBase64, INTAKE_MAX_FILE_BYTES + 10);

    await expect(
      uploadAndPersist(
        db as never,
        {
          orgId: ORG_A,
          userId: USER_1,
          fileKind: 'pdf',
          fileBase64: oversized,
          mime: 'application/pdf',
          originalFilename: 'big.pdf',
        },
        deps,
      ),
    ).rejects.toMatchObject({ code: 'FILE_TOO_LARGE' });

    expect(deps.r2.puts).toHaveLength(0);
    expect(db.__rows.intakes).toHaveLength(0);
  });

  it('oversized base64 string is rejected before decode (no parse, no R2, no decode work)', async () => {
    const db = makeDb();
    const deps = buildHappyDeps();

    // A base64 string longer than ceil(maxBytes / 3) * 4 decodes to > the cap.
    // Building the string by length avoids ever materializing the big buffer —
    // mirrors what an attacker would send and proves the pre-decode guard.
    const maxBase64Chars = Math.ceil(INTAKE_MAX_FILE_BYTES / 3) * 4;
    const oversized = 'A'.repeat(maxBase64Chars + 4);

    await expect(
      uploadAndPersist(
        db as never,
        {
          orgId: ORG_A,
          userId: USER_1,
          fileKind: 'pdf',
          fileBase64: oversized,
          mime: 'application/pdf',
          originalFilename: 'huge.pdf',
        },
        deps,
      ),
    ).rejects.toMatchObject({ code: 'FILE_TOO_LARGE' });

    // No parsing, no R2 writes, no intake row — rejected at the pre-decode gate.
    expect(deps.parseZugferdPdf).not.toHaveBeenCalled();
    expect(deps.r2.puts).toHaveLength(0);
    expect(db.__rows.intakes).toHaveLength(0);
  });

  it('unsupported MIME throws UNSUPPORTED_MIME before any parse', async () => {
    const db = makeDb();
    const deps = buildHappyDeps();

    await expect(
      uploadAndPersist(
        db as never,
        {
          orgId: ORG_A,
          userId: USER_1,
          fileKind: 'pdf',
          fileBase64: HappyXmlBase64,
          mime: 'image/png',
          originalFilename: 'invoice.png',
        },
        deps,
      ),
    ).rejects.toMatchObject({ code: 'UNSUPPORTED_MIME' });

    expect(deps.parseZugferdPdf).not.toHaveBeenCalled();
  });
});

describe('acknowledgeValidation', () => {
  it('6. acknowledging a VALID intake throws VALIDATION_NOT_REQUIRED', async () => {
    const db = makeDb({
      intakes: [makeSeedIntake({ status: 'NEEDS_REVIEW', validationStatus: 'VALID' })],
    });

    await expect(
      acknowledgeValidation(db as never, {
        orgId: ORG_A,
        intakeId: 'intake_seed',
        userId: USER_1,
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_NOT_REQUIRED' });
  });

  it('sets validationAcknowledgedAt/By when row is WARNINGS', async () => {
    const db = makeDb({
      intakes: [makeSeedIntake({ status: 'NEEDS_REVIEW', validationStatus: 'WARNINGS' })],
    });

    await acknowledgeValidation(db as never, {
      orgId: ORG_A,
      intakeId: 'intake_seed',
      userId: USER_1,
    });
    const row = db.__rows.intakes.find(r => r.id === 'intake_seed');
    expect(row?.validationAcknowledgedAt).toBeInstanceOf(Date);
    expect(row?.validationAcknowledgedByUserId).toBe(USER_1);
  });
});

describe('convertToInvoice', () => {
  it('7. convert from PARSED (not MATCHED) throws INVALID_STATE_TRANSITION', async () => {
    const db = makeDb({
      intakes: [makeSeedIntake({ status: 'PARSED', validationStatus: 'VALID' })],
    });

    await expect(
      convertToInvoice(db as never, {
        orgId: ORG_A,
        intakeId: 'intake_seed',
        userId: USER_1,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_STATE_TRANSITION' });
  });

  it('8. second convertToInvoice call on a CONVERTED row returns the same invoiceId (idempotent)', async () => {
    const db = makeDb({
      intakes: [
        makeSeedIntake({
          status: 'MATCHED',
          validationStatus: 'VALID',
          matchedContractorId: 'c_1',
        }),
      ],
    });

    const first = await convertToInvoice(db as never, {
      orgId: ORG_A,
      intakeId: 'intake_seed',
      userId: USER_1,
    });
    const second = await convertToInvoice(db as never, {
      orgId: ORG_A,
      intakeId: 'intake_seed',
      userId: USER_1,
    });

    expect(first.invoiceId).toBe(second.invoiceId);
    expect(db.__rows.invoices).toHaveLength(1);
  });

  it('maps Prisma P2002 on (org, contractor, invoiceNumber) to DUPLICATE_INVOICE_NUMBER', async () => {
    // Finding #5 — GoBD requires that two intakes carrying the same
    // supplier-issued invoice number do NOT both produce real Invoice
    // rows. The DB unique index is the authoritative guard; this test
    // asserts the service translates the low-level P2002 into the typed
    // error the router maps to CONFLICT.
    const db = makeDb({
      intakes: [
        makeSeedIntake({
          status: 'MATCHED',
          validationStatus: 'VALID',
          matchedContractorId: 'c_1',
        }),
      ],
    });

    db.invoice.create.mockImplementationOnce(async () => {
      const err: Error & { code?: string; meta?: { target?: string[] } } = new Error(
        'Unique constraint failed on (organizationId,contractorId,invoiceNumber)',
      );
      err.code = 'P2002';
      err.meta = { target: ['organizationId', 'contractorId', 'invoiceNumber'] };
      throw err;
    });

    await expect(
      convertToInvoice(db as never, {
        orgId: ORG_A,
        intakeId: 'intake_seed',
        userId: USER_1,
      }),
    ).rejects.toMatchObject({ code: 'DUPLICATE_INVOICE_NUMBER' });
  });

  it('convert from MATCHED + WARNINGS without acknowledgement throws INVALID_STATE_TRANSITION', async () => {
    const db = makeDb({
      intakes: [
        makeSeedIntake({
          status: 'MATCHED',
          validationStatus: 'WARNINGS',
          matchedContractorId: 'c_1',
        }),
      ],
    });

    await expect(
      convertToInvoice(db as never, {
        orgId: ORG_A,
        intakeId: 'intake_seed',
        userId: USER_1,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_STATE_TRANSITION' });
  });
});

describe('reject', () => {
  it('9. reject on a CONVERTED row throws INVALID_STATE_TRANSITION', async () => {
    const db = makeDb({
      intakes: [
        makeSeedIntake({
          status: 'CONVERTED',
          validationStatus: 'VALID',
          convertedInvoiceId: 'inv_previous',
        }),
      ],
    });

    await expect(
      reject(db as never, {
        orgId: ORG_A,
        intakeId: 'intake_seed',
        userId: USER_1,
        reason: 'duplicate',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_STATE_TRANSITION' });
  });

  it('short reason throws REASON_TOO_SHORT', async () => {
    const db = makeDb({
      intakes: [makeSeedIntake({ status: 'NEEDS_REVIEW' })],
    });

    await expect(
      reject(db as never, {
        orgId: ORG_A,
        intakeId: 'intake_seed',
        userId: USER_1,
        reason: 'no',
      }),
    ).rejects.toMatchObject({ code: 'REASON_TOO_SHORT' });
  });
});

describe('confirmMatch', () => {
  it('10. cross-org confirmMatch (orgId mismatch) throws NOT_FOUND', async () => {
    const db = makeDb({
      intakes: [makeSeedIntake({ status: 'PARSED', organizationId: ORG_A })],
    });

    await expect(
      confirmMatch(db as never, {
        orgId: ORG_B, // wrong tenant
        intakeId: 'intake_seed',
        contractorId: 'c_1',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('sets MATCHED + contractor on a PARSED intake', async () => {
    const db = makeDb({
      intakes: [makeSeedIntake({ status: 'PARSED', validationStatus: 'VALID' })],
    });

    await confirmMatch(db as never, {
      orgId: ORG_A,
      intakeId: 'intake_seed',
      contractorId: 'c_1',
      contractId: 'con_1',
    });

    const row = db.__rows.intakes.find(r => r.id === 'intake_seed');
    expect(row?.status).toBe('MATCHED');
    expect(row?.matchedContractorId).toBe('c_1');
    expect(row?.matchedContractId).toBe('con_1');
  });

  it('rejects a contractorId that belongs to another org (cross-tenant FK guard)', async () => {
    // Defense-in-depth for Prisma's tenant extension. The extension only
    // scopes top-level `where` clauses; it does NOT re-scope relation-level
    // `include` loads. Without this guard, a caller could set
    // matchedContractorId to another org's contractor, and subsequent reads
    // via `include: { contractor: true }` would happily surface the
    // cross-tenant row. The service pre-checks by querying
    // contractor.findFirst({ id, organizationId }) and failing closed.
    const db = makeDb({
      intakes: [makeSeedIntake({ status: 'PARSED', validationStatus: 'VALID' })],
    });

    db.contractor.findFirst.mockResolvedValueOnce(null);

    await expect(
      confirmMatch(db as never, {
        orgId: ORG_A,
        intakeId: 'intake_seed',
        contractorId: 'c_from_org_b',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    // Intake row must not have been mutated.
    const row = db.__rows.intakes.find(r => r.id === 'intake_seed');
    expect(row?.status).toBe('PARSED');
    expect(row?.matchedContractorId).toBeNull();
  });

  it('rejects a contractId whose contractor belongs to another org (cross-tenant FK guard)', async () => {
    const db = makeDb({
      intakes: [makeSeedIntake({ status: 'PARSED', validationStatus: 'VALID' })],
    });

    // Contractor check passes, but contract check fails — the pair must
    // both live in the caller's org AND be connected to each other.
    db.contract.findFirst.mockResolvedValueOnce(null);

    await expect(
      confirmMatch(db as never, {
        orgId: ORG_A,
        intakeId: 'intake_seed',
        contractorId: 'c_1',
        contractId: 'con_from_org_b',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    const row = db.__rows.intakes.find(r => r.id === 'intake_seed');
    expect(row?.status).toBe('PARSED');
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSeedIntake(overrides: Partial<IntakeRow> = {}): IntakeRow {
  const invoiceJson = buildMinimalInvoice();
  const fakeBytes = Buffer.from('seed', 'utf8');
  const sha = createHash('sha256').update(fakeBytes).digest('hex');
  return {
    id: 'intake_seed',
    organizationId: ORG_A,
    uploadedByUserId: USER_1,
    sourceKind: 'UPLOAD_PDF',
    rawFileKey: 'einvoice-intake/seed/raw.pdf',
    rawFileSha256: sha,
    rawFileMime: 'application/pdf',
    rawFileSizeBytes: fakeBytes.length,
    extractedXmlKey: 'einvoice-intake/seed/extracted.xml',
    validationReportKey: 'einvoice-intake/seed/report.html',
    profileLevel: 'XRECHNUNG',
    parsedInvoiceJson: invoiceJson,
    extractedSupplierName: FIXTURE_SUPPLIER_NAME,
    extractedSupplierVatId: FIXTURE_SUPPLIER_VAT,
    extractedSupplierLeitwegId: null,
    extractedInvoiceNumber: FIXTURE_INVOICE_NUMBER,
    extractedInvoiceDate: new Date('2026-04-14'),
    extractedTotalMinor: 119_000n,
    extractedCurrency: 'EUR',
    matchedContractorId: null,
    matchedContractId: null,
    convertedInvoiceId: null,
    status: 'PARSED',
    validationStatus: 'VALID',
    validationAcknowledgedAt: null,
    validationAcknowledgedByUserId: null,
    rejectionReason: null,
    unmappedFieldsJson: null,
    ...overrides,
  };
}
