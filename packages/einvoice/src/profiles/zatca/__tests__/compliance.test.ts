import { describe, expect, it } from 'vitest';
import type { ZatcaConnectionData } from '../compliance.js';
import { computeZatcaComplianceStatus } from '../compliance.js';

describe('computeZatcaComplianceStatus', () => {
  // -------------------------------------------------------------------------
  // null / not connected
  // -------------------------------------------------------------------------

  it('returns notConnected when no data provided', () => {
    const result = computeZatcaComplianceStatus(null);
    expect(result.state).toBe('notConnected');
    expect(result.profileId).toBe('zatca');
    expect(result.country).toBe('SA');
    expect(result.displayName).toBe('ZATCA (Saudi Arabia)');
    expect(result.healthScore).toBe(0);
  });

  it('returns correct capabilities for notConnected state', () => {
    const result = computeZatcaComplianceStatus(null);
    expect(result.capabilities).toEqual({
      canGenerate: true,
      canParse: true,
      canSign: true,
      canQRCode: true,
    });
  });

  // -------------------------------------------------------------------------
  // State mapping
  // -------------------------------------------------------------------------

  it('maps PENDING_MAPPING to onboarding', () => {
    const result = computeZatcaComplianceStatus({ status: 'PENDING_MAPPING' });
    expect(result.state).toBe('onboarding');
  });

  it('maps CONNECTED to active', () => {
    const result = computeZatcaComplianceStatus({ status: 'CONNECTED' });
    expect(result.state).toBe('active');
  });

  it('maps DISCONNECTED to suspended', () => {
    const result = computeZatcaComplianceStatus({ status: 'DISCONNECTED' });
    expect(result.state).toBe('suspended');
  });

  it('maps ERROR to error', () => {
    const result = computeZatcaComplianceStatus({ status: 'ERROR' });
    expect(result.state).toBe('error');
  });

  it('maps REAUTH_REQUIRED to error', () => {
    const result = computeZatcaComplianceStatus({ status: 'REAUTH_REQUIRED' });
    expect(result.state).toBe('error');
  });

  it('maps unknown status to error', () => {
    const result = computeZatcaComplianceStatus({ status: 'SOME_UNKNOWN' });
    expect(result.state).toBe('error');
  });

  // -------------------------------------------------------------------------
  // Certificate expiry
  // -------------------------------------------------------------------------

  it('changes active to suspended when certificate is expired', () => {
    const result = computeZatcaComplianceStatus({
      status: 'CONNECTED',
      certificateExpiresAt: new Date('2020-01-01'),
    });
    expect(result.state).toBe('suspended');
  });

  it('stays active when certificate is not expired', () => {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    const result = computeZatcaComplianceStatus({
      status: 'CONNECTED',
      certificateExpiresAt: futureDate,
    });
    expect(result.state).toBe('active');
  });

  // -------------------------------------------------------------------------
  // Health score
  // -------------------------------------------------------------------------

  it('calculates health score from success rate', () => {
    const result = computeZatcaComplianceStatus({
      status: 'CONNECTED',
      clearanceCount: 8,
      reportingCount: 2,
      failedCount: 0,
    });
    expect(result.healthScore).toBe(100);
  });

  it('calculates health score with failures', () => {
    const result = computeZatcaComplianceStatus({
      status: 'CONNECTED',
      clearanceCount: 6,
      reportingCount: 2,
      failedCount: 2,
    });
    // 8 successful / 10 total = 80%
    expect(result.healthScore).toBe(80);
  });

  it('returns 100 health score for active with zero submissions', () => {
    const result = computeZatcaComplianceStatus({
      status: 'CONNECTED',
    });
    expect(result.healthScore).toBe(100);
  });

  it('returns 0 health score for non-active with zero submissions', () => {
    const result = computeZatcaComplianceStatus({
      status: 'ERROR',
    });
    expect(result.healthScore).toBe(0);
  });

  it('returns 0 health score when all submissions failed', () => {
    const result = computeZatcaComplianceStatus({
      status: 'CONNECTED',
      clearanceCount: 0,
      reportingCount: 0,
      failedCount: 10,
    });
    expect(result.healthScore).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Optional fields
  // -------------------------------------------------------------------------

  it('includes lastSyncAt and error information when provided', () => {
    const syncDate = new Date('2026-04-10');
    const errorDate = new Date('2026-04-09');
    const result = computeZatcaComplianceStatus({
      status: 'CONNECTED',
      lastSyncAt: syncDate,
      lastErrorAt: errorDate,
      lastErrorMessage: 'Some error',
    });
    expect(result.lastSyncAt).toBe(syncDate);
    expect(result.lastErrorAt).toBe(errorDate);
    expect(result.lastErrorMessage).toBe('Some error');
  });
});
