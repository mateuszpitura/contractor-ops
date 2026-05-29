import type { MemberStatusInput } from '@contractor-ops/ui';
import { AtelierStatusPill, statusToVariant } from '@contractor-ops/ui';
import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@contractor-ops/ui/components/shadcn/dropdown-menu';
import type { ColumnDef } from '@tanstack/react-table';
import { ShieldCheck, UserX } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

import type { LooseTranslator } from '../../i18n/typed-keys.js';
import { tDynLoose } from '../../i18n/typed-keys.js';
import { enumKey } from '../../lib/enum-key.js';
import { SimpleDataTable } from '../shared/simple-data-table.js';
import { DeactivateDialogContainer } from './deactivate-dialog-container.js';
import type { useUsersTable } from './hooks/use-users-table.js';
import {
  assignableRoles,
  displayName,
  displayStatus,
  roleBadgeColors,
} from './hooks/use-users-table.js';
import { UserConsentSheetContainer } from './user-consent-sheet-container.js';

export type UsersTableProps = ReturnType<typeof useUsersTable>;

type MemberRow = UsersTableProps['members'][number];
type AssignableRole = (typeof assignableRoles)[number];

interface RoleDropdownItemProps {
  role: AssignableRole;
  currentRole: string;
  userId: string;
  label: string;
  description: string;
  onSelectRole: (userId: string, role: AssignableRole) => void;
}

function RoleDropdownItem({
  role,
  currentRole,
  userId,
  label,
  description,
  onSelectRole,
}: RoleDropdownItemProps) {
  const handleSelect = useCallback(() => {
    if (role !== currentRole) onSelectRole(userId, role);
  }, [role, currentRole, userId, onSelectRole]);
  return (
    <DropdownMenuItem
      onSelect={handleSelect}
      className={`${role === currentRole ? 'font-semibold' : ''} flex flex-col items-start gap-0.5`}>
      <span>{label}</span>
      <span className="text-xs font-normal text-muted-foreground">{description}</span>
    </DropdownMenuItem>
  );
}

const KNOWN_MEMBER_STATUSES = new Set<MemberStatusInput>([
  'active',
  'invited',
  'disabled',
  'banned',
]);

interface MemberActionsCellProps {
  memberId: string;
  memberName: string;
  isSelf: boolean;
  isDisabled: boolean;
  canManageMembers: boolean;
  canDeleteMembers: boolean;
  canReadConsent: boolean;
  reactivatePending: boolean;
  onReactivate: (userId: string) => void;
  onDeactivate: (userId: string, name: string) => void;
  onViewConsent: (userId: string, name: string) => void;
  t: LooseTranslator;
}

function MemberActionsCell({
  memberId,
  memberName,
  isSelf,
  isDisabled,
  canManageMembers,
  canDeleteMembers,
  canReadConsent,
  reactivatePending,
  onReactivate,
  onDeactivate,
  onViewConsent,
  t,
}: MemberActionsCellProps) {
  const handleViewConsent = useCallback(
    () => onViewConsent(memberId, memberName),
    [onViewConsent, memberId, memberName],
  );
  const handleReactivate = useCallback(() => onReactivate(memberId), [onReactivate, memberId]);
  const handleDeactivate = useCallback(
    () => onDeactivate(memberId, memberName),
    [onDeactivate, memberId, memberName],
  );

  return (
    <div className="flex items-center justify-end gap-1.5">
      {!!canReadConsent && (
        <Button variant="ghost" size="sm" onClick={handleViewConsent}>
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          {t('actions.viewConsent')}
        </Button>
      )}
      {isDisabled && canManageMembers ? (
        <Button variant="outline" size="sm" onClick={handleReactivate} disabled={reactivatePending}>
          {t('actions.reactivate')}
        </Button>
      ) : !(isDisabled || isSelf) && canDeleteMembers ? (
        <Button variant="destructive" size="sm" onClick={handleDeactivate}>
          <UserX className="h-3.5 w-3.5" aria-hidden="true" />
          {t('actions.deactivate')}
        </Button>
      ) : null}
    </div>
  );
}

