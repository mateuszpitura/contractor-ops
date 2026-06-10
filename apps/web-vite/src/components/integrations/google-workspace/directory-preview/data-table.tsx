
import { Avatar, AvatarFallback, AvatarImage } from '@contractor-ops/ui/components/shadcn/avatar';
import { WorkbenchDataTable } from '../../../table-kit/workbench-data-table.js';
import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@contractor-ops/ui/components/shadcn/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@contractor-ops/ui/components/shadcn/tooltip';
import type { ColumnDef, RowSelectionState } from '@tanstack/react-table';
import type * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useTranslations } from '../../../../i18n/useTranslations.js';

export interface DirectoryUser {
  id: string;
  primaryEmail: string;
  name: { givenName: string; familyName: string; fullName: string };
  thumbnailPhotoUrl?: string | null;
  orgUnitPath?: string | null;
  department?: string | null;
  isAdmin?: boolean;
  alreadyExists: boolean;
}

interface DirectoryPreviewTableProps {
  users: DirectoryUser[];
  selectedEmails: Set<string>;
  onSelectionChange: (emails: Set<string>) => void;
}

function getInitials(name: { givenName: string; familyName: string }): string {
  return `${name.givenName.charAt(0)}${name.familyName.charAt(0)}`.toUpperCase();
}

export function DirectoryPreviewTable({
  users,
  selectedEmails,
  onSelectionChange,
}: DirectoryPreviewTableProps) {
  const t = useTranslations('GoogleWorkspace.import');

  const [searchValue, setSearchValue] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = useCallback((value: string) => {
    setSearchValue(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebouncedSearch(value), 300);
  }, []);

  useEffect(
    () => () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    },
    [],
  );

  const [orgUnitFilter, setOrgUnitFilter] = useState<string>('');

  const orgUnits = useMemo(() => {
    const units = new Set<string>();
    for (const user of users) {
      if (user.orgUnitPath) units.add(user.orgUnitPath);
    }
    return Array.from(units).sort();
  }, [users]);

  const filteredUsers = useMemo(() => {
    let result = users;
    if (debouncedSearch) {
      const lower = debouncedSearch.toLowerCase();
      result = result.filter(
        u =>
          u.name.fullName.toLowerCase().includes(lower) ||
          u.primaryEmail.toLowerCase().includes(lower),
      );
    }
    if (orgUnitFilter) {
      result = result.filter(u => u.orgUnitPath === orgUnitFilter);
    }
    return result;
  }, [users, debouncedSearch, orgUnitFilter]);

  const rowSelection = useMemo<RowSelectionState>(() => {
    const next: RowSelectionState = {};
    for (const email of selectedEmails) next[email] = true;
    return next;
  }, [selectedEmails]);

  const handleRowSelectionChange = useCallback(
    (updater: RowSelectionState | ((old: RowSelectionState) => RowSelectionState)) => {
      const next = typeof updater === 'function' ? updater(rowSelection) : updater;
      const nextSet = new Set<string>();
      for (const [key, value] of Object.entries(next)) {
        if (value) nextSet.add(key);
      }
      onSelectionChange(nextSet);
    },
    [rowSelection, onSelectionChange],
  );

  const isRowSelectable = useCallback(
    ({ original }: { original: DirectoryUser }) => !original.alreadyExists,
    [],
  );

  const columns = useMemo<ColumnDef<DirectoryUser, unknown>[]>(
    () => [
      {
        id: 'avatar',
        header: '',
        enableSorting: false,
        size: 40,
        cell: ({ row }) => {
          const user = row.original;
          return (
            <Avatar>
              {!!user.thumbnailPhotoUrl && (
                <AvatarImage src={user.thumbnailPhotoUrl} alt={user.name.fullName} />
              )}
              <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
            </Avatar>
          );
        },
      },
      {
        id: 'name',
        header: () => t('columns.name'),
        accessorFn: row => row.name.fullName,
        cell: ({ row }) => {
          const user = row.original;
          return (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{user.name.fullName}</span>
              {!!user.alreadyExists && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Badge
                          variant="secondary"
                          className="opacity-80"
                          aria-label={t('alreadyExists')}
                        />
                      }>
                      {t('alreadyExists')}
                    </TooltipTrigger>
                    <TooltipContent>{t('alreadyExistsTooltip')}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          );
        },
      },
      {
        id: 'email',
        header: () => t('columns.email'),
        accessorKey: 'primaryEmail',
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">{row.original.primaryEmail}</span>
        ),
      },
      {
        id: 'department',
        header: () => t('columns.department'),
        accessorKey: 'department',
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">{row.original.department ?? '—'}</span>
        ),
      },
      {
        id: 'orgUnit',
        header: () => t('columns.orgUnit'),
        accessorKey: 'orgUnitPath',
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">{row.original.orgUnitPath ?? '—'}</span>
        ),
      },
    ],
    [t],
  );

  const handleSearchInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => handleSearchChange(e.target.value),
    [handleSearchChange],
  );

  const handleOrgUnitChange = useCallback(
    (val: string | null) => setOrgUnitFilter(val === '__all__' ? '' : (val ?? '')),
    [],
  );

  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setPageIndex(0);
  }, []);

  const handleClearFilters = useCallback(() => {
    setSearchValue('');
    setDebouncedSearch('');
    setOrgUnitFilter('');
    setPageIndex(0);
  }, []);

  const hasFiltersOrSearch = !!debouncedSearch || !!orgUnitFilter;

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        placeholder={t('searchPlaceholder')}
        value={searchValue}
        onChange={handleSearchInputChange}
        className="max-w-xs"
      />
      {orgUnits.length > 1 && (
        <Select value={orgUnitFilter} onValueChange={handleOrgUnitChange}>
          <SelectTrigger className="w-48">
            <SelectValue>{orgUnitFilter || t('allOrgUnits')}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t('allOrgUnits')}</SelectItem>
            {orgUnits.map(unit => (
              <SelectItem key={unit} value={unit}>
                {unit}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );

  const getRowId = useCallback((row: DirectoryUser) => row.primaryEmail, []);

  return (
    <WorkbenchDataTable
      columns={columns}
      data={filteredUsers}
      totalRows={filteredUsers.length}
      clientPagination
      pageIndex={pageIndex}
      pageSize={pageSize}
      pageSizeOptions={[10, 20, 50, 100]}
      onPageChange={setPageIndex}
      onPageSizeChange={handlePageSizeChange}
      getRowId={getRowId}
      rowSelection={rowSelection}
      onRowSelectionChange={handleRowSelectionChange}
      enableRowSelection
      isRowSelectable={isRowSelectable}
      constrainHeight={false}
      hideDensityToggle
      hasFiltersOrSearch={hasFiltersOrSearch}
      onClearFilters={handleClearFilters}
      toolbar={toolbar}
      entityLabel={t('columns.name')}
      emptyTitle={t('emptyNoUsers')}
      emptyDescription={t('emptyNoUsersBody')}
      noResultsTitle={t('emptyNoUsers')}
      noResultsDescription={t('emptyNoUsersBody')}
    />
  );
}
