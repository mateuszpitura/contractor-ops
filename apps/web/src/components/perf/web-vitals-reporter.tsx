'use client';

import { useReportWebVitals } from 'next/web-vitals';

/**
 * Core Web Vitals reporter.
 *
 * Phase C.6.b (production-hardening) — subscribes to next/web-vitals and beacons
 * each metric (LCP, INP, CLS, TTFB, FCP) to `/api/web-vitals`. The route logs
 * the payload via the project Pino pipeline, which ships to Axiom.
 *
 * Transport preference:
 * - `navigator.sendBeacon` — survives page unload, queues against the browser's
 *   beacon budget, returns synchronously. Preferred.
 * - `fetch(..., { keepalive: true })` — fallback when sendBeacon is unavailable
 *   (older browsers, certain WebView contexts). `keepalive` lets the request
 *   complete even if the page is unloading.
 *
 * The fallback `.catch(() => {})` is a deliberate safe-swallow: there is no UX
 * to surface a metric-shipping failure to, and the metric pipeline is
 * best-effort observability rather than a correctness path.
 */
export function WebVitalsReporter() {
  useReportWebVitals(metric => {
    const body = JSON.stringify({
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      delta: metric.delta,
      id: metric.id,
      navigationType: metric.navigationType,
      url: window.location.pathname,
    });

    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon('/api/web-vitals', new Blob([body], { type: 'application/json' }));
      return;
    }

    fetch('/api/web-vitals', {
      method: 'POST',
      body,
      headers: { 'content-type': 'application/json' },
      keepalive: true,
    }).catch(() => {
      // safe-swallow: web-vitals shipping is best-effort observability; no
      // user-facing failure mode. See goals/production-hardening/ Phase C.6.b.
    });
  });

  return null;
}
