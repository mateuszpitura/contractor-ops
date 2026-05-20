'use client';

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { TeamRow } from '@/components/organization/teams/team-form-sheet';
import { TeamFormSheet } from '@/components/organization/teams/team-form-sheet';
import type { TeamTableRow } from '@/components/organization/teams/team-table';
import { TeamTable } from '@/components/organization/teams/team-table';
import { usePermissions } from '@/hooks/use-permissions';
import { trpc } from '@/trpc/init';

export default function TeamsPage() {
  const t = useTranslations('Organization');
  const { can } = usePermissions();
  const canCreate = can('team', ['create']);
  const canUpdate = can('team', ['update']);

  const [search, setSearch] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<TeamRow | null>(null);

  const listQuery = useQuery(
    trpc.organizationDefinitions.team.list.queryOptions({
      search: search.trim() ? search.trim() : undefined,
      limit: 50,
    }),
  );

  const rows: TeamTableRow[] = (listQuery.data?.items ?? []).map(item => ({
    ...item,
    updatedAt: item.updatedAt as Date | string,
  }));

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <Input
          className="max-w-xs"
          placeholder={t('search')}
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
        isLoading={listQuery.isLoading}
        onRowClick={row => {
          if (!canUpdate) return;
          setEditing(row);
          setSheetOpen(true);
        }}
      />
      <TeamFormSheet open={sheetOpen} onOpenChange={setSheetOpen} team={editing} />
    </section>
  );
}
