'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import type { ReactNode } from 'react';
import { Suspense, useEffect, useRef } from 'react';
import { readConsent, subscribeConsent } from './consent';

/**
 * Tracks pageviews on SPA route changes.
 * Deduplicates by URL to prevent double-firing on Suspense remounts.
 * Must be inside Suspense because useSearchParams() requires it in Next.js 15.
 */
function PostHogPageTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastUrl = useRef('');

  useEffect(() => {
    if (!posthog.__loaded) return;

    const url = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

    if (lastUrl.current === url) return;
    lastUrl.current = url;

    posthog.capture('$pageview', { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}

function applyConsent(state: 'accepted' | 'rejected' | 'unknown') {
  if (!posthog.__loaded) return;
  if (state === 'accepted') {
    posthog.set_config({
      autocapture: true,
      capture_pageleave: true,
      disable_session_recording: false,
    });
    posthog.startSessionRecording();
    posthog.opt_in_capturing({ captureEventName: false });
  } else {
    // Soft consent: pageviews stay on, but autocapture and session
    // recording are disabled until accept.
    posthog.set_config({
      autocapture: false,
      capture_pageleave: false,
      disable_session_recording: true,
    });
    posthog.stopSessionRecording();
  }
}

export function PostHogProvider({ children }: { children: ReactNode }) {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const token = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

    if (!token) {
      return;
    }

    const initialConsent = readConsent();

    try {
      posthog.init(token, {
        api_host: host ?? 'https://eu.i.posthog.com',
        defaults: '2026-01-30',
        capture_pageview: false,
        capture_pageleave: initialConsent === 'accepted',
        autocapture: initialConsent === 'accepted',
        disable_session_recording: initialConsent !== 'accepted',
        // Soft consent: anonymous pageviews fire until visitor decides.
        // Reject sets opt-out + stops recording; accept enables full
        // capture. PostHog `persistence: 'memory'` would drop the
        // distinct id between page loads, which kills the funnel — keep
        // the default localStorage persistence but rely on the consent
        // banner to be present for EU/UK markets.
        person_profiles: 'identified_only',
        session_recording: {
          recordCrossOriginIframes: true,
        },
      });
    } catch {
      return;
    }

    applyConsent(initialConsent);
    return subscribeConsent(state => applyConsent(state));
  }, []);

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogPageTracker />
      </Suspense>
      {children}
    </PHProvider>
  );
}

export { posthog };
