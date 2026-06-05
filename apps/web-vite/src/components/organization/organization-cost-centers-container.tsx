import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { FileUp, Plus } from 'lucide-react';
import { useCallback } from 'react';
import { usePermissions } from '../../hooks/use-permissions.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { isListControlsDisabled } from '../shared/list-controls-disabled.js';
import { CostCenterCsvImportDialogContainer } from './cost-centers/cost-center-csv-import-dialog-container.js';
import { CostCenterFormSheetContainer } from './cost-centers/cost-center-form-sheet-container.js';
import { CostCenterTable } from './cost-centers/data-table.js';
import { useOrganizationCostCenters } from './hooks/use-organization-cost-centers.js';
import { isFeaturedEmptyList } from './is-featured-empty-list.js';
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
    isFetching,
  } = useOrganizationCostCenters();

  const controlsDisabled = isListControlsDisabled({ isLoading, isFetching });
  const hasSearch = search.trim().length > 0;
  const showFeaturedEmpty = isFeaturedEmptyList({
    isLoading,
    itemCount: rows.length,
    hasSearch,
  });

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value),
    [setSearch],
  );
  const handleOpenCsv = useCallback(() => setCsvOpen(true), [setCsvOpen]);
  const handleNewCostCenter = useCallback(() => {
    setEditing(null);
    setSheetOpen(true);
  }, [setEditing, setSheetOpen]);
  const handleClearSearch = useCallback(() => setSearch(''), [setSearch]);
  const handleRowClick = useCallback(
    (row: Parameters<typeof setEditing>[0]) => {
      if (!canUpdate) return;
      setEditing(row);
      setSheetOpen(true);
    },
    [canUpdate, setEditing, setSheetOpen],
  );

  return (
    <OrganizationLayout>
      <section className="flex min-h-0 flex-1 flex-col gap-4">
        {showFeaturedEmpty ? null : (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Input
              className="max-w-xs"
              placeholder={t('search')}
              aria-label={t('search')}
              value={search}
              disabled={controlsDisabled}
              onChange={handleSearchChange}
            />
            <div className="flex gap-2">
              {canCreate ? (
                <>
                  <Button variant="outline" disabled={controlsDisabled} onClick={handleOpenCsv}>
                    <FileUp className="me-2 h-4 w-4" /> {t('importCsv')}
                  </Button>
                  <Button disabled={controlsDisabled} onClick={handleNewCostCenter}>
                    <Plus className="me-2 h-4 w-4" /> {t('newCostCenter')}
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        )}
        <CostCenterTable
          rows={rows}
          isLoading={isLoading}
          hasSearch={hasSearch}
          onClearSearch={handleClearSearch}
          onNewCostCenter={canCreate ? handleNewCostCenter : undefined}
          onRowClick={handleRowClick}
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
