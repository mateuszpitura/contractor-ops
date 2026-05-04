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

import { mapUpsStatus, UPS_STATUS_MAP } from '../ups-status-mapper';

// ---------------------------------------------------------------------------
// UPS Status Mapper Tests
// ---------------------------------------------------------------------------

describe('UPS Status Mapper', () => {
  describe('UPS_STATUS_MAP', () => {
    it('covers at least 6 UPS type codes', () => {
      expect(Object.keys(UPS_STATUS_MAP).length).toBeGreaterThanOrEqual(6);
    });

    it('maps D (Delivered) to DELIVERED', () => {
      expect(UPS_STATUS_MAP.D).toBe('DELIVERED');
    });

    it('maps I (In Transit) to IN_TRANSIT', () => {
      expect(UPS_STATUS_MAP.I).toBe('IN_TRANSIT');
    });

    it('maps M (Manifest) to CREATED', () => {
      expect(UPS_STATUS_MAP.M).toBe('CREATED');
    });

    it('maps P (Picked Up) to PICKED_UP', () => {
      expect(UPS_STATUS_MAP.P).toBe('PICKED_UP');
    });

    it('maps O (Out for Delivery) to OUT_FOR_DELIVERY', () => {
      expect(UPS_STATUS_MAP.O).toBe('OUT_FOR_DELIVERY');
    });

    it('maps X (Exception) to FAILED', () => {
      expect(UPS_STATUS_MAP.X).toBe('FAILED');
    });

    it('maps RS (Returned) to RETURNED', () => {
      expect(UPS_STATUS_MAP.RS).toBe('RETURNED');
    });
  });

  describe('mapUpsStatus', () => {
    it('returns mapped status for known UPS type code', () => {
      expect(mapUpsStatus('D')).toBe('DELIVERED');
    });

    it('returns null for unknown type code and logs warning', () => {
      mockWarn.mockClear();
      const result = mapUpsStatus('UNKNOWN');
      expect(result).toBeNull();
      expect(mockWarn).toHaveBeenCalled();
    });
  });
});
