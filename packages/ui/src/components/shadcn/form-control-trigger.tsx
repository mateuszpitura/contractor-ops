'use client';

import type { ComponentProps } from 'react';

import { formControlClassName, formControlHoverClassName } from '../../lib/form-control.js';
import { cn } from '../../lib/utils.js';
import { Button } from './button.js';

export type FormControlTriggerProps = ComponentProps<typeof Button>;

/**
 * Popover/combobox/date trigger that matches Input/Select surfaces.
 * Use with `PopoverTrigger render={formControlPopoverRender()}` so Base UI
 * merges pointer/focus/aria props onto the button (static `render={<Button />}`
 * does not).
 */
export function FormControlTrigger({ className, children, ...props }: FormControlTriggerProps) {
  return (
    <Button
      type="button"
      variant="field"
      data-form-control=""
      className={cn('justify-start font-normal', className)}
      {...props}>
      {children}
    </Button>
  );
}

export function formControlPopoverRender(
  className?: string,
  options?: Pick<FormControlTriggerProps, 'size' | 'type'>,
) {
  return function renderFormControlPopoverTrigger(props: FormControlTriggerProps) {
    return (
      <FormControlTrigger
        type="button"
        {...options}
        {...props}
        className={cn('w-full', className, props.className)}
      />
    );
  };
}

/** Native button render for triggers that should not use Button variants. */
export function formControlNativePopoverRender(className?: string) {
  return function renderFormControlNativeTrigger(
    props: ComponentProps<'button'> & { className?: string },
  ) {
    const { className: propsClassName, ...rest } = props;
    return (
      <button
        type="button"
        data-slot="button"
        data-form-control=""
        className={cn(
          formControlClassName,
          formControlHoverClassName,
          'inline-flex h-8 w-full items-center gap-1.5 px-2.5 text-start text-sm font-normal',
          className,
          propsClassName,
        )}
        {...rest}
      />
    );
  };
}
