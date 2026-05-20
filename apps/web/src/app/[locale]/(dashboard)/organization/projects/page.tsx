'use client';

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { PendingMergesInbox } from '@/components/organization/projects/pending-merges-inbox';
import type { ProjectRow } from '@/components/organization/projects/project-form-sheet';
import { ProjectFormSheet } from '@/components/organization/projects/project-form-sheet';
import type { ProjectTableRow } from '@/components/organization/projects/project-table';
import { ProjectTable } from '@/components/organization/projects/project-table';
import { usePermissions } from '@/hooks/use-permissions';
import { trpc } from '@/trpc/init';

export default function ProjectsPage() {
  const t = useTranslations('Organization');
  const { can } = usePermissions();
  const canCreate = can('project', ['create']);
  const canUpdate = can('project', ['update']);
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectRow | null>(null);

  const listQuery = useQuery(
    trpc.organizationDefinitions.project.list.queryOptions({
      search: search.trim() ? search.trim() : undefined,
      limit: 50,
    }),
  );

  const teamsQuery = useQuery(
    trpc.organizationDefinitions.team.list.queryOptions({ status: 'ACTIVE', limit: 200 }),
  );

  const teamNamesById = Object.fromEntries(
    (teamsQuery.data?.items ?? []).map(team => [team.id, team.name]),
  );

  const rows: ProjectTableRow[] = (listQuery.data?.items ?? []).map(item => ({
    ...item,
    updatedAt: item.updatedAt as Date | string,
  }));

  // "Sync now" enumerates the org's CONNECTED Jira / Linear connections so the
  // user can trigger the same fetch the cron would run nightly.
  const connectionsQuery = useQuery(
    trpc.organizationDefinitions.project.listSyncableConnections.queryOptions(),
  );

  const syncMutation = useMutation(
    trpc.organizationDefinitions.project.sync.mutationOptions({
      onSuccess: result => {
        toast.success(
          `Sync complete — inserted ${result.inserted}, linked ${result.linked}, pending ${result.pending}`,
        );
        void queryClient.invalidateQueries({
          queryKey: trpc.organizationDefinitions.project.list.queryKey(),
        });
        void queryClient.invalidateQueries({
          queryKey: trpc.organizationDefinitions.project.pendingMerges.queryKey(),
        });
      },
      onError: err => toast.error(err.message),
    }),
  );

  return (
    <section className="flex flex-col gap-4">
      <PendingMergesInbox />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Input
          className="max-w-xs"
          placeholder={t('search')}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="flex gap-2">
          {(connectionsQuery.data ?? []).map(conn => (
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
        isLoading={listQuery.isLoading}
        onRowClick={row => {
          if (!canUpdate) return;
          setEditing(row);
          setSheetOpen(true);
        }}
      />
      <ProjectFormSheet open={sheetOpen} onOpenChange={setSheetOpen} project={editing} />
    </section>
  );
}
