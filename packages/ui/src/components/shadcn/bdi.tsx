import type { HTMLAttributes, RefObject } from 'react';
import { cn } from '../../lib/utils.js';

export interface BdiProps extends HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
}

/**
 * Bidirectional text isolation component.
 * Wraps content in a <bdi> element to isolate text direction from surrounding context.
 * Use for all user-generated content displayed in RTL-capable layouts:
 * contractor names, invoice numbers, free-text fields, entity references.
 */
export const Bdi = ({
  children,
  className,
  ref,
  ...props
}: BdiProps & { ref?: RefObject<HTMLElement | null> }) => (
  <bdi ref={ref} className={cn(className)} {...props}>
    {children}
  </bdi>
);
Bdi.displayName = 'Bdi';
