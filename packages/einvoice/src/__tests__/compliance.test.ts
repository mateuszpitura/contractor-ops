import { describe, expect, it } from 'vitest';
import type { KsefConnectionData } from '../profiles/ksef/compliance.js';
import { computeKsefComplianceStatus } from '../profiles/ksef/compliance.js';

describe('computeKsefComplianceStatus', () => {
  it('returns notConnected when no connection exists', () => {
    const result = computeKsefComplianceStatus(null);
    expect(result.state).toBe('notConnected');
    expect(result.profileId).toBe('ksef');
    expect(result.healthScore).toBe(0);
  });

  it('returns active when connection is CONNECTED with successful syncs', () => {
    const connection: KsefConnectionData = {
      status: 'CONNECTED',
      configJson: { environment: 'prod' },
      lastSyncAt: new Date(),
      lastSuccessAt: new Date(),
      lastErrorAt: null,
      lastErrorMessage: null,
      connectedAt: new Date(),
      recentSyncStatuses: ['SUCCESS', 'SUCCESS', 'SUCCESS'],
    };
    const result = computeKsefComplianceStatus(connection);
    expect(result.state).toBe('active');
    expect(result.healthScore).toBe(100);
  });

  it('returns degraded when connection has recent errors', () => {
    const connection: KsefConnectionData = {
      status: 'CONNECTED',
      configJson: { environment: 'prod' },
      lastSyncAt: new Date(),
      lastSuccessAt: new Date(),
      lastErrorAt: new Date(),
      lastErrorMessage: 'Timeout',
      connectedAt: new Date(),
      recentSyncStatuses: ['SUCCESS', 'FAILED', 'SUCCESS'],
    };
    const result = computeKsefComplianceStatus(connection);
    expect(result.state).toBe('degraded');
    expect(result.healthScore).toBe(67);
  });

  it('returns error when connection status is ERROR', () => {
    const connection: KsefConnectionData = {
      status: 'ERROR',
      configJson: null,
      lastSyncAt: new Date(),
      lastSuccessAt: null,
      lastErrorAt: new Date(),
      lastErrorMessage: 'Auth failed',
      connectedAt: new Date(),
      recentSyncStatuses: ['FAILED'],
    };
    const result = computeKsefComplianceStatus(connection);
    expect(result.state).toBe('error');
  });

  it('returns suspended when connection is DISCONNECTED', () => {
    const connection: KsefConnectionData = {
      status: 'DISCONNECTED',
      configJson: null,
      lastSyncAt: null,
      lastSuccessAt: null,
      lastErrorAt: null,
      lastErrorMessage: null,
      connectedAt: new Date(),
      recentSyncStatuses: [],
    };
    const result = computeKsefComplianceStatus(connection);
    expect(result.state).toBe('suspended');
  });

  it('returns sandbox when config environment is test', () => {
    const connection: KsefConnectionData = {
      status: 'CONNECTED',
      configJson: { environment: 'test' },
      lastSyncAt: new Date(),
      lastSuccessAt: new Date(),
      lastErrorAt: null,
      lastErrorMessage: null,
      connectedAt: new Date(),
      recentSyncStatuses: ['SUCCESS'],
    };
    const result = computeKsefComplianceStatus(connection);
    expect(result.state).toBe('sandbox');
  });

  it('returns error when connection status is REAUTH_REQUIRED', () => {
    const connection: KsefConnectionData = {
      status: 'REAUTH_REQUIRED',
      configJson: null,
      lastSyncAt: new Date(),
      lastSuccessAt: null,
      lastErrorAt: new Date(),
      lastErrorMessage: 'Token expired',
      connectedAt: new Date(),
      recentSyncStatuses: [],
    };
    const result = computeKsefComplianceStatus(connection);
    expect(result.state).toBe('error');
  });

  it('healthScore is 0 when all syncs failed', () => {
    const connection: KsefConnectionData = {
      status: 'CONNECTED',
      configJson: { environment: 'prod' },
      lastSyncAt: new Date(),
      lastSuccessAt: null,
      lastErrorAt: new Date(),
      lastErrorMessage: 'Error',
      connectedAt: new Date(),
      recentSyncStatuses: ['FAILED', 'FAILED', 'FAILED'],
    };
    const result = computeKsefComplianceStatus(connection);
    expect(result.healthScore).toBe(0);
    expect(result.state).toBe('degraded');
  });

  it('capabilities reflect KSeF — canSign and canQRCode are false', () => {
    const result = computeKsefComplianceStatus(null);
    expect(result.capabilities.canGenerate).toBe(true);
    expect(result.capabilities.canParse).toBe(true);
    expect(result.capabilities.canSign).toBe(false);
    expect(result.capabilities.canQRCode).toBe(false);
  });
});
