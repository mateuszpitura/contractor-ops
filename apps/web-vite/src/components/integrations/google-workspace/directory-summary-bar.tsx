import { Card, CardContent } from '@contractor-ops/ui/components/shadcn/card';
import { useTranslations } from '../../../i18n/useTranslations.js';

// ---------------------------------------------------------------------------
// DirectorySummaryBar
// ---------------------------------------------------------------------------

interface DirectorySummaryBarProps {
  total: number;
  alreadyImported: number;
  newUsers: number;
  selected: number;
}

export function DirectorySummaryBar({
  total,
  alreadyImported,
  newUsers,
  selected,
}: DirectorySummaryBarProps) {
  const t = useTranslations('GoogleWorkspace.import');

  return (
    <Card>
      <CardContent
        className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2 px-4"
        role="status"
        aria-live="polite">
        <span className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{total}</span>{' '}
          {t('summaryFound', { total })}
        </span>

        <span className="text-sm text-muted-foreground" aria-hidden="true">
          |
        </span>

        <span className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{alreadyImported}</span>{' '}
          {t('summaryExisting', { count: alreadyImported })}
        </span>

        <span className="text-sm text-muted-foreground" aria-hidden="true">
          |
        </span>

        <span className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{newUsers}</span>{' '}
          {t('summaryNew', { count: newUsers })}
        </span>

        {selected > 0 && (
          <>
            <span className="text-sm text-muted-foreground" aria-hidden="true">
              |
            </span>
            <span className="text-sm text-primary font-semibold">
              {t('summarySelected', { count: selected })}
            </span>
          </>
        )}
      </CardContent>
    </Card>
  );
}
