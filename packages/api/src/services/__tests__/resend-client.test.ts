/**
 * Unit tests for resend-client.ts
 *
 * Tests the lazy singleton initialization. Complements the MSW integration
 * test which validates real SDK calls against intercepted HTTP.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { capturedKeys, mockGetServerEnv } = vi.hoisted(() => {
  const capturedKeys: string[] = [];
  const mockGetServerEnv = vi.fn().mockReturnValue({
    RESEND_API_KEY: 're_test_unit_key',
  });
  return { capturedKeys, mockGetServerEnv };
});

vi.mock('resend', () => ({
  Resend: class MockResend {
    apiKey: string;
    emails = { send: vi.fn() };
    constructor(apiKey: string) {
      this.apiKey = apiKey;
      capturedKeys.push(apiKey);
    }
  },
}));

vi.mock('@contractor-ops/validators', () => ({
  getServerEnv: mockGetServerEnv,
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getResend', () => {
  beforeEach(() => {
    vi.resetModules();
    capturedKeys.length = 0;
    mockGetServerEnv.mockReturnValue({ RESEND_API_KEY: 're_test_unit_key' });
  });

  it('returns a Resend instance', async () => {
    const { getResend } = await import('../resend-client.js');
    const client = getResend();

    expect(client).toBeDefined();
    expect(client.emails).toBeDefined();
    expect(capturedKeys).toEqual(['re_test_unit_key']);
  });

  it('returns the same instance on subsequent calls (singleton)', async () => {
    const { getResend } = await import('../resend-client.js');
    const first = getResend();
    const second = getResend();

    expect(first).toBe(second);
    // Constructor should only be called once
    expect(capturedKeys).toHaveLength(1);
  });

  it('reads RESEND_API_KEY from server env', async () => {
    mockGetServerEnv.mockReturnValue({ RESEND_API_KEY: 're_custom_key' });

    const { getResend } = await import('../resend-client.js');
    getResend();

    expect(mockGetServerEnv).toHaveBeenCalled();
    expect(capturedKeys).toEqual(['re_custom_key']);
  });
});
