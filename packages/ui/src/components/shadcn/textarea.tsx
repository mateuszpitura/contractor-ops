import type * as React from 'react';

import { formControlClassName, formControlPlaceholderClassName } from '../../lib/form-control.js';
import { cn } from '../../lib/utils.js';

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      data-form-control=""
      className={cn(
        formControlClassName,
        formControlPlaceholderClassName,
        'flex field-sizing-content min-h-16 w-full px-2.5 py-2 text-base md:text-sm',
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
