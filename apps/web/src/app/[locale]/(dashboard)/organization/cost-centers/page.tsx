'use client';

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { useQuery } from '@tanstack/react-query';
import { FileUp, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { CostCenterCsvImportDialog } from '@/components/organization/cost-centers/cost-center-csv-import-dialog';
import type { CostCenterRow } from '@/components/organization/cost-centers/cost-center-form-sheet';
import { CostCenterFormSheet } from '@/components/organization/cost-centers/cost-center-form-sheet';
import type { CostCenterTableRow } from '@/components/organization/cost-centers/cost-center-table';
import { CostCenterTable } from '@/components/organization/cost-centers/cost-center-table';
import { usePermissions } from '@/hooks/use-permissions';
import { trpc } from '@/trpc/init';

export default function CostCentersPage() {
  const t = useTranslations('Organization');
  const { can } = usePermissions();
  const canCreate = can('costCenter', ['create']);
  const canUpdate = can('costCenter', ['update']);

  const [search, setSearch] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [editing, setEditing] = useState<CostCenterRow | null>(null);

  const listQuery = useQuery(
    trpc.organizationDefinitions.costCenter.list.queryOptions({
      search: search.trim() ? search.trim() : undefined,
      limit: 100,
    }),
  );

  const rows: CostCenterTableRow[] = (listQuery.data?.items ?? []).map(item => ({
    ...item,
    updatedAt: item.updatedAt as Date | string,
  }));

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Input
          className="max-w-xs"
          placeholder={t('search')}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="flex gap-2">
          {canCreate && (
            <>
              <Button variant="outline" onClick={() => setCsvOpen(true)}>
                <FileUp className="mr-2 h-4 w-4" /> {t('importCsv')}
              </Button>
              <Button
                onClick={() => {
                  setEditing(null);
                  setSheetOpen(true);
                }}>
                <Plus className="mr-2 h-4 w-4" /> {t('newCostCenter')}
              </Button>
            </>
          )}
        </div>
      </div>
      <CostCenterTable
        rows={rows}
        isLoading={listQuery.isLoading}
        onRowClick={row => {
          if (!canUpdate) return;
          setEditing(row);
          setSheetOpen(true);
        }}
      />
      <CostCenterFormSheet open={sheetOpen} onOpenChange={setSheetOpen} costCenter={editing} />
      <CostCenterCsvImportDialog open={csvOpen} onOpenChange={setCsvOpen} />
    </section>
  );
}
