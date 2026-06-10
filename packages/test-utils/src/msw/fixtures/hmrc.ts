// HMRC VAT fixtures — canonical sandbox VRNs + response bodies for MSW handlers + client tests.

export const HMRC_OAUTH_TOKEN_200 = {
  access_token: 'test-access-token-abc123',
  token_type: 'bearer' as const,
  expires_in: 14400,
  scope: 'read:vat',
};

export const HMRC_VAT_LOOKUP_200 = (targetVrn: string, requesterVrn?: string) => ({
  processingDate: '2026-04-12T10:00:00Z',
  target: {
    name: 'TEST COMPANY LTD',
    vatNumber: targetVrn,
    address: {
      line1: '1 Test St',
      postcode: 'SW1A 1AA',
      countryCode: 'GB',
    },
  },
  ...(requesterVrn ? { requester: requesterVrn, consultationNumber: 'C-2026-0001' } : {}),
});

export const HMRC_VAT_LOOKUP_404 = {
  code: 'NOT_FOUND',
  message: 'The VAT registration number has not been found',
};

export const HMRC_VAT_LOOKUP_500 = {
  code: 'INTERNAL_SERVER_ERROR',
  message: 'Service unavailable',
};

/** HMRC publicly-documented sandbox valid test VRN. */
export const HMRC_SANDBOX_VALID_VRN = '193054661';

/** HMRC publicly-documented sandbox invalid test VRN. */
export const HMRC_SANDBOX_INVALID_VRN = '555555555';
