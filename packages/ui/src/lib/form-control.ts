import { cn } from './utils.js';

/**
 * Shared surface for text fields, selects, combobox/date triggers, and input groups.
 * Light: muted fill on warm base. Dark: input token. Focus lifts to page/input surface.
 */
export const formControlSurfaceClassName =
  'border border-[var(--form-control-border)] bg-[var(--form-control-bg)] text-foreground shadow-none';

export const formControlFocusClassName =
  'focus-visible:border-ring focus-visible:bg-[var(--form-control-bg-focus)] focus-visible:ring-2 focus-visible:ring-ring/30';

export const formControlHoverClassName = 'hover:bg-[var(--form-control-bg-hover)]';

export const formControlDisabledClassName =
  'disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-[var(--form-control-bg-disabled)] disabled:opacity-65';

export const formControlInvalidClassName =
  'aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40';

export const formControlTransitionClassName =
  'rounded-lg transition-[color,border-color,box-shadow,background-color] outline-none';

export const formControlPlaceholderClassName =
  'placeholder:text-muted-foreground/60 data-placeholder:text-muted-foreground/60';

/** Base chrome for native inputs, triggers, and field-styled buttons. */
export const formControlClassName = cn(
  formControlTransitionClassName,
  formControlSurfaceClassName,
  formControlFocusClassName,
  formControlDisabledClassName,
  formControlInvalidClassName,
);
