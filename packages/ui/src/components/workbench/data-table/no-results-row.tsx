import { FilterX } from 'lucide-react';

import { useUITranslations } from '../../../i18n/translations-provider.js';
import { Button } from '../../shadcn/button.js';
import { TableCell, TableRow } from '../../shadcn/table.js';
import { NoResultsIllustration } from '../empty-state-illustrations.js';

interface NoResultsRowProps {
  colSpan: number;
  title: string;
  description?: string;
  cta?: string;
  onClearFilters?: () => void;
}

/**
 * Rendered when the table has zero rows AND a search query or filter is
 * active. Always uses the compact in-table layout regardless of tier — the
 * full illustration is reserved for the empty (no filters) tier on first-class
 * lists.
 */
export function NoResultsRow({
  colSpan,
  title,
  description,
  cta,
  onClearFilters,
}: NoResultsRowProps) {
  const t = useUITranslations();
  const resolvedTitle = title || t('dataTable.noResultsTitle');
  const resolvedDescription = description ?? t('dataTable.noResultsDescription');
  const resolvedCta = cta ?? t('aria.clearFilters');

  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="py-20">
        <div className="mx-auto flex max-w-md flex-col items-center text-center">
          <NoResultsIllustration className="h-16 w-16 text-primary/60" aria-hidden="true" />
          <h3 className="mt-4 text-[15px] font-semibold tracking-tight text-foreground">
            {resolvedTitle}
          </h3>
          {resolvedDescription ? (
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              {resolvedDescription}
            </p>
          ) : null}
          {onClearFilters ? (
            <Button variant="outline" size="sm" className="mt-5" onClick={onClearFilters}>
              <FilterX className="h-3.5 w-3.5" />
              {resolvedCta}
            </Button>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}
