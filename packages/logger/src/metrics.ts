import * as Sentry from '@sentry/nextjs';
import { logger } from './index.js';

/**
 * Lightweight metrics helper that records custom metrics as:
 * - Sentry span attributes (visible in traces/dashboards)
 * - Structured log entries (queryable in Axiom)
 *
 * Sentry v9 removed the `metrics` API. Custom metrics are now best
 * tracked via span attributes + structured logs.
 */
export const metrics = {
  /**
   * Increment a counter metric.
   */
  increment(name: string, value = 1, tags?: Record<string, string>) {
    const activeSpan = Sentry.getActiveSpan();
    if (activeSpan) {
      activeSpan.setAttribute(`metric.${name}`, value);
      if (tags) {
        for (const [k, v] of Object.entries(tags)) {
          activeSpan.setAttribute(`metric.${name}.${k}`, v);
        }
      }
    }
    logger.debug({ metric: name, value, type: 'counter', ...tags }, `metric:${name}`);
  },

  /**
   * Record a distribution/histogram value (e.g., duration, size).
   */
  distribution(
    name: string,
    value: number,
    opts?: { unit?: string; tags?: Record<string, string> },
  ) {
    const activeSpan = Sentry.getActiveSpan();
    if (activeSpan) {
      activeSpan.setAttribute(`metric.${name}`, value);
      if (opts?.unit) {
        activeSpan.setAttribute(`metric.${name}.unit`, opts.unit);
      }
    }
    logger.debug(
      { metric: name, value, type: 'distribution', unit: opts?.unit, ...opts?.tags },
      `metric:${name}`,
    );
  },

  /**
   * Set a gauge value (e.g., queue depth, active count).
   */
  gauge(name: string, value: number, tags?: Record<string, string>) {
    const activeSpan = Sentry.getActiveSpan();
    if (activeSpan) {
      activeSpan.setAttribute(`metric.${name}`, value);
    }
    logger.debug({ metric: name, value, type: 'gauge', ...tags }, `metric:${name}`);
  },
};
