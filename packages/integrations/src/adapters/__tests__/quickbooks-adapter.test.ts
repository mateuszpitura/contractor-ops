import { describe, expect, it } from 'vitest';

import { mapFeedToQuickbooksPayload, QuickBooksAdapter } from '../quickbooks-adapter.js';

const feed = {
  organizationId: 'org-us-0001',
  generatedAt: '2026-07-05T00:00:00.000Z',
  targetCountry: 'US',
  employees: [
    {
      workerId: 'wrk-us-001',
      displayName: 'Michael Brown',
      email: 'michael.brown@example.com',
      countryCode: 'US',
      hireDate: '2024-03-01',
      terminatedAt: null,
      employmentStatus: 'ACTIVE' as const,
      etat: '1.00',
      nationalIdLast4: '1234',
      countryFields: { filingStatus: 'SINGLE', stateWithholding: 'CA', stateOther: '' },
    },
  ],
};

describe('QuickBooksAdapter', () => {
  const adapter = new QuickBooksAdapter();

  it('is an OAuth 2.0 provider adapter', () => {
    expect(adapter.slug).toBe('quickbooks');
    expect(adapter.displayName).toContain('QuickBooks');
    expect(adapter.supportsOAuth).toBe(true);
    expect(adapter.supportsWebhooks).toBe(false);
  });

  it('exposes an env-var-named OAuth config with the Intuit endpoints', () => {
    const cfg = adapter.getOAuthConfig();
    expect(cfg.clientIdEnvVar).toBe('QUICKBOOKS_CLIENT_ID');
    expect(cfg.clientSecretEnvVar).toBe('QUICKBOOKS_CLIENT_SECRET');
    expect(cfg.authorizationUrl).toContain('intuit');
    expect(cfg.tokenUrl).toContain('intuit');
    expect(cfg.redirectPath).toBe('/api/oauth/quickbooks/callback');
    expect(Array.isArray(cfg.scopes)).toBe(true);
  });

  it('maps a PayrollFeed to the QuickBooks employee payload shape (no full SSN)', () => {
    const payload = mapFeedToQuickbooksPayload(feed);
    expect(payload.employees).toHaveLength(1);
    const [e] = payload.employees;
    expect(e.name).toBe('Michael Brown');
    expect(e.ssn_last_4).toBe('1234');
    expect(JSON.stringify(payload)).not.toContain('123456789');
  });

  it.skipIf(!process.env.QUICKBOOKS_CLIENT_ID)(
    'exchanges an authorization code for tokens against the live Intuit API',
    async () => {
      const creds = await adapter.exchangeCodeForTokens('test-code', 'https://app.local/cb');
      expect(creds.accessToken).toBeTruthy();
    },
  );
});
