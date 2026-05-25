import { Button } from '@contractor-ops/ui/components/shadcn/button';

import { useTranslations } from '../../i18n/useTranslations.js';
import { useTemplatesTable } from './hooks/use-templates-table.js';
import { TemplatesTable } from './templates-table.js';

export function TemplatesTableContainer() {
  const t = useTranslations('Workflows');
  const table = useTemplatesTable();

  if (table.isError) {
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 text-center">
        <h2 className="text-lg font-medium">{t('errors.failedToLoadTemplates')}</h2>
        <Button variant="outline" onClick={table.handleRetry}>
          {t('errors.retry')}
        </Button>
      </div>
    );
  }

  return <TemplatesTable {...table} />;
}