export function UsersTable({
  t,
  membersQuery,
  members,
  showActionsColumn,
  canManageMembers,
  canDeleteMembers,
  canReadConsent,
  currentUserId,
  updateRoleMutation,
  reactivateMutation,
}: UsersTableProps) {
  const [deactivateTarget, setDeactivateTarget] = useState<{
    userId: string;
    name: string;
  } | null>(null);
  const [consentTarget, setConsentTarget] = useState<{
    userId: string;
    name: string;
  } | null>(null);

  const handleRoleSelect = useCallback(
    (userId: string, role: AssignableRole) => updateRoleMutation.mutate({ userId, role }),
    [updateRoleMutation],
  );
  const handleReactivate = useCallback(
    (uid: string) => reactivateMutation.mutate({ userId: uid }),
    [reactivateMutation],
  );
  const handleDeactivate = useCallback(
    (uid: string, name: string) => setDeactivateTarget({ userId: uid, name }),
    [],
  );
  const handleViewConsent = useCallback(
    (uid: string, name: string) => setConsentTarget({ userId: uid, name }),
    [],
  );
  const handleDeactivateOpenChange = useCallback((open: boolean) => {
    if (!open) setDeactivateTarget(null);
  }, []);
  const handleConsentOpenChange = useCallback((openState: boolean) => {
    if (!openState) setConsentTarget(null);
  }, []);

  const columns = useMemo<ColumnDef<MemberRow, unknown>[]>(() => {
    const roleLabel = (role: string) => tDynLoose(t, 'roles', enumKey(role)) ?? role;
    const roleDescription = (role: string) => tDynLoose(t, 'roleDescriptions', enumKey(role));
    const statusLabel = (status: string) => tDynLoose(t, 'status', enumKey(status)) ?? status;

    const cols: ColumnDef<MemberRow, unknown>[] = [
      {
        id: 'name',
        accessorFn: row => displayName(row),
        header: t('columns.name'),
        cell: ({ row }) => <span className="font-medium">{displayName(row.original)}</span>,
      },
      {
        id: 'email',
        accessorKey: 'email',
        header: t('columns.email'),
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.email ?? '—'}</span>
        ),
      },
      {
        id: 'role',
        accessorKey: 'role',
        header: t('columns.role'),
        enableSorting: false,
        cell: ({ row }) => {
          const m = row.original;
          const memberId = m.id ?? m.userId ?? '';
          if (!canManageMembers) {
            return (
              <Badge variant="secondary" className={roleBadgeColors[m.role ?? ''] ?? ''}>
                {roleLabel(m.role ?? '')}
              </Badge>
            );
          }
          return (
            <DropdownMenu>
              <DropdownMenuTrigger
                className="cursor-pointer focus:outline-none"
                disabled={updateRoleMutation.isPending}>
                <Badge
                  variant="secondary"
                  className={`${roleBadgeColors[m.role ?? ''] ?? ''} cursor-pointer hover:opacity-80 transition-opacity`}>
                  {roleLabel(m.role ?? '')}
                </Badge>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {assignableRoles.map(role => (
                  <RoleDropdownItem
                    key={role}
                    role={role}
                    currentRole={m.role ?? ''}
                    userId={memberId}
                    label={roleLabel(role)}
                    description={roleDescription(role) ?? ''}
                    onSelectRole={handleRoleSelect}
                  />
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
      {
        id: 'status',
        accessorFn: row => displayStatus(row),
        header: t('columns.status'),
        enableSorting: false,
        cell: ({ row }) => {
          const status = displayStatus(row.original);
          if (KNOWN_MEMBER_STATUSES.has(status as MemberStatusInput)) {
            return (
              <AtelierStatusPill variant={statusToVariant('member', status as MemberStatusInput)}>
                {statusLabel(status)}
              </AtelierStatusPill>
            );
          }
          return <Badge variant="secondary">{statusLabel(status)}</Badge>;
        },
      },
    ];

    if (showActionsColumn) {
      cols.push({
        id: 'actions',
        header: () => <span className="block text-end">{t('columns.actions')}</span>,
        enableSorting: false,
        cell: ({ row }) => {
          const m = row.original;
          const memberId = m.id ?? m.userId ?? '';
          const status = displayStatus(m);
          return (
            <MemberActionsCell
              memberId={memberId}
              memberName={displayName(m)}
              isSelf={m.userId === currentUserId}
              isDisabled={status === 'disabled'}
              canManageMembers={canManageMembers}
              canDeleteMembers={canDeleteMembers}
              canReadConsent={canReadConsent}
              reactivatePending={reactivateMutation.isPending}
              onReactivate={handleReactivate}
              onDeactivate={handleDeactivate}
              onViewConsent={handleViewConsent}
              t={t}
            />
          );
        },
      });
    }

    return cols;
  }, [
    t,
    showActionsColumn,
    canManageMembers,
    canDeleteMembers,
    canReadConsent,
    currentUserId,
    updateRoleMutation.isPending,
    reactivateMutation.isPending,
    handleRoleSelect,
    handleReactivate,
    handleDeactivate,
    handleViewConsent,
  ]);

  return (
    <>
      <SimpleDataTable
        columns={columns}
        data={members}
        isLoading={membersQuery.isLoading}
        isRefetching={membersQuery.isFetching && !membersQuery.isLoading}
        entityLabel={t('entityLabel', { count: members.length })}
        emptyTitle={t('emptyState.heading')}
        emptyDescription={t('emptyState.body')}
        noResultsTitle={t('emptyState.heading')}
        noResultsDescription={t('emptyState.body')}
      />

      {!!deactivateTarget && (
        <DeactivateDialogContainer
          open={!!deactivateTarget}
          onOpenChange={handleDeactivateOpenChange}
          userId={deactivateTarget.userId}
          userName={deactivateTarget.name}
        />
      )}

      <UserConsentSheetContainer
        userId={consentTarget?.userId ?? null}
        userName={consentTarget?.name ?? ''}
        open={!!consentTarget}
        onOpenChange={handleConsentOpenChange}
      />
    </>
  );
}
