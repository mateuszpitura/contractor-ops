import { Input as InputPrimitive } from '@base-ui/react/input';
import type * as React from 'react';

import { formControlClassName, formControlPlaceholderClassName } from '../../lib/form-control.js';
import { cn } from '../../lib/utils.js';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      data-form-control=""
      className={cn(
        formControlClassName,
        formControlPlaceholderClassName,
        'h-8 w-full min-w-0 px-2.5 py-1 text-base md:text-sm file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
