import { RouteLoading } from '@/components/boundaries/route-loading';

/**
 * Loading skeleton for the cross-tenant admin surface (`/admin/**`).
 * No `NextIntlClientProvider` in this tree — uses the default English aria label.
 */
export default function AdminRouteLoading() {
  return <RouteLoading routeName="admin" ariaLabel="Loading admin page" />;
}
