'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import type { ReactNode } from 'react';
import { Suspense, useEffect, useRef } from 'react';

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

    try {
      posthog.init(token, {
        api_host: host ?? 'https://us.i.posthog.com',
        defaults: '2026-01-30',
        capture_pageview: false,
        capture_pageleave: true,
        autocapture: true,
        session_recording: {
          recordCrossOriginIframes: true,
        },
      });
      // safe-swallow: pre-existing — see goals/production-hardening/ phase B.7.b
    } catch {
      // PostHog init failed — analytics disabled, site still works
    }
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
