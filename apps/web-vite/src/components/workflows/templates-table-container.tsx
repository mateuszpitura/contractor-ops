import { WORKBENCH_TABLE_SECTION_CLASS } from '@contractor-ops/ui';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Plus } from 'lucide-react';

import { Link } from '../../i18n/navigation.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { isListControlsDisabled } from '../shared/list-controls-disabled.js';
import { useTemplatesTable } from './hooks/use-templates-table.js';
import { TemplatesTable } from './templates/data-table.js';

export function TemplatesTableContainer() {
  const t = useTranslations('Workflows');
  const table = useTemplatesTable();

  const showToolbar = table.isLoading || table.templates.length > 0;
  const controlsDisabled = isListControlsDisabled({
    isLoading: table.isLoading,
    isFetching: table.isFetching,
  });

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

  return (
    <section aria-label={t('tabTemplates')} className={WORKBENCH_TABLE_SECTION_CLASS}>
      {showToolbar ? (
        <div className="flex shrink-0 items-center justify-end">
          <Button
            size="sm"
            disabled={controlsDisabled}
            render={<Link href="/workflows/templates/new" />}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t('templates.newTemplate')}
          </Button>
        </div>
      ) : null}
      <TemplatesTable {...table} />
    </section>
  );
}
