import { describe, expect, it } from 'vitest';
import {
  connectPeppolSchema,
  getTransmissionByInvoiceIdSchema,
  getTransmissionsSchema,
  peppolParticipantIdSchema,
  retryTransmissionSchema,
  transmitInvoiceSchema,
} from '../peppol.js';

// ---------------------------------------------------------------------------
// peppolParticipantIdSchema
// ---------------------------------------------------------------------------

describe('peppolParticipantIdSchema', () => {
  it('accepts valid UAE Peppol participant ID', () => {
    const r = peppolParticipantIdSchema.safeParse('0235:123456789012345');
    expect(r.success).toBe(true);
  });

  it('rejects missing scheme prefix', () => {
    const r = peppolParticipantIdSchema.safeParse('123456789012345');
    expect(r.success).toBe(false);
  });

  it('rejects wrong scheme prefix', () => {
    const r = peppolParticipantIdSchema.safeParse('0191:123456789012345');
    expect(r.success).toBe(false);
  });

  it('rejects TRN shorter than 15 digits', () => {
    const r = peppolParticipantIdSchema.safeParse('0235:12345678901234');
    expect(r.success).toBe(false);
  });

  it('rejects TRN longer than 15 digits', () => {
    const r = peppolParticipantIdSchema.safeParse('0235:1234567890123456');
    expect(r.success).toBe(false);
  });

  it('rejects non-digit characters in TRN', () => {
    const r = peppolParticipantIdSchema.safeParse('0235:12345678901234a');
    expect(r.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// connectPeppolSchema
// ---------------------------------------------------------------------------

describe('connectPeppolSchema', () => {
  const valid = {
    trn: '123456789012345',
    aspProvider: 'storecove' as const,
    apiKey: 'my-api-key',
    environment: 'sandbox' as const,
  };

  it('accepts valid input', () => {
    const r = connectPeppolSchema.safeParse(valid);
    expect(r.success).toBe(true);
  });

  it('rejects TRN not exactly 15 digits', () => {
    const r = connectPeppolSchema.safeParse({ ...valid, trn: '1234' });
    expect(r.success).toBe(false);
  });

  it('rejects non-digit TRN', () => {
    const r = connectPeppolSchema.safeParse({ ...valid, trn: 'abcdefghijklmno' });
    expect(r.success).toBe(false);
  });

  it('rejects invalid aspProvider', () => {
    const r = connectPeppolSchema.safeParse({ ...valid, aspProvider: 'other' });
    expect(r.success).toBe(false);
  });

  it('rejects empty apiKey', () => {
    const r = connectPeppolSchema.safeParse({ ...valid, apiKey: '' });
    expect(r.success).toBe(false);
  });

  it('rejects invalid environment', () => {
    const r = connectPeppolSchema.safeParse({ ...valid, environment: 'staging' });
    expect(r.success).toBe(false);
  });

  it('accepts production environment', () => {
    const r = connectPeppolSchema.safeParse({ ...valid, environment: 'production' });
    expect(r.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// transmitInvoiceSchema
// ---------------------------------------------------------------------------

describe('transmitInvoiceSchema', () => {
  it('accepts valid input', () => {
    const r = transmitInvoiceSchema.safeParse({
      invoiceId: 'clh1234567890abcdefghijk',
      receiverParticipantId: '0235:123456789012345',
    });
    expect(r.success).toBe(true);
  });

  it('rejects non-cuid invoiceId', () => {
    const r = transmitInvoiceSchema.safeParse({
      invoiceId: 'not-a-cuid',
      receiverParticipantId: '0235:123456789012345',
    });
    expect(r.success).toBe(false);
  });

  it('rejects invalid participant ID', () => {
    const r = transmitInvoiceSchema.safeParse({
      invoiceId: 'clh1234567890abcdefghijk',
      receiverParticipantId: 'invalid',
    });
    expect(r.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getTransmissionsSchema
// ---------------------------------------------------------------------------

describe('getTransmissionsSchema', () => {
  it('accepts empty object with defaults', () => {
    const r = getTransmissionsSchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.limit).toBe(20);
    }
  });

  it('accepts full input', () => {
    const r = getTransmissionsSchema.safeParse({
      cursor: 'abc123',
      limit: 50,
      direction: 'INBOUND',
    });
    expect(r.success).toBe(true);
  });

  it('accepts OUTBOUND direction', () => {
    const r = getTransmissionsSchema.safeParse({ direction: 'OUTBOUND' });
    expect(r.success).toBe(true);
  });

  it('rejects limit above 100', () => {
    const r = getTransmissionsSchema.safeParse({ limit: 101 });
    expect(r.success).toBe(false);
  });

  it('rejects limit below 1', () => {
    const r = getTransmissionsSchema.safeParse({ limit: 0 });
    expect(r.success).toBe(false);
  });

  it('rejects non-integer limit', () => {
    const r = getTransmissionsSchema.safeParse({ limit: 5.5 });
    expect(r.success).toBe(false);
  });

  it('rejects invalid direction', () => {
    const r = getTransmissionsSchema.safeParse({ direction: 'BOTH' });
    expect(r.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getTransmissionByInvoiceIdSchema
// ---------------------------------------------------------------------------

describe('getTransmissionByInvoiceIdSchema', () => {
  it('accepts valid cuid', () => {
    const r = getTransmissionByInvoiceIdSchema.safeParse({
      invoiceId: 'clh1234567890abcdefghijk',
    });
    expect(r.success).toBe(true);
  });

  it('rejects non-cuid', () => {
    const r = getTransmissionByInvoiceIdSchema.safeParse({ invoiceId: 'bad' });
    expect(r.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// retryTransmissionSchema
// ---------------------------------------------------------------------------

describe('retryTransmissionSchema', () => {
  it('accepts valid cuid', () => {
    const r = retryTransmissionSchema.safeParse({
      transmissionId: 'clh1234567890abcdefghijk',
    });
    expect(r.success).toBe(true);
  });

  it('rejects non-cuid', () => {
    const r = retryTransmissionSchema.safeParse({ transmissionId: '' });
    expect(r.success).toBe(false);
  });
});
