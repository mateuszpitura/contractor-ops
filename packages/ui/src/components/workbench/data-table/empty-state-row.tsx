import type { ComponentType, ReactNode } from 'react';

import { Button } from '../../shadcn/button.js';
import { TableCell, TableRow } from '../../shadcn/table.js';

interface EmptyStateRowProps {
  colSpan: number;
  icon?: ReactNode;
  title: string;
  description?: string;
  cta?: string;
  onCta?: () => void;
  ctaIcon?: ComponentType<{ className?: string }>;
}

/**
 * Compact in-table empty state. Rendered when the table has zero rows AND no
 * filters or search are active. Sub-tables and dialog-embedded tables always
 * use this; first-class lists swap to the full `AtelierEmptyState` panel.
 */
export function EmptyStateRow({
  colSpan,
  icon,
  title,
  description,
  cta,
  onCta,
  ctaIcon: CtaIcon,
}: EmptyStateRowProps) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="py-20">
        <div className="mx-auto flex max-w-md flex-col items-center text-center">
          {icon ? (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
              {icon}
            </div>
          ) : null}
          <h3 className="mt-4 text-[15px] font-semibold tracking-tight text-foreground">{title}</h3>
          {description ? (
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
          {cta && onCta ? (
            <Button size="sm" className="mt-5" onClick={onCta}>
              {CtaIcon ? <CtaIcon className="h-3.5 w-3.5" /> : null}
              {cta}
            </Button>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}
