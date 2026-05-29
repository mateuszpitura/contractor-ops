'use client';

import { Select as SelectPrimitive } from '@base-ui/react/select';
import {
  AlertCircleIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  Loader2Icon,
} from 'lucide-react';
import type * as React from 'react';
import {
  formControlClassName,
  formControlHoverClassName,
  formControlPlaceholderClassName,
} from '../../lib/form-control.js';
import { cn } from '../../lib/utils.js';

const Select = SelectPrimitive.Root;

function SelectGroup({ className, ...props }: SelectPrimitive.Group.Props) {
  return (
    <SelectPrimitive.Group
      data-slot="select-group"
      className={cn('scroll-my-1 p-1', className)}
      {...props}
    />
  );
}

function SelectValue({
  className,
  children,
  ...props
}: SelectPrimitive.Value.Props & { children?: React.ReactNode }) {
  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className={cn('flex flex-1 items-center gap-1.5 text-start', className)}
      {...props}>
      {children}
    </SelectPrimitive.Value>
  );
}

export interface SelectTriggerExtraProps {
  /**
   * Mark the trigger as resolving an async data source. Renders a spinner inside
   * the trigger and disables interaction. Mutually exclusive with `error`
   * (loading wins when both are set).
   */
  loading?: boolean;
  /**
   * Mark the trigger as failed to resolve. Renders an alert icon labelled with
   * `error.message` and keeps the trigger disabled. Ignored while `loading`.
   */
  error?: { message: string } | null;
}

function SelectTrigger({
  className,
  size = 'default',
  children,
  loading = false,
  error = null,
  disabled,
  ...props
}: SelectPrimitive.Trigger.Props & {
  size?: 'sm' | 'default';
} & SelectTriggerExtraProps) {
  const state: 'loading' | 'error' | 'resolved' = loading
    ? 'loading'
    : error
      ? 'error'
      : 'resolved';
  const isBlocked = state !== 'resolved';

  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-form-control=""
      data-size={size}
      data-state-async={state}
      aria-busy={loading || undefined}
      disabled={disabled || isBlocked}
      className={cn(
        formControlClassName,
        formControlHoverClassName,
        formControlPlaceholderClassName,
        "flex w-fit items-center justify-between gap-1.5 py-2 pe-2 ps-2.5 text-sm whitespace-nowrap select-none data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}>
      {children}
      {state === 'loading' ? (
        <Loader2Icon
          aria-hidden="true"
          className="pointer-events-none size-3.5 animate-spin text-muted-foreground"
        />
      ) : state === 'error' ? (
        <AlertCircleIcon
          aria-label={error?.message}
          role="img"
          className="pointer-events-none size-3.5 text-destructive"
        />
      ) : (
        <SelectPrimitive.Icon
          render={
            <ChevronDownIcon
              aria-hidden="true"
              className="pointer-events-none size-4 text-muted-foreground"
            />
          }
        />
      )}
    </SelectPrimitive.Trigger>
  );
}

function SelectContent({
  className,
  children,
  side = 'bottom',
  sideOffset = 4,
  align = 'center',
  alignOffset = 0,
  alignItemWithTrigger = false,
  ...props
}: SelectPrimitive.Popup.Props &
  Pick<
    SelectPrimitive.Positioner.Props,
    'align' | 'alignOffset' | 'side' | 'sideOffset' | 'alignItemWithTrigger'
  >) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        alignItemWithTrigger={alignItemWithTrigger}
        className="isolate z-50">
        <SelectPrimitive.Popup
          data-slot="select-content"
          data-align-trigger={alignItemWithTrigger}
          className={cn(
            'glass-surface relative isolate z-50 max-h-(--available-height) w-(--anchor-width) min-w-36 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-lg text-popover-foreground shadow-lg ring-1 ring-foreground/10 duration-150 data-[align-trigger=true]:animate-none data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-[0.98] data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-[0.98]',
            className,
          )}
          {...props}>
          <SelectScrollUpButton />
          <SelectPrimitive.List>{children}</SelectPrimitive.List>
          <SelectScrollDownButton />
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}

