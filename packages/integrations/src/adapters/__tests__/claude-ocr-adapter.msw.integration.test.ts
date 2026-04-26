import { createMockServer, selectHandlers } from '@contractor-ops/test-utils';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { ClaudeOcrAdapter } from '../claude-ocr-adapter.js';

const { server } = createMockServer({
  handlersOnly: true,
  extraHandlers: selectHandlers(['claudeOcr']),
});

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('ClaudeOcrAdapter MSW integration', () => {
  it('extractInvoice() returns extraction result with fields and lineItems', async () => {
    const adapter = new ClaudeOcrAdapter({ apiKey: 'sk-ant-test' });

    // Minimal base64-encoded PDF (just enough to pass size check)
    const minimalPdfBase64 = Buffer.from('%PDF-1.4 minimal test content').toString('base64');

    const result = await adapter.extractInvoice({
      pdfBase64: minimalPdfBase64,
      pageCount: 1,
      fileName: 'test-invoice.pdf',
    });

    expect(result.status).toBe('EXTRACTED');
    expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    expect(result.pageCount).toBe(1);
    expect(result.overallConfidence).toBeGreaterThan(0);

    // Verify extracted fields
    expect(result.fields.invoiceNumber?.value).toBe('FV/2026/001');
    expect(result.fields.issueDate?.value).toBe('2026-03-15');
    expect(result.fields.currency?.value).toBe('PLN');
    expect(result.fields.sellerNip?.value).toBe('1234567890');
    expect(result.fields.buyerNip?.value).toBe('0987654321');

    // Amount fields are converted to minor units (cents)
    expect(result.fields.totalNet?.value).toBe(1000000); // 10000.00 * 100
    expect(result.fields.totalTax?.value).toBe(230000); // 2300.00 * 100
    expect(result.fields.totalGross?.value).toBe(1230000); // 12300.00 * 100

    // Verify line items
    expect(result.lineItems.length).toBe(1);
    expect(result.lineItems[0]?.description).toBe('Software development services');
    expect(result.lineItems[0]?.quantity).toBe(160);
    expect(result.lineItems[0]?.unit).toBe('h');
    expect(result.lineItems[0]?.netAmountMinor).toBe(1000000);
    expect(result.lineItems[0]?.vatRate).toBe('23%');
  });
});
