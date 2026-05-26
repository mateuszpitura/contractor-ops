'use client';

import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import { ChevronRightIcon, MoreHorizontalIcon } from 'lucide-react';
import type * as React from 'react';
import { useUITranslations } from '../../i18n/translations-provider.js';
import { cn } from '../../lib/utils.js';

// Localized labels come from `<UITranslationsProvider>` mounted at the host
// root (next-intl for apps/web + apps/landing, i18next for apps/web-vite).
// Per-instance overrides via standard React props (`aria-label` etc.) take
// precedence so consumers can tighten the label without touching the
// translation namespace.

function Breadcrumb({ className, 'aria-label': ariaLabel, ...props }: React.ComponentProps<'nav'>) {
  const t = useUITranslations();
  return (
    <nav
      aria-label={ariaLabel ?? t('aria.breadcrumb')}
      data-slot="breadcrumb"
      className={cn(className)}
      {...props}
    />
  );
}

function BreadcrumbList({ className, ...props }: React.ComponentProps<'ol'>) {
  return (
    <ol
      data-slot="breadcrumb-list"
      className={cn(
        'flex flex-wrap items-center gap-1.5 text-sm wrap-break-word text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
}

function BreadcrumbItem({ className, ...props }: React.ComponentProps<'li'>) {
  return (
    <li
      data-slot="breadcrumb-item"
      className={cn('inline-flex items-center gap-1', className)}
      {...props}
    />
  );
}

function BreadcrumbLink({ className, render, ...props }: useRender.ComponentProps<'a'>) {
  return useRender({
    defaultTagName: 'a',
    props: mergeProps<'a'>(
      {
        className: cn('transition-colors hover:text-foreground', className),
      },
      props,
    ),
    render,
    state: {
      slot: 'breadcrumb-link',
    },
  });
}

function BreadcrumbPage({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="breadcrumb-page"
      aria-current="page"
      aria-disabled="true"
      className={cn('font-normal text-foreground', className)}
      {...props}
    />
  );
}

function BreadcrumbSeparator({ children, className, ...props }: React.ComponentProps<'li'>) {
  return (
    <li
      data-slot="breadcrumb-separator"
      role="presentation"
      aria-hidden="true"
      className={cn('[&>svg]:size-3.5', className)}
      {...props}>
      {children ?? <ChevronRightIcon />}
    </li>
  );
}

interface BreadcrumbEllipsisProps extends React.ComponentProps<'span'> {
  /** Screen-reader label for the truncation indicator. Overrides the
   * translator's `srOnly.more` key when supplied. */
  srMoreLabel?: string;
}

function BreadcrumbEllipsis({ className, srMoreLabel, ...props }: BreadcrumbEllipsisProps) {
  const t = useUITranslations();
  return (
    <span
      data-slot="breadcrumb-ellipsis"
      role="presentation"
      aria-hidden="true"
      className={cn('flex size-5 items-center justify-center [&>svg]:size-4', className)}
      {...props}>
      <MoreHorizontalIcon />
      <span className="sr-only">{srMoreLabel ?? t('srOnly.more')}</span>
    </span>
  );
}

export {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
};
