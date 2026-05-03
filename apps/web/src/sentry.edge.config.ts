import * as Sentry from '@sentry/nextjs';
import { scrubSentryEvent } from './lib/sentry-scrub';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance — 100% in dev, 10% in production
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,

  // F-OBS-03: edge runtime fetch propagation so middleware-originated
  // outbound calls forward W3C traceparent.
  tracePropagationTargets: ['localhost', /^https?:\/\//],

  // F-OBS-08: PII scrub identical to server / client configs.
  beforeSend: scrubSentryEvent,

  // Environment tag
  environment: process.env.NODE_ENV ?? 'development',
});
