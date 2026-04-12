import { delay, HttpResponse, http } from 'msw';

/**
 * Infrastructure failure scenarios for cache, storage, email, and OCR.
 * Tests that the system degrades gracefully when supporting services fail.
 */

// ---------------------------------------------------------------
// Redis Cache Failures
// ---------------------------------------------------------------

/**
 * Redis returns timeout on all operations.
 * Tests that cache miss falls through to database without blocking.
 */
export function redisTimeoutHandlers() {
  return [
    http.post('https://*.upstash.io', async () => {
      await delay(30_000); // 30s timeout — will exceed any reasonable timeout
      return HttpResponse.json({ result: null });
    }),

    http.post('https://*.upstash.io/pipeline', async () => {
      await delay(30_000);
      return HttpResponse.json([]);
    }),
  ];
}

/**
 * Redis returns corrupted/unexpected response format.
 * Tests that cache deserialization failures are handled gracefully.
 */
export function redisCorruptResponseHandlers() {
  return [
    http.post('https://*.upstash.io', async () => {
      // Return non-JSON, malformed response
      return new HttpResponse('WRONGTYPE Operation against a key holding the wrong kind of value', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    }),
  ];
}

/**
 * Redis connection refused — 503 on all operations.
 */
export function redisDownHandlers() {
  return [
    http.post('https://*.upstash.io', () => {
      return HttpResponse.json({ error: 'Connection refused' }, { status: 503 });
    }),
    http.post('https://*.upstash.io/pipeline', () => {
      return HttpResponse.json({ error: 'Connection refused' }, { status: 503 });
    }),
  ];
}

// ---------------------------------------------------------------
// R2 Storage Failures
// ---------------------------------------------------------------

/**
 * R2 returns 403 Forbidden — credentials invalid or bucket policy denies access.
 */
export function r2ForbiddenHandlers() {
  return [
    http.put('https://*.r2.cloudflarestorage.com/*', () => {
      return HttpResponse.xml(
        `<?xml version="1.0" encoding="UTF-8"?><Error><Code>AccessDenied</Code><Message>Access Denied</Message></Error>`,
        { status: 403 },
      );
    }),
    http.get('https://*.r2.cloudflarestorage.com/*', () => {
      return HttpResponse.xml(
        `<?xml version="1.0" encoding="UTF-8"?><Error><Code>AccessDenied</Code><Message>Access Denied</Message></Error>`,
        { status: 403 },
      );
    }),
  ];
}

/**
 * R2 object exists but is 0 bytes (empty upload).
 */
export function r2EmptyObjectHandlers() {
  return [
    http.get('https://*.r2.cloudflarestorage.com/*', () => {
      return new HttpResponse(new Uint8Array(0), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Length': '0',
        },
      });
    }),
    http.head('https://*.r2.cloudflarestorage.com/*', () => {
      return new HttpResponse(null, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Length': '0',
        },
      });
    }),
  ];
}

/**
 * R2 returns 404 — object does not exist.
 */
export function r2NotFoundHandlers() {
  return [
    http.get('https://*.r2.cloudflarestorage.com/*', () => {
      return HttpResponse.xml(
        `<?xml version="1.0" encoding="UTF-8"?><Error><Code>NoSuchKey</Code><Message>The specified key does not exist.</Message></Error>`,
        { status: 404 },
      );
    }),
    http.head('https://*.r2.cloudflarestorage.com/*', () => {
      return new HttpResponse(null, { status: 404 });
    }),
  ];
}

// ---------------------------------------------------------------
// Email Delivery Failures (Resend)
// ---------------------------------------------------------------

/**
 * Resend returns 400 — invalid email address.
 */
export function resendInvalidEmailHandlers() {
  return [
    http.post('https://api.resend.com/emails', () => {
      return HttpResponse.json(
        {
          statusCode: 400,
          message: 'Invalid `to` field. The email address is not valid.',
          name: 'validation_error',
        },
        { status: 400 },
      );
    }),
  ];
}

/**
 * Resend returns 401 — API key invalid.
 */
export function resendUnauthorizedHandlers() {
  return [
    http.post('https://api.resend.com/emails', () => {
      return HttpResponse.json(
        {
          statusCode: 401,
          message: 'API key is invalid',
          name: 'authentication_error',
        },
        { status: 401 },
      );
    }),
  ];
}

/**
 * Resend returns 429 during batch send — rate limited after first email.
 */
