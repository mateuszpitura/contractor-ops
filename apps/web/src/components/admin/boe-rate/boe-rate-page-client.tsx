'use client';

// apps/web/src/components/admin/boe-rate/boe-rate-page-client.tsx
//
// Client portion of /admin/boe-rate. The server page wrapper enforces
// platform-operator authorization (F-SEC-04) before this renders.

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { PlusIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { AddBoeRateDialog } from '@/components/admin/boe-rate/add-boe-rate-dialog';
import { BoeRateTable } from '@/components/admin/boe-rate/boe-rate-table';
import { PollerStatusStrip } from '@/components/admin/boe-rate/poller-status-strip';

export function BoeRatePageClient() {
  const t = useTranslations('Admin.BoeRate');
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold font-display text-foreground">{t('pageTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('pageSubtitle')}</p>
      </div>

      <PollerStatusStrip />

      <div className="flex items-center justify-end">
        <Button onClick={() => setAddDialogOpen(true)}>
          <PlusIcon className="mr-2 h-4 w-4" aria-hidden="true" />
          {t('addRate')}
        </Button>
      </div>

      <BoeRateTable />

      <AddBoeRateDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />
    </div>
  );
}
