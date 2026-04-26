// packages/api/src/services/__tests__/fixtures/intake-fixtures.ts
//
// Phase 62 · Plan 62-04 Task 2 — deterministic fixtures for the invoice
// intake service unit tests. Every fixture is built from constants with
// pinned dates so the byte stream is reproducible across runs (no
// `Date.now()`, no `Math.random()`).
//
// The orchestration tests inject a mock `parseZugferdPdf` via
// `IntakeServiceDeps`, so the "PDF" bytes do not need to parse cleanly —
// they only need to:
//   1. be distinguishable per fixture so dedup-sha256 is stable,
//   2. carry a plausible PDF header so MIME sniffers in production code
//      still accept them when re-run against the real parser in an
//      integration suite,
//   3. never collide with the XML fixture (different bytes → different sha).
//
// pdf-lib is deliberately NOT imported here to keep the api package's test
// closure free of the zugferd-de generator's heavier transitive deps.
//
// Exported helpers:
//   - `buildMinimalInvoice(overrides)` — canonical EInvoice envelope
//   - `buildXmlFixture()`              — UTF-8 CII XML string
//   - `buildXmlWithBom()`              — same XML with a UTF-8 BOM prefix
//   - `buildHappyPathPdfBase64()`      — base64 opaque "PDF" bytes
//   - `padBase64BufferTo(b64, N)`      — grow a base64 buffer past N bytes
//   - `buildXsdInvalidXmlBase64()`     — base64 XML with a non-CII root

import type { EInvoice } from '@contractor-ops/einvoice';
import { generateXRechnungCii } from '@contractor-ops/einvoice';

export const FIXTURE_SUPPLIER_VAT = 'DE123456789';
export const FIXTURE_SUPPLIER_NAME = 'Alpha GmbH';
export const FIXTURE_INVOICE_NUMBER = 'INTAKE-2026-0001';

export function buildMinimalInvoice(overrides: Partial<EInvoice> = {}): EInvoice {
  return {
    id: FIXTURE_INVOICE_NUMBER,
    issueDate: '2026-04-14',
    dueDate: '2026-05-14',
    invoiceTypeCode: '380',
    currencyCode: 'EUR',
    profileId: 'xrechnung-de',
    supplier: {
      id: FIXTURE_SUPPLIER_VAT,
      name: FIXTURE_SUPPLIER_NAME,
      address: 'Alexanderplatz 1, 10178 Berlin',
      country: 'DE',
    },
    customer: {
      id: 'DE987654321',
      name: 'Bundesamt für Beispiel',
      address: 'Friedrichstraße 50, 10117 Berlin',
      country: 'DE',
    },
    lines: [
      {
        lineNumber: 1,
        description: 'Consulting services',
        quantity: 10,
        unit: 'HUR',
        unitPriceMinor: 10_000,
        netAmountMinor: 100_000,
        vatRate: '19',
      },
    ],
    taxExclusiveAmount: 100_000,
    taxInclusiveAmount: 119_000,
    payableAmount: 119_000,
    taxBreakdown: [
      {
        taxableAmountMinor: 100_000,
        taxAmountMinor: 19_000,
        taxCategory: 'S',
        percent: 19,
      },
    ],
    ...overrides,
  };
}

export function buildXmlFixture(overrides: Partial<EInvoice> = {}): string {
  return generateXRechnungCii(buildMinimalInvoice(overrides), null);
}

export function buildXmlWithBom(overrides: Partial<EInvoice> = {}): string {
  return `\uFEFF${buildXmlFixture(overrides)}`;
}

export function buildXmlBase64(overrides: Partial<EInvoice> = {}): string {
  const xml = buildXmlFixture(overrides);
  return Buffer.from(xml, 'utf8').toString('base64');
}

/**
 * Opaque "PDF" bytes — a real PDF header followed by a deterministic
 * identifier string so the SHA-256 content-hash is stable across runs.
 * The service's parser is mocked in unit tests, so these bytes never
 * actually pass through a real PDF loader; they only gate the size + MIME
 * checks and dedup hash computation.
 */
export const HAPPY_PATH_PDF_BYTES = Buffer.from(
  '%PDF-1.4\n% Deterministic intake fixture\n%% invoice:INTAKE-2026-0001 supplier:DE123456789\n%%EOF\n',
  'utf8',
);

export async function buildHappyPathPdfBase64(): Promise<string> {
  return HAPPY_PATH_PDF_BYTES.toString('base64');
}

export function padBase64BufferTo(base64: string, targetBytes: number): string {
  const current = Buffer.from(base64, 'base64');
  if (current.length >= targetBytes) return base64;
  const filler = Buffer.alloc(targetBytes - current.length, 0);
  return Buffer.concat([current, filler]).toString('base64');
}

export function buildXsdInvalidXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<not-a-cii-root>hello</not-a-cii-root>`;
}

export function buildXsdInvalidXmlBase64(): string {
  return Buffer.from(buildXsdInvalidXml(), 'utf8').toString('base64');
}
