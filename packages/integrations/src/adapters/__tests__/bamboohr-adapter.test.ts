import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import type { CredentialBlob } from '../../types/credentials.js';
import { BambooHrAdapter } from '../bamboohr-adapter.js';

const fixture = JSON.parse(
  readFileSync(join(__dirname, 'fixtures/bamboohr/employees.json'), 'utf8'),
) as unknown;

const creds: CredentialBlob = {
  accessToken: 'bamboohr-oauth-access-token',
  refreshToken: 'bamboohr-refresh-token',
};

function fakeFetchReturning(body: unknown): typeof fetch {
  return vi.fn(
    async () => new Response(JSON.stringify(body), { status: 200 }),
  ) as unknown as typeof fetch;
}

describe('BambooHrAdapter', () => {
  it('is an OAuth 2.0 adapter with a getOAuthConfig naming BAMBOOHR_CLIENT_ID/SECRET', () => {
    const adapter = new BambooHrAdapter();
    expect(adapter.supportsOAuth).toBe(true);
    expect(adapter.slug).toBe('bamboohr');
    const cfg = adapter.getOAuthConfig();
    expect(cfg.clientIdEnvVar).toBe('BAMBOOHR_CLIENT_ID');
    expect(cfg.clientSecretEnvVar).toBe('BAMBOOHR_CLIENT_SECRET');
    expect(cfg.redirectPath).toContain('/bamboohr/');
    expect(cfg.scopes.length).toBeGreaterThan(0);
  });

  it('listEmployees parses the un-paginated /v1/employees/directory fixture', async () => {
    const adapter = new BambooHrAdapter({ fetchImpl: fakeFetchReturning(fixture) });
    const records = await adapter.listEmployees(creds, {});
    expect(records).toHaveLength(3);
    const first = records[0];
    expect(first?.externalId).toBe('77');
    expect(first?.provider).toBe('BAMBOOHR');
    expect(first?.attributes.displayName).toBe('John Smith');
    expect(first?.attributes.jobTitle).toBe('Engineering Manager');
  });

  it('safeParses a malformed directory without an unsafe cast', async () => {
    const adapter = new BambooHrAdapter({ fetchImpl: fakeFetchReturning({ nope: true }) });
    const records = await adapter.listEmployees(creds, {});
    expect(records).toEqual([]);
  });

  // Custom-attribute mapping is contract-gated — auto-runs + flips GREEN when verified.
  it.skipIf(!process.env.BAMBOOHR_CUSTOM_ATTR_VERIFIED)(
    'maps BambooHR custom attributes when the contract is verified',
    async () => {
      const adapter = new BambooHrAdapter({ fetchImpl: fakeFetchReturning(fixture) });
      const records = await adapter.listEmployees(creds, {});
      expect(records[0]?.attributes.customBadgeId).toBe('BADGE-77');
    },
  );

  // Live OAuth round-trip + pull — auto-runs + flips GREEN when creds land.
  it.skipIf(!process.env.BAMBOOHR_CLIENT_ID)(
    'performs a live BambooHR pull when credentials are present',
    async () => {
      const adapter = new BambooHrAdapter();
      const records = await adapter.listEmployees(creds, {});
      expect(Array.isArray(records)).toBe(true);
    },
  );
});
