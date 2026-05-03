import * as Sentry from '@sentry/nextjs';
import { scrubSentryEvent } from './lib/sentry-scrub';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance — 100% in dev, 10% in production
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,

  // F-OBS-03: Sentry auto-injects W3C `traceparent` on outbound fetch when
  // tracing is enabled — tracePropagationTargets defaults to same-origin
  // which covers our outbound traffic to integrations + QStash.
  tracePropagationTargets: ['localhost', /^https?:\/\//],

  // Enable Sentry structured logs
  _experiments: {
    enableLogs: true,
  },

  // F-OBS-08: scrub PII (bank accounts, tax IDs, IBANs, tokens, password,
  // emails, IPs) from every event before it leaves the process. Pino's
  // redact paths only cover log destinations; Sentry needs its own hook.
  beforeSend: scrubSentryEvent,

  // Environment tag
  environment: process.env.NODE_ENV ?? 'development',
});
