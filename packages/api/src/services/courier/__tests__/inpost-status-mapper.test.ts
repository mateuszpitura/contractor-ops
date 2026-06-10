import { describe, expect, it, vi } from 'vitest';

const { mockWarn } = vi.hoisted(() => ({ mockWarn: vi.fn() }));

vi.mock('@contractor-ops/logger', () => {
  const stub = {
    info: vi.fn(),
    warn: mockWarn,
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
  };
  return {
    runWithRequestContext: vi.fn((_c, fn) => fn()),
    getRequestId: vi.fn(() => undefined),
    getTraceparent: vi.fn(() => undefined),
    buildContextFromHeaders: vi.fn(() => ({})),
    getOutboundHeaders: vi.fn(() => ({})),
    generateRequestId: vi.fn(() => 'test-request-id'),
    withBodyLogging: vi.fn((_o, fn) => fn),
    logIntegrationCall: vi.fn(),
    subscribeOpossumEvents: vi.fn(),
    LOG_BODY_INCLUDE_PREFIXES: [],
    PII_MASK_KEYWORDS: [],
    PII_MASK_PATHS: [],

    createLogger: vi.fn(() => stub),

    createTrpcLogger: vi.fn(() => stub),
    createCronLogger: vi.fn(() => stub),
    createWebhookLogger: vi.fn(() => stub),
    createIntegrationLogger: vi.fn(() => stub),
  };
});

import { INPOST_STATUS_MAP, mapInPostStatus, NOTIFICATION_STATUSES } from '../inpost-status-mapper';

// ---------------------------------------------------------------------------
// InPost Status Mapper Tests
// ---------------------------------------------------------------------------

describe('INPOST_STATUS_MAP', () => {
  it('maps all known ShipX statuses to ShipmentStatus values', () => {
    const validStatuses = new Set([
      'CREATED',
      'LABEL_GENERATED',
      'PICKED_UP',
      'IN_TRANSIT',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
      'FAILED',
      'RETURNED',
    ]);

    for (const [_shipxStatus, mapped] of Object.entries(INPOST_STATUS_MAP)) {
      expect(validStatuses.has(mapped)).toBe(true);
    }
  });

  it('contains all 17 expected ShipX statuses', () => {
    expect(Object.keys(INPOST_STATUS_MAP)).toHaveLength(17);
  });

  const expectedMappings: [string, string][] = [
    ['created', 'CREATED'],
    ['offers_prepared', 'CREATED'],
    ['offer_selected', 'CREATED'],
    ['confirmed', 'LABEL_GENERATED'],
    ['dispatched_by_sender', 'PICKED_UP'],
    ['collected_from_sender', 'PICKED_UP'],
    ['taken_by_courier', 'PICKED_UP'],
    ['adopted_at_source_branch', 'IN_TRANSIT'],
    ['sent_from_source_branch', 'IN_TRANSIT'],
    ['out_for_delivery', 'OUT_FOR_DELIVERY'],
    ['ready_to_pickup', 'OUT_FOR_DELIVERY'],
    ['delivered', 'DELIVERED'],
    ['picked_up_by_receiver', 'DELIVERED'],
    ['avizo', 'OUT_FOR_DELIVERY'],
    ['claimed', 'FAILED'],
    ['returned_to_sender', 'RETURNED'],
    ['not_delivered', 'FAILED'],
  ];

  it.each(expectedMappings)('maps %s to %s', (shipxStatus, expected) => {
    expect(INPOST_STATUS_MAP[shipxStatus]).toBe(expected);
  });
});

describe('mapInPostStatus', () => {
  it('returns mapped status for known ShipX status', () => {
    expect(mapInPostStatus('delivered')).toBe('DELIVERED');
    expect(mapInPostStatus('confirmed')).toBe('LABEL_GENERATED');
    expect(mapInPostStatus('taken_by_courier')).toBe('PICKED_UP');
  });

  it('returns null for unknown status and does not throw', () => {
    mockWarn.mockClear();
    const result = mapInPostStatus('some_unknown_status');

    expect(result).toBeNull();
    expect(mockWarn).toHaveBeenCalled();
  });
});

describe('NOTIFICATION_STATUSES', () => {
  it('contains exactly DELIVERED, FAILED, RETURNED', () => {
    expect(NOTIFICATION_STATUSES).toEqual(['DELIVERED', 'FAILED', 'RETURNED']);
  });

  it('has length 3', () => {
    expect(NOTIFICATION_STATUSES).toHaveLength(3);
  });
});
