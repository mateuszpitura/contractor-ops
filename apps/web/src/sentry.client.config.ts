import * as Sentry from '@sentry/nextjs';
import { scrubSentryEvent } from './lib/sentry-scrub';

const isDev = process.env.NODE_ENV === 'development';

// Disable Sentry entirely in development. Session Replay + 100% trace sampling
// in dev caused sustained browser-side memory growth that, combined with a
// loaded host (Docker VM, tsgo LSP, Cursor, multiple Node workers), pushed
// macOS into jetsam and killed the browser process without warning.
// Re-enable per-flow by running `NODE_ENV=production` locally if Sentry needs
// to be exercised against the dev server.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN && !isDev,

  tracesSampleRate: 0.1,

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
    !isDev && typeof Sentry.replayIntegration === 'function'
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
