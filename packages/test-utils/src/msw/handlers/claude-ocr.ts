import { HttpResponse, http } from 'msw';
import type { HandlerOptions } from '../types.js';
import { applyNetworkConditions, mockId } from '../utils.js';

export function claudeOcrHandlers(options?: HandlerOptions) {
  const net = options?.network;

  return [
    // --- Anthropic Messages API (OCR via Vision) ---
    http.post('https://api.anthropic.com/v1/messages', async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json({
        id: `msg_${mockId()}`,
        type: 'message',
        role: 'assistant',
        model: 'claude-sonnet-4-5-20250514',
        content: [
          {
            type: 'tool_use',
            id: `toolu_${mockId().slice(0, 12)}`,
            name: 'extract_invoice_data',
            input: {
              invoiceNumber: { value: 'FV/2026/001', confidence: 0.98 },
              issueDate: { value: '2026-03-15', confidence: 0.99 },
              dueDate: { value: '2026-04-15', confidence: 0.95 },
              sellerNip: { value: '1234567890', confidence: 0.97 },
              buyerNip: { value: '0987654321', confidence: 0.96 },
              sellerName: { value: 'Test Seller Sp. z o.o.', confidence: 0.94 },
              buyerName: { value: 'Test Buyer S.A.', confidence: 0.93 },
              currency: { value: 'PLN', confidence: 0.99 },
              totalNet: { value: 10000.0, confidence: 0.97 },
              totalTax: { value: 2300.0, confidence: 0.96 },
              totalGross: { value: 12300.0, confidence: 0.98 },
              bankAccount: {
                value: 'PL12345678901234567890123456',
                confidence: 0.85,
              },
              lineItems: [
                {
                  description: 'Software development services',
                  quantity: 160,
                  unit: 'h',
                  unitPrice: 62.5,
                  netAmount: 10000.0,
                  vatRate: '23%',
                  vatAmount: 2300.0,
                  grossAmount: 12300.0,
                  confidence: 0.92,
                },
              ],
            },
          },
        ],
        stop_reason: 'tool_use',
        usage: { input_tokens: 1500, output_tokens: 450 },
      });
    }),
  ];
}
