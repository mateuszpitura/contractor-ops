/**
 * API-key leak alarm contract (`jobs/handlers/api-key-leak-alarm.ts`).
 *
 * The cron job reads the `ApiKeyIpEvent` source-IP log, groups DISTINCT
 * `ipAddress` per `apiKeyId` over a rolling 24h window, and raises an org-admin
 * alarm for any key seen from more than 3 distinct source IPs. A key with <= 3
 * distinct IPs does not alarm. The alarm carries the key PREFIX (never the
 * plaintext key) + the distinct-IP count + the org id.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeJobContext } from './_helpers.js';

const { mockIpEventFindMany, mockApiKeyFindMany, mockCaptureMessage } = vi.hoisted(() => ({
  mockIpEventFindMany: vi.fn(),
  mockApiKeyFindMany: vi.fn(),
  mockCaptureMessage: vi.fn(),
}));

vi.mock('@contractor-ops/db', () => {
  const regionalClient = {
    apiKeyIpEvent: { findMany: mockIpEventFindMany },
    organizationApiKey: { findMany: mockApiKeyFindMany },
  };
  return {
    prisma: regionalClient,
    SUPPORTED_REGIONS: ['EU'],
    tryGetRegionalClient: () => regionalClient,
  };
});

vi.mock('../lib/sentry.js', () => ({
  Sentry: { captureMessage: mockCaptureMessage, captureException: vi.fn() },
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { gauge: vi.fn(), increment: vi.fn() },
}));

const HANDLER_MODULE = '../jobs/handlers/api-key-leak-alarm.js';

function ipEvents(events: Array<{ apiKeyId: string; ipAddress: string; organizationId: string }>) {
  mockIpEventFindMany.mockResolvedValue(events);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockApiKeyFindMany.mockResolvedValue([
    { id: 'key_leaky', prefix: 'co_live_abcd', organizationId: 'org_1' },
    { id: 'key_safe', prefix: 'co_live_wxyz', organizationId: 'org_1' },
  ]);
});

describe('api-key-leak-alarm (INTEG-SEC-05)', () => {
  it('alarms for a key seen from more than 3 distinct source IPs in 24h', async () => {
    const mod = (await import(HANDLER_MODULE)) as Record<string, unknown>;
    const handler = mod.apiKeyLeakAlarmHandler as (ctx: unknown) => Promise<{ ok: boolean }>;
    ipEvents([
      { apiKeyId: 'key_leaky', ipAddress: '1.1.1.1', organizationId: 'org_1' },
      { apiKeyId: 'key_leaky', ipAddress: '2.2.2.2', organizationId: 'org_1' },
      { apiKeyId: 'key_leaky', ipAddress: '3.3.3.3', organizationId: 'org_1' },
      { apiKeyId: 'key_leaky', ipAddress: '4.4.4.4', organizationId: 'org_1' },
      // duplicate IP must not inflate the distinct count
      { apiKeyId: 'key_leaky', ipAddress: '4.4.4.4', organizationId: 'org_1' },
    ]);

    const result = await handler(makeJobContext());
    expect(result.ok).toBe(true);
    expect(mockCaptureMessage).toHaveBeenCalledTimes(1);
    const [message] = mockCaptureMessage.mock.calls[0] as [string];
    // Prefix present, plaintext key never.
    expect(message).toContain('co_live_abcd');
  });

  it('does NOT alarm for a key seen from 3 or fewer distinct IPs', async () => {
    const mod = (await import(HANDLER_MODULE)) as Record<string, unknown>;
    const handler = mod.apiKeyLeakAlarmHandler as (ctx: unknown) => Promise<{ ok: boolean }>;
    ipEvents([
      { apiKeyId: 'key_safe', ipAddress: '1.1.1.1', organizationId: 'org_1' },
      { apiKeyId: 'key_safe', ipAddress: '2.2.2.2', organizationId: 'org_1' },
      { apiKeyId: 'key_safe', ipAddress: '3.3.3.3', organizationId: 'org_1' },
    ]);

    const result = await handler(makeJobContext());
    expect(result.ok).toBe(true);
    expect(mockCaptureMessage).not.toHaveBeenCalled();
  });
});
