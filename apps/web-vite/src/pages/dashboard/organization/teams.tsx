import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Plus } from 'lucide-react';
import { useCallback } from 'react';

import { useOrganizationTeams } from '../../../components/organization/hooks/use-organization-teams.js';
import { isFeaturedEmptyList } from '../../../components/organization/is-featured-empty-list.js';
import { OrganizationLayout } from '../../../components/organization/organization-layout.js';
import { TeamTable } from '../../../components/organization/teams/data-table.js';
import { TeamFormSheetWired } from '../../../components/organization/teams/team-form-sheet.js';
import { isListControlsDisabled } from '../../../components/shared/list-controls-disabled.js';
import { usePermissions } from '../../../hooks/use-permissions.js';
import { useTranslations } from '../../../i18n/useTranslations.js';

function OrganizationTeamsPageContent() {
  const t = useTranslations('Organization');
  const { can } = usePermissions();
  const canCreate = can('team', ['create']);
  const canUpdate = can('team', ['update']);
  const {
    search,
    setSearch,
    sheetOpen,
    setSheetOpen,
    editing,
    setEditing,
    rows,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useOrganizationTeams();

  const controlsDisabled = isListControlsDisabled({ isLoading, isFetching });
  const hasSearch = search.trim().length > 0;
  const showFeaturedEmpty = isFeaturedEmptyList({
    isLoading,
    isError,
    itemCount: rows.length,
    hasSearch,
  });

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value),
    [setSearch],
  );
  const handleNewTeam = useCallback(() => {
    setEditing(null);
    setSheetOpen(true);
  }, [setEditing, setSheetOpen]);
  const handleRetry = useCallback(() => void refetch(), [refetch]);
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
          <div className="flex items-center justify-between gap-4">
            <Input
              className="max-w-xs"
              placeholder={t('search')}
              aria-label={t('search')}
              value={search}
              disabled={controlsDisabled}
              onChange={handleSearchChange}
            />
            {canCreate ? (
              <Button disabled={controlsDisabled} onClick={handleNewTeam}>
                <Plus className="me-2 h-4 w-4" /> {t('newTeam')}
              </Button>
            ) : null}
          </div>
        )}
        <TeamTable
          rows={rows}
          isLoading={isLoading}
          isError={isError}
          onRetry={handleRetry}
          hasSearch={hasSearch}
          onClearSearch={handleClearSearch}
          onNewTeam={canCreate ? handleNewTeam : undefined}
          onRowClick={handleRowClick}
        />
        <TeamFormSheetWired open={sheetOpen} onOpenChange={setSheetOpen} team={editing} />
      </section>
    </OrganizationLayout>
  );
}

export default function OrganizationTeamsPage() {
  return <OrganizationTeamsPageContent />;
}
