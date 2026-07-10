/**
 * PII-redaction-before-persist security net (`services/webhooks/redact.ts`).
 *
 * `include_pii:false` is the RODO-defensible default. National identifiers
 * (PESEL/SSN/NI/Steuer-IdNr/Emirates ID/Iqama), bank identifiers (IBAN) and
 * contact PII (email/phone) MUST be stripped from the payload BEFORE it is
 * snapshotted into the deliverable/DLQ row — so no PII ever sits in a row an
 * operator (or a DLQ inspection) could read. `include_pii:true` retains them.
 * The redactor is pure and never mutates its input.
 */

import { describe, expect, it } from 'vitest';

const REDACT_MODULE = '../../services/webhooks/redact';

function samplePayload() {
  return {
    id: 'ct_1',
    name: 'Jan Kowalski',
    pesel: '44051401359',
    ssn: '123-45-6789',
    niNumber: 'QQ123456C',
    steuerIdNr: '12345678901',
    emiratesId: '784-1990-1234567-1',
    iqama: '2412345678',
    email: 'jan@example.com',
    phone: '+48500600700',
    nested: {
      iban: 'DE89370400440532013000',
      taxId: 'TAX-1',
      note: 'keep me',
    },
    contacts: [{ email: 'a@b.com', ssn: '999-99-9999', label: 'work' }],
  };
}

const PII_KEYS = [
  'pesel',
  'ssn',
  'niNumber',
  'steuerIdNr',
  'emiratesId',
  'iqama',
  'email',
  'phone',
] as const;

describe('redactPii — include_pii:false strips PII (INTEG-WEBHOOK-07)', () => {
  it('replaces every top-level PII key with a sentinel', async () => {
    const { redactPii } = await import(REDACT_MODULE);
    const out = redactPii(samplePayload(), { includePii: false });
    for (const key of PII_KEYS) {
      expect(out[key]).toBe('[redacted]');
    }
  });

  it('redacts PII in nested objects and arrays', async () => {
    const { redactPii } = await import(REDACT_MODULE);
    const out = redactPii(samplePayload(), { includePii: false });
    expect(out.nested.iban).toBe('[redacted]');
    expect(out.nested.taxId).toBe('[redacted]');
    expect(out.contacts[0].email).toBe('[redacted]');
    expect(out.contacts[0].ssn).toBe('[redacted]');
  });

  it('preserves non-PII fields and object shape', async () => {
    const { redactPii } = await import(REDACT_MODULE);
    const out = redactPii(samplePayload(), { includePii: false });
    expect(out.name).toBe('Jan Kowalski');
    expect(out.nested.note).toBe('keep me');
    expect(out.contacts[0].label).toBe('work');
  });

  it('never mutates the input payload', async () => {
    const { redactPii } = await import(REDACT_MODULE);
    const input = samplePayload();
    redactPii(input, { includePii: false });
    expect(input.pesel).toBe('44051401359');
    expect(input.contacts[0].ssn).toBe('999-99-9999');
  });
});

describe('redactPii — include_pii:true retains PII', () => {
  it('returns the values unchanged when opted in', async () => {
    const { redactPii } = await import(REDACT_MODULE);
    const out = redactPii(samplePayload(), { includePii: true });
    expect(out.pesel).toBe('44051401359');
    expect(out.nested.iban).toBe('DE89370400440532013000');
    expect(out.contacts[0].email).toBe('a@b.com');
  });
});

describe('WEBHOOK_PII_KEYS — derived from the validator inventory', () => {
  it('covers the national-identifier + contact PII field names', async () => {
    const { WEBHOOK_PII_KEYS } = await import(REDACT_MODULE);
    for (const key of PII_KEYS) {
      expect(WEBHOOK_PII_KEYS.has(key.toLowerCase())).toBe(true);
    }
  });
});
