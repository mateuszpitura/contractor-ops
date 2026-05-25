/**
 * BoE rate page client. Step 10 batch port from
 * apps/web/src/components/admin/boe-rate/boe-rate-page-client.tsx:
 *   - `'use client'` stripped
 *   - `next-intl#useTranslations` → `../../../i18n/useTranslations.js`
 *   - `@/components/admin/boe-rate/*` → relative `./` imports
 */

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { PlusIcon } from 'lucide-react';
import { useState } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { AddBoeRateDialogContainer } from './add-boe-rate-dialog-container.js';
import { BoeRateTableContainer } from './boe-rate-table-container.js';
import { PollerStatusStripContainer } from './poller-status-strip-container.js';

export function BoeRatePageClient() {
  const t = useTranslations('Admin.BoeRate');
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold font-display text-foreground">{t('pageTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('pageSubtitle')}</p>
      </div>

      <PollerStatusStripContainer />

      <div className="flex items-center justify-end">
        <Button
          // biome-ignore lint/nursery/noJsxPropsBind: dialog open handler
          onClick={() => setAddDialogOpen(true)}>
          <PlusIcon className="mr-2 h-4 w-4" aria-hidden="true" />
          {t('addRate')}
        </Button>
      </div>

      <BoeRateTableContainer />

      <AddBoeRateDialogContainer open={addDialogOpen} onOpenChange={setAddDialogOpen} />
    </div>
  );
}
