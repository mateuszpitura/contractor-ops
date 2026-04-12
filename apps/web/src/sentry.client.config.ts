import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance — 100% in dev, 10% in production
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

  // Session Replay — capture 10% of sessions, 100% on error
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  integrations:
    typeof Sentry.replayIntegration === "function"
      ? [
          Sentry.replayIntegration({
            maskAllText: true,
            blockAllMedia: true,
          }),
          ...(typeof Sentry.feedbackIntegration === "function"
            ? [Sentry.feedbackIntegration({ colorScheme: "system", autoInject: false })]
            : []),
        ]
      : [],

  // Environment tag
  environment: process.env.NODE_ENV ?? "development",
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
