import { Card, CardContent, CardHeader } from '@contractor-ops/ui/components/shadcn/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@contractor-ops/ui/components/shadcn/collapsible';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

import { tDynLoose } from '../../../i18n/typed-keys.js';
import { useFormatter } from '../../../i18n/useFormatter.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import type { SectionCode, SectionRetention } from './hooks/use-personnel-file.js';
import type { SectionJurisdiction } from './personnel-file-section-card.js';

interface RetentionRowData {
  id: SectionCode;
  retention: SectionRetention | null;
}

export interface PersonnelRetentionPanelProps {
  jurisdiction: SectionJurisdiction;
  sections: RetentionRowData[];
}

/**
 * One retention posture row. Clicking expands the statutory citation when the
 * server supplied one. Organizational groupings (DE/UK) that carry no citation
 * render an inert row — the citation line is omitted rather than fabricated.
 */
function RetentionRow({
  jurisdiction,
  section,
  retention,
}: {
  jurisdiction: SectionJurisdiction;
  section: SectionCode;
  retention: SectionRetention | null;
}) {
  const t = useTranslations('PersonnelFile');
  const format = useFormatter();
  const [expanded, setExpanded] = useState(false);

  const label = tDynLoose(t, `sections.${jurisdiction}.${section}`, 'label');
  const citation = retention?.citation ?? null;
  const hasCitation = citation != null && citation.length > 0;

  const indefinite = !retention || retention.indefinite || retention.retainUntil == null;
  const posture = indefinite
    ? t('retention.whileEmployed')
    : t('retention.retainedUntil', {
        date: format.dateTime(retention.retainUntil as Date | string, 'medium'),
      });

  return (
    <li className="py-2.5">
      <button
        type="button"
        onClick={() => setExpanded(value => !value)}
        disabled={!hasCitation}
        aria-expanded={hasCitation ? expanded : undefined}
        className="flex w-full items-center justify-between gap-3 text-start disabled:cursor-default">
        <span className="text-sm">{label}</span>
        <span className={indefinite ? 'text-xs text-muted-foreground' : 'text-xs'}>{posture}</span>
      </button>
      {expanded && hasCitation && (
        <p className="mt-1 text-xs text-muted-foreground">
          <span className="font-medium">{t('retention.citationLabel')}:</span> {citation}
        </p>
      )}
    </li>
  );
}

/**
 * Page-level retention summary — collapsed by default — listing every section's
 * posture in one place for an HR compliance sweep. Fed by the same per-section
 * retention the file query already returns (accurate even for locked sections),
 * so it needs no second fetch. The adviser-verify legal note renders once at the
 * foot in the shared amber `role="note"` banner.
 */
export function PersonnelRetentionPanel({ jurisdiction, sections }: PersonnelRetentionPanelProps) {
  const t = useTranslations('PersonnelFile');
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CardHeader className="pb-3">
          <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="text-sm font-semibold">{t('shell.retentionSummaryToggle')}</span>
            <ChevronDown
              className={
                open ? 'size-4 rotate-180 transition-transform' : 'size-4 transition-transform'
              }
              aria-hidden="true"
            />
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-3">
            <ul className="divide-y">
              {sections.map(row => (
                <RetentionRow
                  key={row.id}
                  jurisdiction={jurisdiction}
                  section={row.id}
                  retention={row.retention}
                />
              ))}
            </ul>
            <p
              role="note"
              className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              {t('retention.adviserVerifyNote')}
            </p>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
