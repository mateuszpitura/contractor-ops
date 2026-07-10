/**
 * The pure parsers / derivations exported alongside the hooks
 * (`parseUsageDashboard`, `deriveUsageDashboardTier`) are exercised here
 * — they own the tier-fallback contract that the usage dashboard relies
 * on when the subscription row is missing (bug class: rendering
 * "undefined" as the tier name).
 */

import { describe, expect, it } from 'vitest';
import type { UsageDashboardData } from '../hooks/use-billing.js';
import { deriveUsageDashboardTier, parseUsageDashboard } from '../hooks/use-billing.js';

const mockSubscription: UsageDashboardData['subscription'] = {
  tier: 'PRO',
  status: 'ACTIVE',
  trialEnd: null,
  currentPeriodEnd: '2026-12-31T00:00:00.000Z',
  cancelAt: null,
};

const mockUsage: UsageDashboardData = {
  subscription: mockSubscription,
  credits: { balance: 70, allowance: 100, used: 30, topUp: 0, tier: 'PRO' },
  activeContractors: 5,
  includedSeats: 10,
  planConfig: { tiers: [{ id: 'PRO', seatPriceMinor: 1_500 }] },
};

describe('parseUsageDashboard', () => {
  it('returns the wire payload verbatim — no runtime mutation', () => {
    const parsed = parseUsageDashboard(mockUsage);
    expect(parsed).toStrictEqual(mockUsage);
  });

  it('keeps the parser tolerant of nullable subscription (free-tier path)', () => {
    const freeTier: UsageDashboardData = { ...mockUsage, subscription: null };
    const parsed = parseUsageDashboard(freeTier);
    expect(parsed.subscription).toBeNull();
    expect(parsed.credits.balance).toBe(70);
  });
});

describe('deriveUsageDashboardTier', () => {
  it('returns the subscription tier when present', () => {
    expect(deriveUsageDashboardTier(mockSubscription)).toBe('PRO');
  });

  it('falls back to STARTER when subscription is null (free-tier render)', () => {
    expect(deriveUsageDashboardTier(null)).toBe('STARTER');
  });

  it('falls back to STARTER when tier is missing on the row', () => {
    const broken = { ...mockSubscription, tier: undefined as any };
    expect(deriveUsageDashboardTier(broken)).toBe('STARTER');
  });

  it('passes ENTERPRISE through (full-ladder coverage)', () => {
    const enterprise = { ...mockSubscription, tier: 'ENTERPRISE' };
    expect(deriveUsageDashboardTier(enterprise)).toBe('ENTERPRISE');
  });
});
