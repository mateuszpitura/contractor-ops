'use client';

import type { ColumnDef } from '@tanstack/react-table';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useMemo, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(name: { givenName: string; familyName: string }): string {
  return `${name.givenName.charAt(0)}${name.familyName.charAt(0)}`.toUpperCase();
}

// ---------------------------------------------------------------------------
// DirectoryPreviewTable
// ---------------------------------------------------------------------------

export function DirectoryPreviewTable({
  users,
  selectedEmails,
  onSelectionChange,
}: DirectoryPreviewTableProps) {
  const t = useTranslations('GoogleWorkspace.import');

  // Search state with debounce
  const [searchValue, setSearchValue] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchValue(value);
      if (debounceTimer) clearTimeout(debounceTimer);
      const timer = setTimeout(() => setDebouncedSearch(value), 300);
      setDebounceTimer(timer);
    },
    [debounceTimer],
  );

  // Org unit filter
  const [orgUnitFilter, setOrgUnitFilter] = useState<string>('');

  const orgUnits = useMemo(() => {
    const units = new Set<string>();
    for (const user of users) {
      if (user.orgUnitPath) units.add(user.orgUnitPath);
    }
    return Array.from(units).sort();
  }, [users]);

  // Filtered users
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

  // Selection helpers
  const selectableFiltered = useMemo(
    () => filteredUsers.filter(u => !u.alreadyExists),
    [filteredUsers],
  );

  const allVisibleSelected =
    selectableFiltered.length > 0 &&
    selectableFiltered.every(u => selectedEmails.has(u.primaryEmail));

  const someVisibleSelected =
    !allVisibleSelected && selectableFiltered.some(u => selectedEmails.has(u.primaryEmail));

  const handleSelectAll = useCallback(() => {
    const next = new Set(selectedEmails);
    if (allVisibleSelected) {
      for (const u of selectableFiltered) {
        next.delete(u.primaryEmail);
      }
    } else {
      for (const u of selectableFiltered) {
        next.add(u.primaryEmail);
      }
    }
    onSelectionChange(next);
  }, [allVisibleSelected, selectableFiltered, selectedEmails, onSelectionChange]);

  const handleRowSelect = useCallback(
    (email: string) => {
      const next = new Set(selectedEmails);
      if (next.has(email)) {
        next.delete(email);
      } else {
        next.add(email);
      }
      onSelectionChange(next);
    },
    [selectedEmails, onSelectionChange],
  );

  // Column definitions
  const columns = useMemo<ColumnDef<DirectoryUser>[]>(
    () => [
      {
        id: 'select',
        header: () => (
          <Checkbox
            checked={allVisibleSelected}
            indeterminate={someVisibleSelected}
            onCheckedChange={handleSelectAll}
            aria-label={t('selectAll')}
          />
        ),
        cell: ({ row }) => {
          const user = row.original;
          if (user.alreadyExists) {
            return <Checkbox checked={false} disabled aria-hidden="true" />;
          }
          return (
            <Checkbox
              checked={selectedEmails.has(user.primaryEmail)}
              // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
              onCheckedChange={() => handleRowSelect(user.primaryEmail)}
              aria-label={`Select ${user.name.fullName}`}
            />
          );
        },
        size: 40,
      },
      {
        id: 'avatar',
        header: '',
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
        size: 40,
      },
      {
        id: 'name',
        header: 'Name',
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
        header: 'Email',
        accessorKey: 'primaryEmail',
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">{row.original.primaryEmail}</span>
        ),
      },
      {
        id: 'department',
        header: 'Department',
        accessorKey: 'department',
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {row.original.department ?? '\u2014'}
          </span>
        ),
        meta: { hideBelow: 768 },
      },
      {
        id: 'orgUnit',
        header: 'Org Unit',
        accessorKey: 'orgUnitPath',
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {row.original.orgUnitPath ?? '\u2014'}
          </span>
        ),
        meta: { hideBelow: 1024 },
      },
    ],
    [allVisibleSelected, someVisibleSelected, selectedEmails, handleSelectAll, handleRowSelect, t],
  );

  // Table instance
  const table = useReactTable({
    data: filteredUsers,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize: 20 },
    },
  });

  return (
    <div className="space-y-3">
      {/* Search + filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder={t('searchPlaceholder')}
          value={searchValue}
          // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
          onChange={e => handleSearchChange(e.target.value)}
          className="max-w-xs"
        />

        {orgUnits.length > 1 && (
          <Select
            value={orgUnitFilter}
            // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
            onValueChange={val => setOrgUnitFilter(val === '__all__' ? '' : (val ?? ''))}>
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

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map(header => {
                  const hideBelow = (
                    header.column.columnDef.meta as { hideBelow?: number } | undefined
                  )?.hideBelow;

                  const responsiveClass =
                    hideBelow === 768
                      ? 'hidden md:table-cell'
                      : hideBelow === 1024
                        ? 'hidden lg:table-cell'
                        : '';

                  return (
                    <TableHead key={header.id} className={responsiveClass}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground">
                  {t('emptyNoUsers')}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map(row => {
                const isExisting = row.original.alreadyExists;
                return (
                  <TableRow
                    key={row.id}
                    className={isExisting ? 'opacity-50' : ''}
                    data-state={
                      selectedEmails.has(row.original.primaryEmail) ? 'selected' : undefined
                    }>
                    {row.getVisibleCells().map(cell => {
                      const hideBelow = (
                        cell.column.columnDef.meta as { hideBelow?: number } | undefined
                      )?.hideBelow;

                      const responsiveClass =
                        hideBelow === 768
                          ? 'hidden md:table-cell'
                          : hideBelow === 1024
                            ? 'hidden lg:table-cell'
                            : '';

                      return (
                        <TableCell key={cell.id} className={responsiveClass}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}-
            {Math.min(
              (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
              filteredUsers.length,
            )}{' '}
            of {filteredUsers.length}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              aria-label="Previous page">
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              aria-label="Next page">
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
