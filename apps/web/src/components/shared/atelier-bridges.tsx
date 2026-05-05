'use client';

import type { AtelierEmptyStateAction } from '@contractor-ops/ui';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

/**
 * Bridge AtelierEmptyState's `renderAction` callback to the app's
 * locale-aware Link / Button. Handles both `href` (Link) and
 * `onClick` (Button) action variants.
 *
 * The Atelier primitives can't import the app's Link directly because
 * @contractor-ops/ui must stay free of next-intl/routing deps; the
 * primitives expose a `renderAction` callback so each app can wire its
 * own navigation. This is the canonical apps/web bridge.
 */
export function renderEmptyStateAction(
  action: AtelierEmptyStateAction,
  variant: 'primary' | 'secondary',
) {
  const buttonVariant = variant === 'secondary' ? 'outline' : 'default';

  if (action.href) {
    return (
      <Button variant={buttonVariant} nativeButton={false} render={<Link href={action.href} />}>
        {action.label}
      </Button>
    );
  }

  return (
    <Button variant={buttonVariant} onClick={action.onClick}>
      {action.label}
    </Button>
  );
}
