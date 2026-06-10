// ---------------------------------------------------------------------------
// Read-replica routing tests
// ---------------------------------------------------------------------------
//
// Covers the four guarantees of `replica.ts`:
//   1. No `DATABASE_URL_<REGION>_RO` set → both helpers transparently return
//      the writer client (zero replica connections allocated).
//   2. Replica configured + healthy → `readReplica` runs the callback against
//      the replica client.
//   3. Replica throws → fall back to the writer (best-effort) and the writer
//      result is returned to the caller.
//   4. After 5+ failures inside the rolling window the breaker trips and
//      subsequent reads short-circuit to the writer without even touching
//      the replica.
//
// The test mocks `createPrismaClientForUrl` to avoid touching the real
// Prisma binary; we only care that the right URL is selected and the right
// callback receives the right client.
// ---------------------------------------------------------------------------

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock client factory + region module before importing replica.
type FakeClient = { _id: string; _connectionUrl: string };

const writerClients = new Map<string, FakeClient>();

vi.mock('../client.js', () => ({
  createPrismaClientForUrl: vi.fn((url: string) => ({
    _id: `replica:${url}`,
    _connectionUrl: url,
  })),
}));

vi.mock('../region.js', async () => {
  const actual = await vi.importActual<typeof import('../region.js')>('../region.js');
  return {
    ...actual,
    getRegionalClient: vi.fn((region: string) => {
      const cached = writerClients.get(region);
      if (cached) return cached;
      const fresh = { _id: `writer:${region}`, _connectionUrl: `writer-${region}` };
      writerClients.set(region, fresh);
      return fresh;
    }),
  };
});

import { createPrismaClientForUrl } from '../client.js';
import type { PrismaClient } from '../generated/prisma/client/client.js';
import { getRegionalClient } from '../region.js';
import { getReplicaClient, readReplica, resetReplicaStateForTests } from '../replica.js';

const originalEnv = process.env;

beforeEach(() => {
  resetReplicaStateForTests();
  writerClients.clear();
  vi.mocked(createPrismaClientForUrl).mockClear();
  vi.mocked(getRegionalClient).mockClear();
  process.env = { ...originalEnv };
  delete process.env.DATABASE_URL_EU_RO;
  delete process.env.DATABASE_URL_ME_RO;
  delete process.env.RLS_POLICIES_ENFORCED;
});

afterEach(() => {
  process.env = originalEnv;
});

// ---------------------------------------------------------------------------
// 1. Unconfigured replica → writer fallback
// ---------------------------------------------------------------------------

describe('getReplicaClient', () => {
  it('returns the writer when DATABASE_URL_EU_RO is unset', () => {
    const client = getReplicaClient('EU');
    expect(client).toBe(writerClients.get('EU'));
    expect(createPrismaClientForUrl).not.toHaveBeenCalled();
    expect(getRegionalClient).toHaveBeenCalledWith('EU');
  });

  it('returns a replica client when DATABASE_URL_EU_RO is set', () => {
    process.env.DATABASE_URL_EU_RO = 'postgresql://eu-replica/neondb';
    const client = getReplicaClient('EU') as unknown as FakeClient;
    expect(client._id).toBe('replica:postgresql://eu-replica/neondb');
    expect(createPrismaClientForUrl).toHaveBeenCalledWith('postgresql://eu-replica/neondb');
  });

  it('caches the replica client across calls', () => {
    process.env.DATABASE_URL_EU_RO = 'postgresql://eu-replica/neondb';
    const a = getReplicaClient('EU');
    const b = getReplicaClient('EU');
    expect(a).toBe(b);
    expect(createPrismaClientForUrl).toHaveBeenCalledTimes(1);
  });

  it('throws on unsupported region', () => {
    expect(() => getReplicaClient('XX' as unknown as 'EU')).toThrow(/Unsupported data region: XX/);
  });
});

// ---------------------------------------------------------------------------
// 2. readReplica routing
// ---------------------------------------------------------------------------

