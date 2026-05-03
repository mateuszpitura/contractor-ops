import * as Sentry from '@sentry/nextjs';
import { scrubSentryEvent } from './lib/sentry-scrub';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance — 100% in dev, 10% in production
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,

  // F-OBS-03: propagate W3C traceparent on outbound fetch so server <-> client
  // RSC navigations stitch end-to-end in the Sentry trace view.
  tracePropagationTargets: ['localhost', /^https?:\/\//],

  // Session Replay — capture 10% of sessions, 100% on error
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // F-OBS-08: client-side scrub. Same hook as server / edge so a single
  // change-set updates redaction across the whole app.
  beforeSend: scrubSentryEvent,

  integrations:
    typeof Sentry.replayIntegration === 'function'
      ? [
          Sentry.replayIntegration({
            maskAllText: true,
            blockAllMedia: true,
          }),
          ...(typeof Sentry.feedbackIntegration === 'function'
            ? [Sentry.feedbackIntegration({ colorScheme: 'system', autoInject: false })]
            : []),
        ]
      : [],

  // Environment tag
  environment: process.env.NODE_ENV ?? 'development',
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
