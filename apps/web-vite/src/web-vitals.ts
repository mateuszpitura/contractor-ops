/**
 * Web Vitals reporter for the SPA.
 *
 * Collects LCP, INP, CLS, FCP, TTFB via the official `web-vitals` library
 * and beacons each sample to `${VITE_API_URL}/web-vitals`. The Fastify
 * route there (added in Step 5's port of the legacy `/api/web-vitals`)
 * forwards into PostHog with the same event schema the Next app uses, so
 * the Phase-1 dashboards keep working through the cutover.
 *
 * Implemented as `navigator.sendBeacon` so the report still flies on
 * pagehide; falls back to a keepalive fetch when sendBeacon is missing.
 */

import type { Metric } from 'web-vitals';
import { onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals';
import type { ClientEnv } from './env.js';

export function startWebVitals(env: ClientEnv): void {
  const endpoint = `${env.VITE_API_URL}/web-vitals`;

  const send = (metric: Metric): void => {
    const body = JSON.stringify({
      name: metric.name,
      value: metric.value,
      delta: metric.delta,
      id: metric.id,
      rating: metric.rating,
      navigationType: metric.navigationType,
      // Inline the page locale so PostHog dashboards can break down by
      // region without needing a join against session metadata.
      locale: typeof document === 'undefined' ? undefined : document.documentElement.lang,
      url: typeof window === 'undefined' ? undefined : window.location.pathname,
    });
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon(endpoint, blob);
      return;
    }
    void fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      keepalive: true,
      credentials: 'include',
    });
  };

  onLCP(send);
  onINP(send);
  onCLS(send);
  onFCP(send);
  onTTFB(send);
}
