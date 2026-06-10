// HMRC VAT Zod schema tests.

import { describe, expect, it } from 'vitest';

import {
  hmrcOauthTokenSchema,
  hmrcVatErrorResponseSchema,
  hmrcVatLookupResponseSchema,
} from '../hmrc-vat.schema.js';

describe('hmrcOauthTokenSchema', () => {
  it('parses a canonical OAuth 2.0 client-credentials response', () => {
    const parsed = hmrcOauthTokenSchema.parse({
      access_token: 'test-access-token-abc123',
      token_type: 'bearer',
      expires_in: 14400,
      scope: 'read:vat',
    });
    expect(parsed.access_token).toBe('test-access-token-abc123');
    expect(parsed.expires_in).toBe(14400);
  });

  it('rejects non-bearer token_type', () => {
    expect(() =>
      hmrcOauthTokenSchema.parse({
        access_token: 't',
        token_type: 'basic',
        expires_in: 1,
        scope: 'x',
      }),
    ).toThrow();
  });
});

describe('hmrcVatLookupResponseSchema', () => {
  it('parses an unverified lookup success body', () => {
    const parsed = hmrcVatLookupResponseSchema.parse({
      processingDate: '2026-04-12T10:00:00Z',
      target: {
        name: 'TEST COMPANY LTD',
        vatNumber: '193054661',
        address: {
          line1: '1 Test St',
          postcode: 'SW1A 1AA',
          countryCode: 'GB',
        },
      },
    });
    expect(parsed.target.vatNumber).toBe('193054661');
    expect(parsed.consultationNumber).toBeUndefined();
  });

  it('parses a verified (two-arg) lookup body with consultationNumber', () => {
    const parsed = hmrcVatLookupResponseSchema.parse({
      processingDate: '2026-04-12T10:00:00Z',
      target: {
        name: 'TEST COMPANY LTD',
        vatNumber: '193054661',
        address: {
          line1: '1 Test St',
          postcode: 'SW1A 1AA',
          countryCode: 'GB',
        },
      },
      requester: '987654321',
      consultationNumber: 'C-2026-0001',
    });
    expect(parsed.requester).toBe('987654321');
    expect(parsed.consultationNumber).toBe('C-2026-0001');
  });

  it('rejects a malformed body missing the target node', () => {
    expect(() => hmrcVatLookupResponseSchema.parse({ processingDate: 'x' })).toThrow();
  });
});

describe('hmrcVatErrorResponseSchema', () => {
  it('parses HMRC error envelope', () => {
    const parsed = hmrcVatErrorResponseSchema.parse({
      code: 'NOT_FOUND',
      message: 'VAT number not found',
    });
    expect(parsed.code).toBe('NOT_FOUND');
  });
});