describe('readReplica', () => {
  it('routes to the writer when no replica URL is set', async () => {
    const fn = vi.fn(async (db: PrismaClient) => `ok:${(db as unknown as FakeClient)._id}`);
    const result = await readReplica('EU', fn);
    expect(result).toBe('ok:writer:EU');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(createPrismaClientForUrl).not.toHaveBeenCalled();
  });

  it('routes to the replica when configured + healthy', async () => {
    process.env.DATABASE_URL_EU_RO = 'postgresql://eu-replica/neondb';
    const fn = vi.fn(async (db: PrismaClient) => (db as unknown as FakeClient)._id);
    const result = await readReplica('EU', fn);
    expect(result).toBe('replica:postgresql://eu-replica/neondb');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('falls back to the writer when the replica throws', async () => {
    process.env.DATABASE_URL_EU_RO = 'postgresql://eu-replica/neondb';
    let calls = 0;
    const fn = vi.fn(async (db: PrismaClient) => {
      calls += 1;
      const id = (db as unknown as FakeClient)._id;
      if (id.startsWith('replica:')) {
        throw new Error('replica down');
      }
      return `recovered:${id}`;
    });
    const result = await readReplica('EU', fn);
    expect(result).toBe('recovered:writer:EU');
    expect(calls).toBe(2); // first replica (failed), then writer (recovered)
  });

  it('honours the per-region scope (ME stays writer when only EU has a replica)', async () => {
    process.env.DATABASE_URL_EU_RO = 'postgresql://eu-replica/neondb';
    const fn = vi.fn(async (db: PrismaClient) => (db as unknown as FakeClient)._id);
    const me = await readReplica('ME', fn);
    expect(me).toBe('writer:ME');
    expect(createPrismaClientForUrl).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 3. Circuit breaker fallback after sustained failures
// ---------------------------------------------------------------------------

describe('readReplica circuit breaker', () => {
  it('opens after 5+ failures within the rolling window and short-circuits to the writer', async () => {
    process.env.DATABASE_URL_EU_RO = 'postgresql://eu-replica/neondb';

    // Always fail on replica, succeed on writer.
    const fn = vi.fn(async (db: PrismaClient) => {
      const id = (db as unknown as FakeClient)._id;
      if (id.startsWith('replica:')) {
        throw new Error('replica down');
      }
      return id;
    });

    // First 6 calls all attempt the replica then fall back. opossum needs at
    // least `volumeThreshold` (5) failures with `errorThresholdPercentage`
    // (50%) over the rolling window to flip to OPEN. Six consecutive 100%
    // failures clears that bar comfortably.
    for (let i = 0; i < 6; i++) {
      const result = await readReplica('EU', fn);
      expect(result).toBe('writer:EU');
    }

    // Reset call counter so we can assert the next call NEVER touches the replica.
    fn.mockClear();

    // The 7th call should observe the breaker as OPEN and skip the replica
    // entirely — the inner callback runs exactly once, against the writer.
    const result = await readReplica('EU', fn);
    expect(result).toBe('writer:EU');
    expect(fn).toHaveBeenCalledTimes(1);
    const arg = fn.mock.calls[0]![0] as unknown as FakeClient;
    expect(arg._id).toBe('writer:EU');
  });

  it('resets cleanly between tests via resetReplicaStateForTests', async () => {
    process.env.DATABASE_URL_EU_RO = 'postgresql://eu-replica/neondb';

    // Trip the breaker.
    const fail = vi.fn(async (db: PrismaClient) => {
      const id = (db as unknown as FakeClient)._id;
      if (id.startsWith('replica:')) throw new Error('replica down');
      return id;
    });
    for (let i = 0; i < 6; i++) {
      await readReplica('EU', fail);
    }

    // After a state reset, the breaker is closed again — the next read tries
    // the replica first.
    resetReplicaStateForTests();
    const fn = vi.fn(async (db: PrismaClient) => (db as unknown as FakeClient)._id);
    const result = await readReplica('EU', fn);
    expect(result).toBe('replica:postgresql://eu-replica/neondb');
  });
});

// ---------------------------------------------------------------------------
// 4. RLS-enforcement tripwire
// ---------------------------------------------------------------------------
//
// `readReplica` (and its writer-fallback paths) hand a raw `PrismaClient` to
// the callback — no `withRlsReads` / `withRlsTransactions` / `withTenantScope`.
// Until `CREATE POLICY` migrations land this is masked by callers writing
// explicit `WHERE organization_id = …` predicates. The tripwire flips the
// latent failure into a deterministic boot-time error once policies activate.

describe('readReplica RLS tripwire (NEW-ARCH-01)', () => {
  it('runs as before when RLS_POLICIES_ENFORCED is unset', async () => {
    const fn = vi.fn(async (db: PrismaClient) => (db as unknown as FakeClient)._id);
    const result = await readReplica('EU', fn);
    expect(result).toBe('writer:EU');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('runs as before when RLS_POLICIES_ENFORCED is anything other than "true"', async () => {
    process.env.RLS_POLICIES_ENFORCED = 'false';
    const fn = vi.fn(async (db: PrismaClient) => (db as unknown as FakeClient)._id);
    const result = await readReplica('EU', fn);
    expect(result).toBe('writer:EU');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('throws with a NEW-ARCH-01 reference when RLS_POLICIES_ENFORCED=true', async () => {
    process.env.RLS_POLICIES_ENFORCED = 'true';
    const fn = vi.fn(async (db: PrismaClient) => (db as unknown as FakeClient)._id);
    await expect(readReplica('EU', fn)).rejects.toThrow(/NEW-ARCH-01/);
    expect(fn).not.toHaveBeenCalled();
  });

  it('throws even when a replica URL is configured (covers replica + writer-fallback paths)', async () => {
    process.env.DATABASE_URL_EU_RO = 'postgresql://eu-replica/neondb';
    process.env.RLS_POLICIES_ENFORCED = 'true';
    const fn = vi.fn(async (db: PrismaClient) => (db as unknown as FakeClient)._id);
    await expect(readReplica('EU', fn)).rejects.toThrow(/NEW-ARCH-01/);
    // Tripwire fires at function entry — neither the replica client nor the
    // writer fallback should have been touched.
    expect(fn).not.toHaveBeenCalled();
    expect(createPrismaClientForUrl).not.toHaveBeenCalled();
  });
});