function SelectLabel({ className, ...props }: SelectPrimitive.GroupLabel.Props) {
  return (
    <SelectPrimitive.GroupLabel
      data-slot="select-label"
      className={cn('px-1.5 py-1 text-xs text-muted-foreground', className)}
      {...props}
    />
  );
}

function SelectItem({ className, children, ...props }: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1 pe-8 ps-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
        className,
      )}
      {...props}>
      <SelectPrimitive.ItemText className="flex flex-1 shrink-0 gap-2 whitespace-nowrap">
        {children}
      </SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator
        render={
          <span className="pointer-events-none absolute end-2 flex size-4 items-center justify-center" />
        }>
        <CheckIcon className="pointer-events-none" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

function SelectSeparator({ className, ...props }: SelectPrimitive.Separator.Props) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn('pointer-events-none -mx-1 my-1 h-px bg-border', className)}
      {...props}
    />
  );
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpArrow>) {
  return (
    <SelectPrimitive.ScrollUpArrow
      data-slot="select-scroll-up-button"
      className={cn(
        "top-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}>
      <ChevronUpIcon aria-hidden="true" />
    </SelectPrimitive.ScrollUpArrow>
  );
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownArrow>) {
  return (
    <SelectPrimitive.ScrollDownArrow
      data-slot="select-scroll-down-button"
      className={cn(
        "bottom-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}>
      <ChevronDownIcon aria-hidden="true" />
    </SelectPrimitive.ScrollDownArrow>
  );
}

// ---------------------------------------------------------------------------
// SelectValueLabel — option-label resolver with environment-aware fallback.
//
// In development a missing option throws so data drift is caught at build /
// dev time. In production the unknown key is reported via the configured
// `errorSink` and rendered in a muted style so the UI degrades gracefully.
//
// The error sink is intentionally pluggable: `packages/ui` stays free of
// logger / runtime deps, and consumers wire `setSelectErrorSink` to whatever
// observability surface they own (`@contractor-ops/logger`, Sentry, console
// in tests, etc.).
// ---------------------------------------------------------------------------

export interface SelectValueLabelMissEvent {
  component: 'SelectValueLabel';
  value: string;
  availableValues: ReadonlyArray<string>;
  context?: string;
}

type SelectErrorSink = (event: SelectValueLabelMissEvent) => void;

let selectErrorSink: SelectErrorSink = () => {
  // no-op default; apps wire a real sink via setSelectErrorSink
};

export function setSelectErrorSink(sink: SelectErrorSink): void {
  selectErrorSink = sink;
}

export interface SelectValueLabelOption {
  value: string;
  label: string;
}

export interface SelectValueLabelProps {
  /** The current selected value (the enum key, never the label). */
  value: string;
  /** Static or fetched option list — label is rendered for the matching value. */
  options: ReadonlyArray<SelectValueLabelOption>;
  /**
   * Optional human context for the error sink (e.g. component name, field).
   * Useful when many SelectValueLabel instances share the same sink.
   */
  context?: string;
  /** Optional className passed through to the rendered span. */
  className?: string;
}

function isProduction(): boolean {
  const proc = (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process;
  return proc?.env?.NODE_ENV === 'production';
}

function SelectValueLabel({ value, options, context, className }: SelectValueLabelProps) {
  const match = options.find(option => option.value === value);
  if (match) {
    return <span className={className}>{match.label}</span>;
  }

  const event: SelectValueLabelMissEvent = {
    component: 'SelectValueLabel',
    value,
    availableValues: options.map(option => option.value),
    context,
  };

  if (!isProduction()) {
    throw new Error(
      `[SelectValueLabel] no option for value "${value}"` +
        (context ? ` (${context})` : '') +
        `; available: [${event.availableValues.join(', ')}]`,
    );
  }

  selectErrorSink(event);
  return (
    <span
      data-slot="select-value-label-fallback"
      data-fallback="unknown-key"
      className={cn('text-muted-foreground', className)}>
      {value}
    </span>
  );
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
  SelectValueLabel,
};
