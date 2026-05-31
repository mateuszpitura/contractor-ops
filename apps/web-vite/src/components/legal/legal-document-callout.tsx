import type { HTMLAttributes } from 'react';

import { cn } from '../../lib/utils.js';

export function LegalDocumentCallout({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'mt-6 rounded-lg border border-amber-500/25 bg-amber-500/8 px-4 py-4 text-sm leading-relaxed text-foreground',
        className,
      )}
      {...props}>
      {children}
    </div>
  );
}
