'use client';

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

/**
 * Shared route-level error boundary primitive.
 *
 * Renders a card-shaped error UI inside whichever layout chrome the route
 * sits in (sidebar + topbar survive). Reports the error to Sentry on mount
 * and offers a Reload affordance via `reset()`.
 *
 * Translation strings are passed in as props so this primitive works in both
 * localized (`[locale]/...`) and non-localized (`/admin/...`) trees — the
 * latter has no `NextIntlClientProvider` ancestor and therefore cannot call
 * `useTranslations`. Each `error.tsx` is responsible for sourcing its own
 * strings; the primitive stays presentational.
 *
 * Production hardening: never renders `error.message` or stack traces in
 * production builds. In development, the raw message is shown to help debug
 * the failing render. `error.digest` is always safe to surface (server-side
 * fingerprint, no PII).
 */
export type RouteErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
  /** Route segment label, e.g. `"contracts"`. Used as a Sentry tag + a11y context. */
  routeName: string;
  /** Localized heading, e.g. `"Something went wrong"`. */
  title: string;
  /** Localized body copy. */
  description: string;
  /** Localized button label, e.g. `"Reload"`. */
  reloadLabel: string;
};

export function RouteError({
  error,
  reset,
  routeName,
  title,
  description,
  reloadLabel,
}: RouteErrorProps) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: { route: routeName, boundary: 'route' },
      ...(error.digest ? { extra: { digest: error.digest } } : {}),
    });
  }, [error, routeName]);

  const isDev = process.env.NODE_ENV !== 'production';

  return (
    <div
      role="alert"
      aria-live="polite"
      className="flex min-h-[60vh] items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md" data-testid={`route-error-${routeName}`}>
        <CardHeader>
          <CardTitle className="font-display text-lg">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        {isDev && error.message ? (
          <CardContent>
            <pre className="overflow-x-auto rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              {error.message}
            </pre>
          </CardContent>
        ) : null}
        <CardFooter>
          <Button onClick={() => reset()} variant="default">
            {reloadLabel}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
