import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { History } from 'lucide-react';

import { useTranslations } from '../../../i18n/useTranslations.js';

interface SupersedeChainRowProps {
  version: number;
  supersededDate: string;
  locale: string;
}

/**
 * A single historical (superseded) version inside the version-chain sub-row.
 * Dimmed to establish the active-vs-historical hierarchy; carries a
 * "Superseded {date}" chip. Historical snapshots stay in the archive — never
 * deleted.
 */
export function SupersedeChainRow({ version, supersededDate, locale }: SupersedeChainRowProps) {
  const t = useTranslations('Ewidencja');
  const formatted = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(supersededDate));

  return (
    <div className="flex items-center justify-between py-1.5 opacity-70">
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <History className="h-3.5 w-3.5" aria-hidden />
        {t('versionLabel', { version })}
      </span>
      <Badge className="border-0 bg-muted font-normal text-muted-foreground">
        {t('superseded', { date: formatted })}
      </Badge>
    </div>
  );
}
