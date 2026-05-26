import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { PlusIcon } from 'lucide-react';
import { useCallback, useState } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { AddBoeRateDialogContainer } from './add-boe-rate-dialog-container.js';
import { BoeRateTableContainer } from './boe-rate-table-container.js';
import { PollerStatusStripContainer } from './poller-status-strip-container.js';

// Decision: composition — composes PollerStatusStripContainer, BoeRateTable
// Container, and AddBoeRateDialogContainer; owns add-dialog open-state spanning
// the page-level "Add rate" button and the modal sibling.
export function AdminBoeRateContainer() {
  const t = useTranslations('Admin.BoeRate');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const openAddDialog = useCallback(() => setAddDialogOpen(true), []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold font-display text-foreground">{t('pageTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('pageSubtitle')}</p>
      </div>

      <PollerStatusStripContainer />

      <div className="flex items-center justify-end">
        <Button onClick={openAddDialog}>
          <PlusIcon className="mr-2 h-4 w-4" aria-hidden="true" />
          {t('addRate')}
        </Button>
      </div>

      <BoeRateTableContainer />

      <AddBoeRateDialogContainer open={addDialogOpen} onOpenChange={setAddDialogOpen} />
    </div>
  );
}
