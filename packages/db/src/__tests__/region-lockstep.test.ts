// Phase 82 · Plan 01 · FOUND7-03 (SC#3) — Wave 0 RED scaffold.
//
// Asserts the US-region "lockstep": every region-set source must hold an
// identical set that includes 'US'. RED is the expected Wave 0 state —
// `SUPPORTED_REGIONS` is still `['EU','ME']`; Plan 82-02 adds 'US' (the
// 4-place atomic change), which also force-fails tsc at `REGION_ENV_MAP` and
// `REPLICA_ENV_MAP` (`Record<DataRegion,string>`) until each gains a US entry.
// Do NOT add US to regions here.
//
// Scope note: the canonical 5th source `regionSchema.options` lives in
// `@contractor-ops/feature-flags` (no dependency edge to `@contractor-ops/db`),
// so its EU/ME/US lockstep is asserted in the feature-flags suite. This file
// pins the db-reachable sources (`SUPPORTED_REGIONS` + the two env maps via
// `getRegionalClient` / `getReplicaClient`).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../client.js', () => ({
  createPrismaClientForUrl: vi.fn((url: string) => ({
    _connectionUrl: url,
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  })),
}));

import { getRegionalClient, SUPPORTED_REGIONS } from '../region.js';
import { getReplicaClient, resetReplicaStateForTests } from '../replica.js';

const EXPECTED_REGIONS = ['EU', 'ME', 'US'] as const;
const asSet = (xs: readonly string[]) => new Set(xs);

describe('US region lockstep (SC#3)', () => {
  it('SUPPORTED_REGIONS holds exactly the EU/ME/US set', () => {
    expect(asSet(SUPPORTED_REGIONS)).toEqual(asSet(EXPECTED_REGIONS));
  });

  it("SUPPORTED_REGIONS includes 'US'", () => {
    expect(SUPPORTED_REGIONS).toContain('US' as (typeof SUPPORTED_REGIONS)[number]);
  });
});

describe('getRegionalClient / getReplicaClient accept US (SC#3)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    const g = globalThis as unknown as { regionalClients?: Map<string, unknown> };
    g.regionalClients = undefined;
    resetReplicaStateForTests();
    // US writer/replica env intentionally UNSET — US must be a *recognized*
    // region (no "Unsupported data region" throw); the only permissible throw
    // is the lazy missing-env one (D-06).
    process.env = {
      ...originalEnv,
      DATABASE_URL_EU: 'postgresql://eu-host/neondb',
      DATABASE_URL_ME: 'postgresql://me-host/neondb-me',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    resetReplicaStateForTests();
  });

  it('getRegionalClient("US") does NOT throw "Unsupported data region" (lazy missing-env only)', () => {
    // With DATABASE_URL_US unset, the call still must not reject US as an
    // unsupported region — it should throw only the missing-env error, proving
    // US is in SUPPORTED_REGIONS + REGION_ENV_MAP.
    expect(() => getRegionalClient('US')).not.toThrow(/Unsupported data region/);
    expect(() => getRegionalClient('US')).toThrow(/DATABASE_URL_US/);
  });

  it('getReplicaClient("US") does NOT throw "Unsupported data region" (falls back to writer)', () => {
    // No US replica env → getReplicaClient falls back to the writer via
    // getRegionalClient('US'); the writer env is also unset, so the only throw
    // is the missing writer-env one — never "Unsupported data region".
    expect(() => getReplicaClient('US' as never)).not.toThrow(/Unsupported data region/);
  });
});
