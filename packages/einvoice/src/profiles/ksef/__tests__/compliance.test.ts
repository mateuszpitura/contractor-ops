// KSeF compliance status — edge cases and state derivation.

import { describe, expect, it } from 'vitest';

import type { KsefConnectionData } from '../compliance.js';
import { computeKsefComplianceStatus } from '../compliance.js';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function makeConnection(overrides?: Partial<KsefConnectionData>): KsefConnectionData {
  return {
    status: 'CONNECTED',
    configJson: null,
    lastSyncAt: new Date(),
    lastSuccessAt: new Date(),
    lastErrorAt: null,
    lastErrorMessage: null,
    connectedAt: new Date(),
    recentSyncStatuses: ['SUCCESS'],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('computeKsefComplianceStatus', () => {
  it('returns notConnected with healthScore 0 when connection is null', () => {
    const result = computeKsefComplianceStatus(null);

    expect(result.state).toBe('notConnected');
    expect(result.healthScore).toBe(0);
    expect(result.profileId).toBe('ksef');
    expect(result.country).toBe('PL');
    expect(result.displayName).toBe('KSeF (Poland)');
    expect(result.capabilities).toEqual({
      canGenerate: true,
      canParse: true,
      canSign: false,
      canQRCode: false,
    });
  });

  it('returns suspended when connection status is DISCONNECTED', () => {
    const result = computeKsefComplianceStatus(
      makeConnection({ status: 'DISCONNECTED' }),
    );

    expect(result.state).toBe('suspended');
  });

  it('returns error when connection status is ERROR', () => {
    const result = computeKsefComplianceStatus(
      makeConnection({ status: 'ERROR' }),
    );

    expect(result.state).toBe('error');
  });

  it('returns error when connection status is REAUTH_REQUIRED', () => {
    const result = computeKsefComplianceStatus(
      makeConnection({ status: 'REAUTH_REQUIRED' }),
    );

    expect(result.state).toBe('error');
  });

  it('returns sandbox when config environment is test', () => {
    const result = computeKsefComplianceStatus(
      makeConnection({ configJson: { environment: 'test' } }),
    );

    expect(result.state).toBe('sandbox');
  });

  it('returns active with healthScore 100 when all syncs succeeded', () => {
    const result = computeKsefComplianceStatus(
      makeConnection({
        recentSyncStatuses: ['SUCCESS', 'SUCCESS', 'SUCCESS', 'SUCCESS', 'SUCCESS'],
      }),
    );

    expect(result.state).toBe('active');
    expect(result.healthScore).toBe(100);
  });

  it('returns degraded with correct healthScore when syncs are mixed', () => {
    const result = computeKsefComplianceStatus(
      makeConnection({
        recentSyncStatuses: ['SUCCESS', 'FAILED', 'SUCCESS', 'SUCCESS', 'FAILED'],
      }),
    );

    expect(result.state).toBe('degraded');
    // 3 SUCCESS out of 5 = 60%
    expect(result.healthScore).toBe(60);
  });

  it('returns active with healthScore 0 when recentSyncStatuses is empty', () => {
    const result = computeKsefComplianceStatus(
      makeConnection({ recentSyncStatuses: [] }),
    );

    expect(result.state).toBe('active');
    expect(result.healthScore).toBe(0);
  });
});
