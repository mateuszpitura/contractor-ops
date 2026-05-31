/**
 * Canonical dashed-border drop area used by every upload surface in the app.
 * Renders the visual shell only — interaction wiring (click, drag handlers,
 * <input type="file">) is the caller's job, so both `react-dropzone` users
 * (spread `getRootProps()` here) and native-handler users (wrap in a
 * `<label htmlFor>`) compose against the same shape.
 *
 * Variants:
 *   - `default`: standalone upload action, generous padding + size-8 icon
 *   - `compact`: in-form field, single-line height, size-4 icon
 */

import { Loader2, Upload } from 'lucide-react';
import type { HTMLAttributes, ReactNode } from 'react';
import { forwardRef } from 'react';

import { cn } from '../../lib/utils.js';

export type DropZoneSurfaceVariant = 'default' | 'compact';

export interface DropZoneSurfaceProps extends HTMLAttributes<HTMLDivElement> {
  label: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  isDragActive?: boolean;
  isLoading?: boolean;
  loadingLabel?: ReactNode;
  disabled?: boolean;
  variant?: DropZoneSurfaceVariant;
  children?: ReactNode;
}

export const DropZoneSurface = forwardRef<HTMLDivElement, DropZoneSurfaceProps>(
  function DropZoneSurface(
    {
      label,
      description,
      icon,
      isDragActive = false,
      isLoading = false,
      loadingLabel,
      disabled = false,
      variant = 'default',
      className,
      children,
      ...rest
    },
    ref,
  ) {
    const isCompact = variant === 'compact';
    const renderedIcon =
      icon ??
      (isCompact ? (
        <Upload className="size-4" aria-hidden />
      ) : (
        <Upload className="size-8 text-muted-foreground" aria-hidden />
      ));

    return (
      <div
        ref={ref}
        data-slot="drop-zone-surface"
        data-drag-active={isDragActive || undefined}
        data-disabled={disabled || undefined}
        aria-disabled={disabled || undefined}
        className={cn(
          'rounded-lg border-2 border-dashed border-border bg-muted/30 text-center transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          isCompact
            ? 'flex h-20 items-center justify-center gap-2 px-4 text-sm text-muted-foreground'
            : 'flex flex-col items-center justify-center gap-2 px-6 py-10',
          isDragActive && 'border-primary bg-primary/5',
          disabled
            ? 'cursor-not-allowed opacity-60'
            : 'cursor-pointer hover:border-primary/60 hover:bg-accent/30',
          className,
        )}
        {...rest}>
        {isLoading ? (
          <>
            <Loader2
              className={cn('animate-spin text-primary', isCompact ? 'size-4' : 'size-8')}
              aria-hidden
            />
            {loadingLabel ? (
              <p className={cn('font-medium', isCompact ? 'text-sm' : 'text-sm')}>{loadingLabel}</p>
            ) : null}
          </>
        ) : (
          <>
            {renderedIcon}
            <p className={cn('font-medium text-foreground', isCompact ? 'text-sm' : 'text-sm')}>
              {label}
            </p>
            {description ? (
              <p className={cn('text-muted-foreground', isCompact ? 'text-xs' : 'text-xs')}>
                {description}
              </p>
            ) : null}
          </>
        )}
        {children}
      </div>
    );
  },
);
