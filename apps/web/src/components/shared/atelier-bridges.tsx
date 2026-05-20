'use client';

import type { AtelierEmptyStateAction } from '@contractor-ops/ui';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
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

  const Icon = action.icon;

  if (action.href) {
    return (
      <Button variant={buttonVariant} nativeButton={false} render={<Link href={action.href} />}>
        {Icon ? <Icon className="h-4 w-4" /> : null}
        {action.label}
      </Button>
    );
  }

  return (
    <Button variant={buttonVariant} onClick={action.onClick}>
      {Icon ? <Icon className="h-4 w-4" /> : null}
      {action.label}
    </Button>
  );
}
