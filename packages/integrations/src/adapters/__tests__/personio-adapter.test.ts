import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import type { CredentialBlob } from '../../types/credentials.js';
import { PersonioAdapter } from '../personio-adapter.js';

const fixture = JSON.parse(
  readFileSync(join(__dirname, 'fixtures/personio/employees.json'), 'utf8'),
) as unknown;

const creds: CredentialBlob = {
  accessToken: 'personio-bearer-token',
  expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
};

function fakeFetchReturning(pages: unknown[]): typeof fetch {
  let call = 0;
  return vi.fn(async () => {
    const body = pages[Math.min(call, pages.length - 1)];
    call += 1;
    return new Response(JSON.stringify(body), { status: 200 });
  }) as unknown as typeof fetch;
}

describe('PersonioAdapter', () => {
  it('is a non-OAuth (client-credentials bearer) adapter', () => {
    const adapter = new PersonioAdapter();
    expect(adapter.supportsOAuth).toBe(false);
    expect(adapter.slug).toBe('personio');
  });

  it('listEmployees parses the recorded /v2/persons fixture into HrisEmployeeRecord[]', async () => {
    // Second page is empty → pagination loop terminates.
    const adapter = new PersonioAdapter({
      fetchImpl: fakeFetchReturning([fixture, { success: true, data: [] }]),
    });
    const records = await adapter.listEmployees(creds, {});
    expect(records).toHaveLength(3);
    const first = records[0];
    expect(first?.externalId).toBe('p-1001');
    expect(first?.provider).toBe('PERSONIO');
    expect(first?.attributes.name).toBe('Anna Kowalska');
    expect(first?.attributes.email).toBe('anna.kowalska@example.com');
  });

  it('paginates with offset/limit ≤ 200 and passes updated_since when a cursor is given', async () => {
    const seen: string[] = [];
    const fetchImpl = vi.fn(async (url: string) => {
      seen.push(url);
      return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 });
    }) as unknown as typeof fetch;
    const adapter = new PersonioAdapter({ fetchImpl });
    await adapter.listEmployees(creds, { updatedSince: '2026-06-01T00:00:00Z' });
    expect(seen[0]).toMatch(/limit=200/);
    expect(seen[0]).toMatch(/updated_since=/);
    // limit is never above 200.
    for (const url of seen) {
      const m = url.match(/limit=(\d+)/);
      if (m?.[1]) expect(Number(m[1])).toBeLessThanOrEqual(200);
    }
  });

  it('safeParses a malformed payload without an unsafe cast (no throw on garbage page)', async () => {
    const adapter = new PersonioAdapter({
      fetchImpl: fakeFetchReturning([{ not: 'a persons page' }]),
    });
    const records = await adapter.listEmployees(creds, {});
    expect(records).toEqual([]);
  });

  // Live token-exchange/pull path — auto-runs + flips GREEN when creds land.
  it.skipIf(!process.env.PERSONIO_CLIENT_ID)(
    'performs a live Personio pull when credentials are present',
    async () => {
      const adapter = new PersonioAdapter();
      const records = await adapter.listEmployees(creds, {});
      expect(Array.isArray(records)).toBe(true);
    },
  );
});
