import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Plus, RefreshCw } from 'lucide-react';
import { usePermissions } from '../../hooks/use-permissions.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { useOrganizationProjects } from './hooks/use-organization-projects.js';
import { OrganizationLayout } from './organization-layout.js';
import { PendingMergesInboxContainer } from './projects/pending-merges-inbox-container.js';
import { ProjectFormSheetContainer } from './projects/project-form-sheet-container.js';
import { ProjectTable } from './projects/project-table.js';

export function OrganizationProjectsContainer() {
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
    connections,
    syncMutation,
  } = useOrganizationProjects();

  return (
    <OrganizationLayout>
      <section className="flex min-h-0 flex-1 flex-col gap-4">
        <PendingMergesInboxContainer />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Input
            className="max-w-xs"
            placeholder={t('search')}
            aria-label={t('search')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="flex gap-2">
            {connections.map(conn => (
              <Button
                key={conn.id}
                variant="outline"
                disabled={syncMutation.isPending}
                onClick={() => syncMutation.mutate({ connectionId: conn.id })}>
                <RefreshCw className="mr-2 h-4 w-4" /> {t('syncNow')} ({conn.provider})
              </Button>
            ))}
            {canCreate && (
              <Button
                onClick={() => {
                  setEditing(null);
                  setSheetOpen(true);
                }}>
                <Plus className="mr-2 h-4 w-4" /> {t('newProject')}
              </Button>
            )}
          </div>
        </div>
        <ProjectTable
          rows={rows}
          teamNamesById={teamNamesById}
          isLoading={isLoading}
          hasSearch={search.trim().length > 0}
          onClearSearch={() => setSearch('')}
          onNewProject={
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
        <ProjectFormSheetContainer open={sheetOpen} onOpenChange={setSheetOpen} project={editing} />
      </section>
    </OrganizationLayout>
  );
}
