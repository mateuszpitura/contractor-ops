import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Plus, RefreshCw } from 'lucide-react';
import { useCallback } from 'react';

import { useOrganizationProjects } from '../../../components/organization/hooks/use-organization-projects.js';
import { isFeaturedEmptyList } from '../../../components/organization/is-featured-empty-list.js';
import { OrganizationLayout } from '../../../components/organization/organization-layout.js';
import { ProjectTable } from '../../../components/organization/projects/data-table.js';
import { PendingMergesInboxWired } from '../../../components/organization/projects/pending-merges-inbox.js';
import { ProjectFormSheetWired } from '../../../components/organization/projects/project-form-sheet.js';
import { isListControlsDisabled } from '../../../components/shared/list-controls-disabled.js';
import { usePermissions } from '../../../hooks/use-permissions.js';
import { useTranslations } from '../../../i18n/useTranslations.js';

type SyncConnection = { id: string; provider: string };

function ConnectionSyncButton({
  conn,
  disabled,
  syncMutation,
  label,
}: {
  conn: SyncConnection;
  disabled: boolean;
  syncMutation: ReturnType<typeof useOrganizationProjects>['syncMutation'];
  label: string;
}) {
  const handleClick = useCallback(
    () => syncMutation.mutate({ connectionId: conn.id }),
    [syncMutation, conn.id],
  );
  return (
    <Button variant="outline" disabled={disabled} onClick={handleClick}>
      <RefreshCw className="me-2 h-4 w-4" /> {label} ({conn.provider})
    </Button>
  );
}

function OrganizationProjectsPageContent() {
  const t = useTranslations('Organization');
  const { can } = usePermissions();
  const canCreate = can('project', ['create']);
  const canUpdate = can('project', ['update']);
  const {
    search,
    setSearch,
    sheetOpen,
    setSheetOpen,
    editing,
    setEditing,
    rows,
    teamNamesById,
    isLoading,
    isFetching,
    connections,
    syncMutation,
  } = useOrganizationProjects();

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
  const handleNewProject = useCallback(() => {
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
        <PendingMergesInboxWired />
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
              {connections.map(conn => (
                <ConnectionSyncButton
                  key={conn.id}
                  conn={conn}
                  disabled={controlsDisabled || syncMutation.isPending}
                  syncMutation={syncMutation}
                  label={t('syncNow')}
                />
              ))}
              {canCreate ? (
                <Button disabled={controlsDisabled} onClick={handleNewProject}>
                  <Plus className="me-2 h-4 w-4" /> {t('newProject')}
                </Button>
              ) : null}
            </div>
          </div>
        )}
        <ProjectTable
          rows={rows}
          teamNamesById={teamNamesById}
          isLoading={isLoading}
          hasSearch={hasSearch}
          onClearSearch={handleClearSearch}
          onNewProject={canCreate ? handleNewProject : undefined}
          onRowClick={handleRowClick}
        />
        <ProjectFormSheetWired open={sheetOpen} onOpenChange={setSheetOpen} project={editing} />
      </section>
    </OrganizationLayout>
  );
}

export default function OrganizationProjectsPage() {
  return <OrganizationProjectsPageContent />;
}
