import { describe, expect, it } from 'vitest';

import { GustoAdapter, mapFeedToGustoPayload } from '../gusto-adapter.js';

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

describe('GustoAdapter', () => {
  const adapter = new GustoAdapter();

  it('is an OAuth 2.0 provider adapter', () => {
    expect(adapter.slug).toBe('gusto');
    expect(adapter.displayName).toContain('Gusto');
    expect(adapter.supportsOAuth).toBe(true);
    expect(adapter.supportsWebhooks).toBe(false);
  });

  it('exposes an env-var-named OAuth config with the Gusto endpoints', () => {
    const cfg = adapter.getOAuthConfig();
    expect(cfg.clientIdEnvVar).toBe('GUSTO_CLIENT_ID');
    expect(cfg.clientSecretEnvVar).toBe('GUSTO_CLIENT_SECRET');
    expect(cfg.authorizationUrl).toContain('gusto');
    expect(cfg.tokenUrl).toContain('gusto');
    expect(cfg.redirectPath).toBe('/api/oauth/gusto/callback');
    expect(Array.isArray(cfg.scopes)).toBe(true);
  });

  it('maps a PayrollFeed to the Gusto employee payload shape (no full SSN)', () => {
    const payload = mapFeedToGustoPayload(feed);
    expect(payload.employees).toHaveLength(1);
    const [e] = payload.employees;
    expect(e.first_name).toBe('Michael');
    expect(e.last_name).toBe('Brown');
    expect(e.ssn_last_4).toBe('1234');
    expect(JSON.stringify(payload)).not.toContain('123456789');
  });

  it.skipIf(!process.env.GUSTO_CLIENT_ID)(
    'exchanges an authorization code for tokens against the live Gusto API',
    async () => {
      const creds = await adapter.exchangeCodeForTokens('test-code', 'https://app.local/cb');
      expect(creds.accessToken).toBeTruthy();
    },
  );
});
