'use client';

import { Popover as PopoverPrimitive } from '@base-ui/react/popover';
import type * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Popover — thin wrapper around `@base-ui/react/popover` exposing the four
 * pieces we use across the app: `Popover`, `PopoverTrigger`, `PopoverContent`,
 * plus the title/description/header helpers.
 *
 * ⚠️ Layout convention — parent of a `<PopoverTrigger>` MUST use
 * `flex flex-col gap-*` (or any non-sibling-margin layout). Do NOT use
 * Tailwind's `space-y-*` directly around a popover trigger.
 *
 * Why: when the popover is open, Base UI injects two `position: fixed`
 * `<FocusGuard>` `<span>`s as siblings of the trigger button. That changes
 * which child is `:last-child` and lets `space-y-*` add an extra
 * `margin-block-end` to the trigger, causing a visible layout shift around
 * the input. `flex flex-col gap-*` only accounts for in-flow children, so
 * fixed-positioned focus guards are ignored.
 *
 *   ❌  <div className="space-y-2"><Label/><Popover>…</Popover></div>
 *   ✅  <div className="flex flex-col gap-2"><Label/><Popover>…</Popover></div>
 *
 * A defensive CSS reset in `globals.css` neutralises the worst case for
 * legacy markup, but all new usages should follow the convention above.
 * Calendar / date / time pickers (`Calendar`, `TimePicker`,
 * `DateTimeRangePicker`) all rely on this primitive — the same rule applies.
 */
function Popover({ ...props }: PopoverPrimitive.Root.Props) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

function PopoverTrigger({ ...props }: PopoverPrimitive.Trigger.Props) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

function PopoverContent({
  className,
  align = 'center',
  alignOffset = 0,
  side = 'bottom',
  sideOffset = 4,
  ...props
}: PopoverPrimitive.Popup.Props &
  Pick<PopoverPrimitive.Positioner.Props, 'align' | 'alignOffset' | 'side' | 'sideOffset'>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className="isolate z-50">
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          className={cn(
            'glass-surface z-50 flex w-72 origin-(--transform-origin) flex-col gap-2.5 rounded-lg p-2.5 text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/10 outline-hidden duration-150 data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-[0.98] data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-[0.98]',
            className,
          )}
          {...props}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  );
}

function PopoverHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="popover-header"
      className={cn('flex flex-col gap-0.5 text-sm', className)}
      {...props}
    />
  );
}

function PopoverTitle({ className, ...props }: PopoverPrimitive.Title.Props) {
  return (
    <PopoverPrimitive.Title
      data-slot="popover-title"
      className={cn('font-medium', className)}
      {...props}
    />
  );
}

function PopoverDescription({ className, ...props }: PopoverPrimitive.Description.Props) {
  return (
    <PopoverPrimitive.Description
      data-slot="popover-description"
      className={cn('text-muted-foreground', className)}
      {...props}
    />
  );
}

export { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger };
