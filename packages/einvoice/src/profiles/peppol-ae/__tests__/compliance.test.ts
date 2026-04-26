import { describe, expect, it } from 'vitest';
import { computePeppolComplianceStatus } from '../index.js';

describe('computePeppolComplianceStatus', () => {
  // -------------------------------------------------------------------------
  // null / not connected
  // -------------------------------------------------------------------------

  it('returns notConnected when no data provided', () => {
    const result = computePeppolComplianceStatus(null);
    expect(result.state).toBe('notConnected');
    expect(result.profileId).toBe('peppol-ae');
    expect(result.country).toBe('AE');
    expect(result.displayName).toBe('Peppol PINT-AE (UAE)');
    expect(result.healthScore).toBe(0);
  });

  it('returns correct capabilities', () => {
    const result = computePeppolComplianceStatus(null);
    expect(result.capabilities).toEqual({
      canGenerate: true,
      canParse: true,
      canSign: false,
      canQRCode: true,
    });
  });

  // -------------------------------------------------------------------------
  // State mapping
  // -------------------------------------------------------------------------

  it('maps PENDING to onboarding', () => {
    const result = computePeppolComplianceStatus({ status: 'PENDING' });
    expect(result.state).toBe('onboarding');
  });

  it('maps REGISTERED to onboarding', () => {
    const result = computePeppolComplianceStatus({ status: 'REGISTERED' });
    expect(result.state).toBe('onboarding');
  });

  it('maps ACTIVE to active', () => {
    const result = computePeppolComplianceStatus({ status: 'ACTIVE' });
    expect(result.state).toBe('active');
  });

  it('maps SUSPENDED to suspended', () => {
    const result = computePeppolComplianceStatus({ status: 'SUSPENDED' });
    expect(result.state).toBe('suspended');
  });

  it('maps DEREGISTERED to notConnected', () => {
    const result = computePeppolComplianceStatus({ status: 'DEREGISTERED' });
    expect(result.state).toBe('notConnected');
  });

  it('maps unknown status to error', () => {
    const result = computePeppolComplianceStatus({ status: 'UNKNOWN_STATUS' });
    expect(result.state).toBe('error');
  });

  // -------------------------------------------------------------------------
  // Health score
  // -------------------------------------------------------------------------

  it('returns 100 health score for active with no failures', () => {
    const result = computePeppolComplianceStatus({
      status: 'ACTIVE',
      sentCount: 10,
      receivedCount: 5,
      failedCount: 0,
    });
    expect(result.healthScore).toBe(100);
  });

  it('returns 100 health score for active with zero total', () => {
    const result = computePeppolComplianceStatus({ status: 'ACTIVE' });
    expect(result.healthScore).toBe(100);
  });

  it('calculates health score degraded by failures', () => {
    const result = computePeppolComplianceStatus({
      status: 'ACTIVE',
      sentCount: 7,
      receivedCount: 3,
      failedCount: 5,
    });
    // total = 7 + 3 = 10, failed = 5, score = (10 - 5) / 10 = 50%
    expect(result.healthScore).toBe(50);
  });

  it('returns 0 health score for non-active state', () => {
    const result = computePeppolComplianceStatus({
      status: 'PENDING',
      sentCount: 5,
      failedCount: 0,
    });
    expect(result.healthScore).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Optional fields
  // -------------------------------------------------------------------------

  it('includes error info when provided', () => {
    const errorDate = new Date('2026-04-10');
    const result = computePeppolComplianceStatus({
      status: 'ACTIVE',
      lastErrorAt: errorDate,
      lastErrorMessage: 'Timeout',
    });
    expect(result.lastErrorAt).toBe(errorDate);
    expect(result.lastErrorMessage).toBe('Timeout');
  });
});
