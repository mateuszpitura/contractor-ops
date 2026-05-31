'use client';

import { Button as ButtonPrimitive } from '@base-ui/react/button';
import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';

import { formControlClassName, formControlHoverClassName } from '../../lib/form-control.js';
import { cn } from '../../lib/utils.js';

const buttonVariants = cva(
  cn(
    'group/button inline-flex shrink-0 items-center justify-center rounded-lg text-sm whitespace-nowrap outline-none select-none transition-all',
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ),
  {
    variants: {
      variant: {
        default: cn(
          'btn-shimmer border border-transparent font-medium shadow-sm active:translate-y-px',
          'bg-primary text-primary-foreground hover:bg-primary/90 [a]:hover:bg-primary/90',
          'focus-visible:ring-3 focus-visible:ring-ring/50',
          'disabled:pointer-events-none disabled:opacity-50',
          'aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40',
        ),
        outline: cn(
          'border border-border bg-background font-medium active:translate-y-px',
          'hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground',
          'focus-visible:ring-3 focus-visible:ring-ring/50',
          'disabled:pointer-events-none disabled:opacity-50',
          'dark:border-input dark:bg-input/30 dark:hover:bg-input/50',
          'aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40',
        ),
        field: cn(
          formControlClassName,
          formControlHoverClassName,
          'font-normal shadow-none active:translate-y-0',
          'focus-visible:ring-2 focus-visible:ring-ring/30',
          'disabled:pointer-events-none disabled:opacity-65',
          'aria-expanded:bg-[var(--form-control-bg-focus)]',
          'aria-invalid:ring-2 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40',
        ),
        secondary: cn(
          'border border-transparent font-medium active:translate-y-px',
          'bg-secondary text-secondary-foreground hover:bg-secondary/80',
          'aria-expanded:bg-secondary aria-expanded:text-secondary-foreground',
          'focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50',
        ),
        ghost: cn(
          'border border-transparent font-medium active:translate-y-px',
          'hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground',
          'focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50',
          'dark:hover:bg-muted/50',
        ),
        destructive: cn(
          'border border-transparent font-medium shadow-sm active:translate-y-px',
          'bg-destructive text-white hover:bg-destructive/90',
          'focus-visible:ring-destructive/20 dark:bg-destructive dark:hover:bg-destructive/90',
          'focus-visible:ring-3 dark:focus-visible:ring-destructive/40',
          'disabled:pointer-events-none disabled:opacity-50',
        ),
        link: cn(
          'border border-transparent font-medium active:translate-y-px',
          'text-primary underline-offset-4 hover:underline',
          'disabled:pointer-events-none disabled:opacity-50',
        ),
      },
      size: {
        default:
          'h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pe-2 has-data-[icon=inline-start]:ps-2',
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pe-1.5 has-data-[icon=inline-start]:ps-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pe-1.5 has-data-[icon=inline-start]:ps-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: 'h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pe-3 has-data-[icon=inline-start]:ps-3',
        icon: 'size-8',
        'icon-xs':
          "relative size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3 before:absolute before:-inset-2 before:content-['']",
        'icon-sm':
          "relative size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg before:absolute before:-inset-1.5 before:content-['']",
        'icon-lg': 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Button({
  className,
  variant = 'default',
  size = 'default',
  nativeButton,
  render,
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      data-form-control={variant === 'field' ? '' : undefined}
      className={cn(buttonVariants({ variant, size, className }))}
      nativeButton={nativeButton ?? (render ? false : undefined)}
      render={render}
      {...props}
    />
  );
}

export { Button, buttonVariants };
