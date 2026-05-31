'use client';

import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import { XIcon } from 'lucide-react';
import type * as React from 'react';
import { useUITranslations } from '../../i18n/translations-provider.js';
import { cn } from '../../lib/utils.js';
import { Button } from './button.js';

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({ className, ...props }: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        'fixed inset-0 isolate z-50 bg-black/20 duration-200 supports-backdrop-filter:backdrop-blur-[3px] supports-backdrop-filter:backdrop-saturate-[0.8] dark:bg-black/50 dark:supports-backdrop-filter:backdrop-blur-sm data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0',
        className,
      )}
      {...props}
    />
  );
}

/**
 * Width sizing for the dialog. Every variant keeps the mobile clamp
 * (`max-w-[calc(100%-2rem)]`) so the modal never exceeds the viewport,
 * then widens at breakpoints — pick a named `size` instead of passing a
 * one-off `max-w-*` through `className`. Use the wider tiers (`xl`, `2xl`)
 * for table / multi-column step content; `full` for near-edge-to-edge.
 */
const dialogContentVariants = cva('', {
  variants: {
    size: {
      default: 'max-w-[calc(100%-2rem)] sm:max-w-md',
      md: 'max-w-[calc(100%-2rem)] sm:max-w-lg',
      lg: 'max-w-[calc(100%-2rem)] sm:max-w-2xl',
      xl: 'max-w-[calc(100%-2rem)] sm:max-w-3xl lg:max-w-4xl',
      '2xl': 'max-w-[calc(100%-2rem)] sm:max-w-4xl lg:max-w-6xl',
      full: 'max-w-[calc(100%-2rem)] sm:max-w-[calc(100%-4rem)]',
    },
  },
  defaultVariants: { size: 'default' },
});

function DialogContent({
  className,
  children,
  showCloseButton = true,
  closeAriaLabel,
  size,
  onPointerDownOutside: _onPointerDownOutside,
  onInteractOutside: _onInteractOutside,
  onEscapeKeyDown: _onEscapeKeyDown,
  ...props
}: DialogPrimitive.Popup.Props &
  VariantProps<typeof dialogContentVariants> & {
    showCloseButton?: boolean;
    /**
     * Per-instance override for the floating close button's `aria-label`.
     * Defaults to the host translator's `aria.closeDialog` key.
     */
    closeAriaLabel?: string;
    onPointerDownOutside?: (event: Event) => void;
    onInteractOutside?: (event: Event) => void;
    onEscapeKeyDown?: (event: Event) => void;
  }) {
  const t = useUITranslations();
  const resolvedCloseAriaLabel = closeAriaLabel ?? t('aria.closeDialog');
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          'glass-surface fixed top-1/2 left-1/2 z-50 flex w-full max-h-[calc(100dvh-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-hidden rounded-xl p-4 text-sm shadow-xl ring-1 ring-foreground/10 duration-200 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
          dialogContentVariants({ size }),
          // Header / section chrome / footer stay fixed; only DialogBody scrolls.
          '[&>[data-slot=dialog-header]]:shrink-0',
          '[&>[data-slot=dialog-section]]:shrink-0',
          '[&>[data-slot=dialog-footer]]:mt-auto shrink-0',
          '[&>[data-slot=dialog-body]]:min-h-0 [&>[data-slot=dialog-body]]:flex-1 [&>[data-slot=dialog-body]]:overflow-y-auto',
          className,
        )}
        {...props}>
        {children}
        {!!showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={
              <Button
                variant="ghost"
                className="absolute top-2 end-2"
                size="icon-sm"
                aria-label={resolvedCloseAriaLabel}
              />
            }>
            <XIcon aria-hidden="true" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot="dialog-header" className={cn('flex flex-col gap-2', className)} {...props} />
  );
}

/** Non-scrolling chrome between header and body (e.g. stepper). */
function DialogSection({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="dialog-section" className={cn('shrink-0', className)} {...props} />;
}

/** Scrollable main content; footer stays pinned to the modal bottom. */
function DialogBody({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-body"
      className={cn('min-h-0 flex-1 overflow-y-auto', className)}
      {...props}
    />
  );
}

/** Put on `<form>` when fields and DialogFooter should participate in dialog flex layout. */
export const dialogFormLayoutClassName = 'contents';

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  showCloseButton?: boolean;
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        // -mx-4 / -mb-4 break out of DialogContent's p-4 so the footer spans
        // the popup's full width and pins to the bottom edge. The dialog
        // popup uses flex-col with overflow-hidden, so this child stays at
        // the bottom even when the body region overflows and scrolls.
        '-mx-4 -mb-4 mt-auto flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end',
        className,
      )}
      {...props}>
      {children}
      {!!showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="outline" />}>Close</DialogPrimitive.Close>
      )}
    </div>
  );
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn('text-base leading-none font-medium', className)}
      {...props}
    />
  );
}

function DialogDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        'text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground',
        className,
      )}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogSection,
  DialogTitle,
  DialogTrigger,
};
