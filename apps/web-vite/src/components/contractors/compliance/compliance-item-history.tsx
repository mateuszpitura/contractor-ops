import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@contractor-ops/ui/components/shadcn/collapsible';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

import { tDynLoose } from '../../../i18n/typed-keys.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useDateFormatter } from '../../../lib/format/use-date-formatter.js';
import { useComplianceItemHistory } from './hooks/use-compliance-item-history.js';

export interface ComplianceItemHistoryProps {
  itemId: string;
}

/**
 * Phase 73 D-13 — read-only audit-log timeline disclosure for a compliance item.
 * The audit trail is fetched lazily (only when expanded). Loading/empty/error
 * states render inside the disclosure.
 */
export function ComplianceItemHistory({ itemId }: ComplianceItemHistoryProps) {
  const t = useTranslations('Compliance.history');
  const { formatDateTime } = useDateFormatter();
  const [open, setOpen] = useState(false);
  const { isPending, error, isEmpty, entries } = useComplianceItemHistory(itemId, open);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronDown
          className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
        {t('toggle')}
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2">
        {isPending && <Skeleton className="h-16 w-full" />}
        {!isPending && error && (
          <p role="alert" className="text-sm text-destructive">
            {t('error')}
          </p>
        )}
        {!(isPending || error) && isEmpty && (
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        )}
        {!(isPending || error || isEmpty) && (
          <ol className="flex flex-col gap-2 border-s border-border ps-4">
            {entries.map(entry => (
              <li key={entry.id} className="text-sm">
                <span className="font-medium">{tDynLoose(t, 'action', entry.action)}</span>
                <span className="ms-2 text-muted-foreground">
                  {entry.actorName ? `${entry.actorName} · ` : ''}
                  {formatDateTime(new Date(entry.createdAt))}
                </span>
              </li>
            ))}
          </ol>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
