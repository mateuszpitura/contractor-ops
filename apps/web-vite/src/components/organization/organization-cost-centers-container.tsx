import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { FileUp, Plus } from 'lucide-react';
import { usePermissions } from '../../hooks/use-permissions.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { CostCenterCsvImportDialogContainer } from './cost-centers/cost-center-csv-import-dialog-container.js';
import { CostCenterFormSheetContainer } from './cost-centers/cost-center-form-sheet-container.js';
import { CostCenterTable } from './cost-centers/cost-center-table.js';
import { useOrganizationCostCenters } from './hooks/use-organization-cost-centers.js';
import { OrganizationLayout } from './organization-layout.js';

export function OrganizationCostCentersContainer() {
  const t = useTranslations('Organization');
  const { can } = usePermissions();
  const canCreate = can('costCenter', ['create']);
  const canUpdate = can('costCenter', ['update']);
  const {
    search,
    setSearch,
    sheetOpen,
    setSheetOpen,
    csvOpen,
    setCsvOpen,
    editing,
    setEditing,
    rows,
    isLoading,
  } = useOrganizationCostCenters();

  return (
    <OrganizationLayout>
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Input
            className="max-w-xs"
            placeholder={t('search')}
            aria-label={t('search')}
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
          isLoading={isLoading}
          hasSearch={search.trim().length > 0}
          onClearSearch={() => setSearch('')}
          onNewCostCenter={
            canCreate
              ? () => {
                  setEditing(null);
                  setSheetOpen(true);
                }
              : undefined
          }
          onRowClick={row => {
            if (!canUpdate) return;
            setEditing(row);
            setSheetOpen(true);
          }}
        />
        <CostCenterFormSheetContainer
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          costCenter={editing}
        />
        <CostCenterCsvImportDialogContainer open={csvOpen} onOpenChange={setCsvOpen} />
      </section>
    </OrganizationLayout>
  );
}