export function resendBatchRateLimitHandlers() {
  let callCount = 0;
  return [
    http.post('https://api.resend.com/emails', () => {
      callCount++;
      if (callCount > 1) {
        return HttpResponse.json(
          {
            statusCode: 429,
            message: 'Too many requests',
            name: 'rate_limit_exceeded',
          },
          { status: 429, headers: { 'Retry-After': '10' } },
        );
      }
      return HttpResponse.json({ id: 'email-first-ok' });
    }),
  ];
}

// ---------------------------------------------------------------
// OCR Failures (Claude)
// ---------------------------------------------------------------

/**
 * Claude OCR times out (simulates QStash timeout on long PDF processing).
 */
export function ocrTimeoutHandlers() {
  return [
    http.post('https://api.anthropic.com/v1/messages', async () => {
      await delay(120_000); // 2 min timeout
      return HttpResponse.json(
        { type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } },
        { status: 529 },
      );
    }),
  ];
}

/**
 * Claude OCR returns error for corrupted/unreadable PDF.
 */
export function ocrCorruptPdfHandlers() {
  return [
    http.post('https://api.anthropic.com/v1/messages', () => {
      return HttpResponse.json(
        {
          type: 'error',
          error: {
            type: 'invalid_request_error',
            message:
              'Could not process the provided document. The file appears to be corrupted or in an unsupported format.',
          },
        },
        { status: 400 },
      );
    }),
  ];
}

/**
 * Claude OCR returns tool_use but with empty/zero results (blank page scan).
 */
export function ocrBlankPageHandlers() {
  return [
    http.post('https://api.anthropic.com/v1/messages', () => {
      return HttpResponse.json({
        id: 'msg_blank',
        type: 'message',
        role: 'assistant',
        model: 'claude-sonnet-4-5-20250514',
        content: [
          {
            type: 'tool_use',
            id: 'toolu_blank',
            name: 'extract_invoice_data',
            input: {
              invoiceNumber: { value: null, confidence: 0.0 },
              issueDate: { value: null, confidence: 0.0 },
              dueDate: { value: null, confidence: 0.0 },
              sellerNip: { value: null, confidence: 0.0 },
              buyerNip: { value: null, confidence: 0.0 },
              sellerName: { value: null, confidence: 0.0 },
              buyerName: { value: null, confidence: 0.0 },
              currency: { value: null, confidence: 0.0 },
              totalNet: { value: null, confidence: 0.0 },
              totalTax: { value: null, confidence: 0.0 },
              totalGross: { value: null, confidence: 0.0 },
              bankAccount: { value: null, confidence: 0.0 },
              lineItems: [],
            },
          },
        ],
        stop_reason: 'tool_use',
        usage: { input_tokens: 100, output_tokens: 50 },
      });
    }),
  ];
}

// ---------------------------------------------------------------
// KSeF Failures
// ---------------------------------------------------------------

/**
 * KSeF session authentication fails (invalid token/NIP).
 */
export function ksefAuthFailureHandlers() {
  return [
    http.post('https://ksef-test.mf.gov.pl/api/v2/auth/challenge', () => {
      return HttpResponse.json(
        { error: 'Invalid NIP', code: 'AUTH_CHALLENGE_FAILED' },
        { status: 400 },
      );
    }),
  ];
}

/**
 * KSeF query never completes — stays in PROCESSING state.
 */
export function ksefQueryTimeoutHandlers() {
  return [
    http.post('https://ksef-test.mf.gov.pl/api/v2/invoices/query/metadata', () => {
      return HttpResponse.json({ queryId: 'query-stuck' });
    }),
    http.get('https://ksef-test.mf.gov.pl/api/v2/invoices/query/:queryId/status', () => {
      // Never completes — always PROCESSING
      return HttpResponse.json({
        status: 'PROCESSING',
        processingCode: 102,
      });
    }),
  ];
}

/**
 * KSeF query fails with FAILED status.
 */
export function ksefQueryFailedHandlers() {
  return [
    http.post('https://ksef-test.mf.gov.pl/api/v2/invoices/query/metadata', () => {
      return HttpResponse.json({ queryId: 'query-fail' });
    }),
    http.get('https://ksef-test.mf.gov.pl/api/v2/invoices/query/:queryId/status', () => {
      return HttpResponse.json({
        status: 'FAILED',
        processingCode: 500,
      });
    }),
  ];
}
