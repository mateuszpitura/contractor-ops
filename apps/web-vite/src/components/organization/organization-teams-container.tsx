import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Plus } from 'lucide-react';
import { usePermissions } from '../../hooks/use-permissions.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { useOrganizationTeams } from './hooks/use-organization-teams.js';
import { OrganizationLayout } from './organization-layout.js';
import { TeamFormSheetContainer } from './teams/team-form-sheet-container.js';
import { TeamTable } from './teams/team-table.js';

export function OrganizationTeamsContainer() {
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
    isError,
    refetch,
  } = useOrganizationTeams();

  return (
    <OrganizationLayout>
      <section className="flex min-h-0 flex-1 flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <Input
            className="max-w-xs"
            placeholder={t('search')}
            aria-label={t('search')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {canCreate && (
            <Button
              onClick={() => {
                setEditing(null);
                setSheetOpen(true);
              }}>
              <Plus className="mr-2 h-4 w-4" /> {t('newTeam')}
            </Button>
          )}
        </div>
        <TeamTable
          rows={rows}
          isLoading={isLoading}
          isError={isError}
          onRetry={() => void refetch()}
          hasSearch={search.trim().length > 0}
          onClearSearch={() => setSearch('')}
          onNewTeam={
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
        <TeamFormSheetContainer open={sheetOpen} onOpenChange={setSheetOpen} team={editing} />
      </section>
    </OrganizationLayout>
  );
}
