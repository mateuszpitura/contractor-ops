'use client';

import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
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

function DialogContent({
  className,
  children,
  showCloseButton = true,
  closeAriaLabel,
  onPointerDownOutside: _onPointerDownOutside,
  onInteractOutside: _onInteractOutside,
  onEscapeKeyDown: _onEscapeKeyDown,
  ...props
}: DialogPrimitive.Popup.Props & {
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
          'glass-surface fixed top-1/2 left-1/2 z-50 flex w-full max-w-[calc(100%-2rem)] sm:max-w-md max-h-[calc(100dvh-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-hidden rounded-xl p-4 text-sm shadow-xl ring-1 ring-foreground/10 duration-200 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
          // Header/footer/close stay fixed; everything else becomes the
          // scrollable body so the footer remains pinned to the popup bottom
          // regardless of body length.
          '[&>[data-slot=dialog-header]]:shrink-0 [&>[data-slot=dialog-footer]]:shrink-0',
          '[&>:not([data-slot=dialog-header]):not([data-slot=dialog-footer]):not([data-slot=dialog-close])]:min-h-0 [&>:not([data-slot=dialog-header]):not([data-slot=dialog-footer]):not([data-slot=dialog-close])]:flex-1 [&>:not([data-slot=dialog-header]):not([data-slot=dialog-footer]):not([data-slot=dialog-close])]:overflow-y-auto',
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
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
