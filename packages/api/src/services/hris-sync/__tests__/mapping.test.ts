import { describe, expect, it } from 'vitest';

import {
  defaultMappingFor,
  hrisFieldMappingSchema,
  publicHrisConfig,
  readSyncState,
  resolveMapping,
  writeSyncState,
} from '../mapping';

describe('hrisFieldMappingSchema', () => {
  it('accepts a valid standard + customAttributes mapping', () => {
    const parsed = hrisFieldMappingSchema.safeParse({
      standard: { displayName: 'name', email: 'email' },
      customAttributes: { cost_center: 'costCenter' },
    });
    expect(parsed.success).toBe(true);
  });

  it('.strict() rejects an unknown top-level key', () => {
    const parsed = hrisFieldMappingSchema.safeParse({ standard: {}, evil: 'x' });
    expect(parsed.success).toBe(false);
  });

  it('.strict() rejects an unknown standard key', () => {
    const parsed = hrisFieldMappingSchema.safeParse({ standard: { peselEncrypted: 'x' } });
    expect(parsed.success).toBe(false);
  });
});

describe('resolveMapping', () => {
  it('round-trips a configured mapping', () => {
    const mapping = resolveMapping({ mapping: { standard: { displayName: 'name' } } });
    expect(mapping.standard.displayName).toBe('name');
  });

  it('returns an empty mapping for an absent or invalid blob (never throws)', () => {
    expect(resolveMapping(undefined).standard).toEqual({});
    expect(resolveMapping({ mapping: { standard: { bad: 1 } } }).standard).toEqual({});
    expect(resolveMapping('garbage').standard).toEqual({});
  });
});

describe('defaultMappingFor', () => {
  it('gives Personio + BambooHR conventional attribute names', () => {
    expect(defaultMappingFor('PERSONIO').standard.email).toBe('email');
    expect(defaultMappingFor('BAMBOOHR').standard.email).toBe('workEmail');
  });
});

describe('sync-state', () => {
  it('reads and writes the snapshot-diff hash map round-trip', () => {
    const written = writeSyncState(
      { mapping: { standard: {} } },
      { lastSuccessfulSyncAt: '2026-07-01T00:00:00Z', hashes: { 'p-1': 'h1' } },
    );
    const state = readSyncState(written);
    expect(state.lastSuccessfulSyncAt).toBe('2026-07-01T00:00:00Z');
    expect(state.hashes).toEqual({ 'p-1': 'h1' });
    // Mapping survives the sync-state write.
    expect(resolveMapping(written).standard).toEqual({});
  });
});

describe('publicHrisConfig', () => {
  it('exposes only the mapping — never credentialsRef or raw sync-state', () => {
    const config = {
      mapping: { standard: { displayName: 'name' } },
      syncState: { lastSuccessfulSyncAt: '2026-07-01T00:00:00Z', hashes: { 'p-1': 'secret-hash' } },
      credentialsRef: 'enc:should-never-appear',
    };
    const projected = publicHrisConfig(config);
    expect(projected).toEqual({ mapping: { standard: { displayName: 'name' } } });
    const serialized = JSON.stringify(projected);
    expect(serialized).not.toContain('secret-hash');
    expect(serialized).not.toContain('credentialsRef');
    expect(serialized).not.toContain('syncState');
  });
});
