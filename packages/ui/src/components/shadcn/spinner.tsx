import { Loader2 } from 'lucide-react';
import type * as React from 'react';
import { cn } from '../../lib/utils.js';

export interface SpinnerProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: number;
}

export function Spinner({ className, size = 16, ...props }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn('inline-flex items-center justify-center', className)}
      {...props}>
      <Loader2 className="animate-spin" width={size} height={size} aria-hidden />
      <span className="sr-only">Loading</span>
    </span>
  );
}
