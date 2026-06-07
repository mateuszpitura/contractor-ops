import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the client module before importing region
vi.mock('../client.js', () => ({
  createPrismaClientForUrl: vi.fn((url: string) => ({
    _connectionUrl: url,
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  })),
}));

import { createPrismaClientForUrl } from '../client.js';
import { getRegionalClient, preWarmRegionalClients, SUPPORTED_REGIONS } from '../region.js';

describe('SUPPORTED_REGIONS', () => {
  it('contains exactly EU, ME and US', () => {
    expect(SUPPORTED_REGIONS).toEqual(['EU', 'ME', 'US']);
  });
});

describe('getRegionalClient', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset the client pool between tests
    const g = globalThis as unknown as { regionalClients?: Map<string, unknown> };
    g.regionalClients = undefined;

    process.env = {
      ...originalEnv,
      DATABASE_URL_EU: 'postgresql://eu-host/neondb',
      DATABASE_URL_ME: 'postgresql://me-host/neondb-me',
    };

    vi.mocked(createPrismaClientForUrl).mockClear();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns a PrismaClient connected to DATABASE_URL_EU for EU region', () => {
    const client = getRegionalClient('EU');
    expect(createPrismaClientForUrl).toHaveBeenCalledWith('postgresql://eu-host/neondb');
    expect(client).toBeDefined();
  });

  it('returns a PrismaClient connected to DATABASE_URL_ME for ME region', () => {
    const client = getRegionalClient('ME');
    expect(createPrismaClientForUrl).toHaveBeenCalledWith('postgresql://me-host/neondb-me');
    expect(client).toBeDefined();
  });

  it('returns the same cached instance when called twice for EU', () => {
    const first = getRegionalClient('EU');
    const second = getRegionalClient('EU');
    expect(first).toBe(second);
    expect(createPrismaClientForUrl).toHaveBeenCalledTimes(1);
  });

  it('throws an error for an unsupported region', () => {
    expect(() => getRegionalClient('INVALID')).toThrow(
      'Unsupported data region: INVALID. Supported: EU, ME, US',
    );
  });

  it('throws an error when env var is not set', () => {
    delete process.env.DATABASE_URL_ME;
    expect(() => getRegionalClient('ME')).toThrow(
      'DATABASE_URL_ME environment variable is not set for region ME',
    );
  });
});

describe('preWarmRegionalClients', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    const g = globalThis as unknown as { regionalClients?: Map<string, unknown> };
    g.regionalClients = undefined;

    process.env = {
      ...originalEnv,
      DATABASE_URL_EU: 'postgresql://eu-host/neondb',
      // DATABASE_URL_ME intentionally missing
    };

    vi.mocked(createPrismaClientForUrl).mockClear();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('warms available regions and skips unconfigured ones', () => {
    preWarmRegionalClients();
    // Only EU should be created (ME env var missing)
    expect(createPrismaClientForUrl).toHaveBeenCalledTimes(1);
    expect(createPrismaClientForUrl).toHaveBeenCalledWith('postgresql://eu-host/neondb');
  });
});
