'use client';

import { RouteError } from '@/components/boundaries/route-error';

/**
 * Error boundary for the cross-tenant admin surface (`/admin/**`).
 *
 * The admin tree lives outside `[locale]` and therefore has no
 * `NextIntlClientProvider` ancestor — strings are inlined in English.
 * The admin surface is gated to `platform_operator` users only, so
 * single-locale copy is acceptable here.
 */
export default function AdminRouteError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteError
      {...props}
      routeName="admin"
      title="Something went wrong"
      description="We couldn't render this admin page. The error has been reported. Try reloading; if the problem persists, contact engineering."
      reloadLabel="Reload"
    />
  );
}
