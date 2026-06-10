/**
 * Admin BoE rate — route shell with inlined page content.
 */

import { WORKBENCH_DATA_TABLE_CLASS, WORKBENCH_TABLE_PAGE_CLASS } from '@contractor-ops/ui';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { PlusIcon } from 'lucide-react';
import { Suspense, useCallback, useState } from 'react';

import { AddBoeRateDialogWired } from '../../components/admin/boe-rate/add-boe-rate-dialog.js';
import { BoeRateTableSection } from '../../components/admin/boe-rate/data-table.js';
import { PollerStatusStrip } from '../../components/admin/boe-rate/poller-status-strip.js';
import { PageLoadingSpinner } from '../../components/shared/page-loading-spinner.js';
import { useTranslations } from '../../i18n/useTranslations.js';

function AdminBoeRatePageContent() {
  const t = useTranslations('Admin.BoeRate');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const openAddDialog = useCallback(() => setAddDialogOpen(true), []);

  return (
    <div className={WORKBENCH_TABLE_PAGE_CLASS}>
      <div className="shrink-0">
        <h1 className="text-xl font-semibold font-display text-foreground">{t('pageTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('pageSubtitle')}</p>
      </div>

      <div className="shrink-0">
        <PollerStatusStrip />
      </div>

      <div className="flex shrink-0 items-center justify-end">
        <Button onClick={openAddDialog}>
          <PlusIcon className="me-2 h-4 w-4" aria-hidden="true" />
          {t('addRate')}
        </Button>
      </div>

      <div className={WORKBENCH_DATA_TABLE_CLASS}>
        <BoeRateTableSection />
      </div>

      <AddBoeRateDialogWired open={addDialogOpen} onOpenChange={setAddDialogOpen} />
    </div>
  );
}

export default function AdminBoeRatePage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <AdminBoeRatePageContent />
    </Suspense>
  );
}
