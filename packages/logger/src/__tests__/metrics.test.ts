import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock Sentry and the logger before importing the module under test.
// vi.mock factories are hoisted — avoid referencing outer `const` variables.
// Instead, use vi.hoisted() to define mocks that are accessible in factories.
// ---------------------------------------------------------------------------

const { mockSetAttribute, mockGetActiveSpan, mockDebug } = vi.hoisted(() => ({
  mockSetAttribute: vi.fn(),
  mockGetActiveSpan: vi.fn<() => { setAttribute: (...args: unknown[]) => void } | undefined>(),
  mockDebug: vi.fn(),
}));

vi.mock('@sentry/nextjs', () => ({
  getActiveSpan: mockGetActiveSpan,
}));

vi.mock('../index.js', () => ({
  logger: { debug: mockDebug },
}));

import { metrics } from '../metrics.js';

describe('metrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Helper to toggle span availability
  // ---------------------------------------------------------------------------

  function withActiveSpan() {
    mockGetActiveSpan.mockReturnValue({ setAttribute: mockSetAttribute });
  }

  function withoutActiveSpan() {
    mockGetActiveSpan.mockReturnValue(undefined);
  }

  // ========================================================================
  // metrics.increment
  // ========================================================================
  describe('increment', () => {
    it('sets span attribute when a Sentry span is active', () => {
      withActiveSpan();
      metrics.increment('api.calls', 5);

      expect(mockSetAttribute).toHaveBeenCalledWith('metric.api.calls', 5);
    });

    it('sets tag attributes on the active span', () => {
      withActiveSpan();
      metrics.increment('api.calls', 1, { route: '/invoices', method: 'GET' });

      expect(mockSetAttribute).toHaveBeenCalledWith('metric.api.calls', 1);
      expect(mockSetAttribute).toHaveBeenCalledWith('metric.api.calls.route', '/invoices');
      expect(mockSetAttribute).toHaveBeenCalledWith('metric.api.calls.method', 'GET');
    });

    it('defaults value to 1 when omitted', () => {
      withActiveSpan();
      metrics.increment('requests');

      expect(mockSetAttribute).toHaveBeenCalledWith('metric.requests', 1);
    });

    it('logs a structured debug entry regardless of span availability', () => {
      withoutActiveSpan();
      metrics.increment('cache.miss', 3, { region: 'us-east' });

      expect(mockDebug).toHaveBeenCalledWith(
        { metric: 'cache.miss', value: 3, type: 'counter', region: 'us-east' },
        'metric:cache.miss',
      );
    });

    it('does not throw when no Sentry span is active', () => {
      withoutActiveSpan();
      expect(() => metrics.increment('safe.call')).not.toThrow();
      expect(mockSetAttribute).not.toHaveBeenCalled();
    });
  });

  // ========================================================================
  // metrics.distribution
  // ========================================================================
  describe('distribution', () => {
    it('sets span attribute for distribution value', () => {
      withActiveSpan();
      metrics.distribution('response.time', 142);

      expect(mockSetAttribute).toHaveBeenCalledWith('metric.response.time', 142);
    });

    it('sets unit attribute on span when provided', () => {
      withActiveSpan();
      metrics.distribution('payload.size', 2048, { unit: 'bytes' });

      expect(mockSetAttribute).toHaveBeenCalledWith('metric.payload.size', 2048);
      expect(mockSetAttribute).toHaveBeenCalledWith('metric.payload.size.unit', 'bytes');
    });

    it('logs a structured debug entry with unit and tags', () => {
      withoutActiveSpan();
      metrics.distribution('db.query', 35, { unit: 'ms', tags: { table: 'invoices' } });

      expect(mockDebug).toHaveBeenCalledWith(
        { metric: 'db.query', value: 35, type: 'distribution', unit: 'ms', table: 'invoices' },
        'metric:db.query',
      );
    });

    it('handles missing opts gracefully', () => {
      withActiveSpan();
      expect(() => metrics.distribution('simple', 10)).not.toThrow();
      expect(mockSetAttribute).toHaveBeenCalledWith('metric.simple', 10);
    });

    it('does not set unit attribute when unit is omitted', () => {
      withActiveSpan();
      metrics.distribution('no.unit', 5, { tags: { env: 'test' } });

      expect(mockSetAttribute).toHaveBeenCalledWith('metric.no.unit', 5);
      expect(mockSetAttribute).not.toHaveBeenCalledWith(
        'metric.no.unit.unit',
        expect.anything(),
      );
    });

    it('does not throw when no Sentry span is active', () => {
      withoutActiveSpan();
      expect(() => metrics.distribution('safe', 99, { unit: 'ms' })).not.toThrow();
      expect(mockSetAttribute).not.toHaveBeenCalled();
    });
  });

  // ========================================================================
  // metrics.gauge
  // ========================================================================
  describe('gauge', () => {
    it('sets span attribute for gauge value', () => {
      withActiveSpan();
      metrics.gauge('queue.depth', 42);

      expect(mockSetAttribute).toHaveBeenCalledWith('metric.queue.depth', 42);
    });

    it('logs a structured debug entry with tags', () => {
      withoutActiveSpan();
      metrics.gauge('active.connections', 8, { pool: 'primary' });

      expect(mockDebug).toHaveBeenCalledWith(
        { metric: 'active.connections', value: 8, type: 'gauge', pool: 'primary' },
        'metric:active.connections',
      );
    });

    it('does not throw when no Sentry span is active', () => {
      withoutActiveSpan();
      expect(() => metrics.gauge('safe.gauge', 0)).not.toThrow();
      expect(mockSetAttribute).not.toHaveBeenCalled();
    });

    it('logs even without tags', () => {
      withoutActiveSpan();
      metrics.gauge('workers', 4);

      expect(mockDebug).toHaveBeenCalledWith(
        { metric: 'workers', value: 4, type: 'gauge' },
        'metric:workers',
      );
    });
  });
});
