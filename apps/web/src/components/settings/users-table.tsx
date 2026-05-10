'use client';

import type { MemberStatusInput } from '@contractor-ops/ui';
import { AtelierStatusPill, AtelierTableShell, statusToVariant } from '@contractor-ops/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { DeactivateDialog } from '@/components/settings/deactivate-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { usePermissions } from '@/hooks/use-permissions';
import { enumKey } from '@/lib/enum-key';
import { trpc } from '@/trpc/init';

type Member = {
  id?: string;
  userId?: string;
  email?: string | null;
  name?: string | null;
  role?: string | null;
  status?: string | null;
  createdAt?: string | null;
};

const roleBadgeColors: Record<string, string> = {
  admin: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300',
  finance_admin: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  ops_manager: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  team_manager: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
  legal_compliance_viewer:
    'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300',
  it_admin: 'bg-slate-100 text-slate-800 dark:bg-slate-900/40 dark:text-slate-300',
  external_accountant: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
  readonly: 'bg-gray-100 text-gray-800 dark:bg-gray-900/40 dark:text-gray-300',
  owner: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300',
  member: 'bg-gray-100 text-gray-800 dark:bg-gray-900/40 dark:text-gray-300',
};

const KNOWN_MEMBER_STATUSES = new Set<MemberStatusInput>([
  'active',
  'invited',
  'disabled',
  'banned',
]);

const assignableRoles = [
  'admin',
  'finance_admin',
  'ops_manager',
  'team_manager',
  'legal_compliance_viewer',
  'it_admin',
  'external_accountant',
  'readonly',
] as const;

function displayName(member: Member) {
  return member.name?.trim() || member.email?.trim() || '\u2014';
}

function displayStatus(member: Member): string {
  const s = member.status?.toLowerCase() ?? 'active';
  if (s === 'banned') return 'disabled';
  return s;
}

export function UsersTable() {
  const t = useTranslations('Users');
  const tToast = useTranslations('Settings.toast');
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const canManageMembers = can('member', ['update']);
  const canDeleteMembers = can('member', ['delete']);

  const [deactivateTarget, setDeactivateTarget] = useState<{
    userId: string;
    name: string;
  } | null>(null);

  const membersQuery = useQuery(trpc.user.list.queryOptions());

  const members = useMemo(() => {
    const data = membersQuery.data;
    if (!Array.isArray(data)) return [];
    return data as unknown as Member[];
  }, [membersQuery.data]);

  const updateRoleMutation = useMutation(
    trpc.user.updateRole.mutationOptions({
      onSuccess: () => {
        toast.success(t('roleUpdated'));
        queryClient.invalidateQueries({ queryKey: trpc.user.list.queryKey() });
      },
      onError: (error: unknown) => {
        const message =
          typeof error === 'object' && error && 'message' in error
            ? String((error as { message?: unknown }).message ?? '')
            : '';
        toast.error(message || tToast('updateRoleFailed'));
      },
    }),
  );

  const reactivateMutation = useMutation(
    trpc.user.reactivate.mutationOptions({
      onSuccess: () => {
        toast.success(t('memberReactivated'));
        queryClient.invalidateQueries({ queryKey: trpc.user.list.queryKey() });
      },
      onError: (error: unknown) => {
        const message =
          typeof error === 'object' && error && 'message' in error
            ? String((error as { message?: unknown }).message ?? '')
            : '';
        toast.error(message || tToast('reactivateFailed'));
      },
    }),
  );

  if (membersQuery.isLoading) {
    return (
      <AtelierTableShell>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('columns.name')}</TableHead>
              <TableHead>{t('columns.email')}</TableHead>
              <TableHead>{t('columns.role')}</TableHead>
              <TableHead>{t('columns.status')}</TableHead>
              {!!(canManageMembers || canDeleteMembers) && (
                <TableHead className="text-end">{t('columns.actions')}</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
              <TableRow key={`skel-${i}`}>
                <TableCell>
                  <Skeleton className="h-4 w-28" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-40" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-20" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-16" />
                </TableCell>
                {!!(canManageMembers || canDeleteMembers) && (
                  <TableCell>
                    <Skeleton className="h-8 w-20 ms-auto" />
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </AtelierTableShell>
    );
  }

  if (members.length === 0) {
    return (
      <div className="overflow-hidden rounded-xl border border-border/50 bg-card py-16 text-center">
        <h3 className="text-[16px] font-medium">{t('emptyState.heading')}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t('emptyState.body')}</p>
      </div>
    );
  }

  const roleLabel = (role: string) =>
    t(`roles.${enumKey(role)}` as Parameters<typeof t>[0]) ?? role;

  const statusLabel = (status: string) =>
    t(`status.${enumKey(status)}` as Parameters<typeof t>[0]) ?? status;

  return (
    <>
      <AtelierTableShell isLoading={membersQuery.isFetching && !membersQuery.isLoading}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('columns.name')}</TableHead>
              <TableHead>{t('columns.email')}</TableHead>
              <TableHead>{t('columns.role')}</TableHead>
              <TableHead>{t('columns.status')}</TableHead>
              {!!(canManageMembers || canDeleteMembers) && (
                <TableHead className="text-end">{t('columns.actions')}</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m, idx) => {
              const status = displayStatus(m);
              const memberId = m.id ?? m.userId ?? '';
              const isDisabled = status === 'disabled';

              return (
                <TableRow key={memberId || String(idx)}>
                  <TableCell className="font-medium">{displayName(m)}</TableCell>
                  <TableCell className="text-muted-foreground">{m.email ?? '\u2014'}</TableCell>
                  <TableCell>
                    {canManageMembers ? (
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
                            <DropdownMenuItem
                              key={role}
                              // biome-ignore lint/nursery/noJsxPropsBind: menu item handler
                              onSelect={() => {
                                if (role !== m.role) {
                                  updateRoleMutation.mutate({
                                    userId: memberId,
                                    role,
                                  });
                                }
                              }}
                              className={role === m.role ? 'font-semibold' : ''}>
                              {roleLabel(role)}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <Badge variant="secondary" className={roleBadgeColors[m.role ?? ''] ?? ''}>
                        {roleLabel(m.role ?? '')}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {KNOWN_MEMBER_STATUSES.has(status as MemberStatusInput) ? (
                      <AtelierStatusPill
                        variant={statusToVariant('member', status as MemberStatusInput)}>
                        {statusLabel(status)}
                      </AtelierStatusPill>
                    ) : (
                      <Badge variant="secondary">{statusLabel(status)}</Badge>
                    )}
                  </TableCell>
                  {!!(canManageMembers || canDeleteMembers) && (
                    <TableCell className="text-end">
                      {isDisabled && canManageMembers ? (
                        <Button
                          variant="outline"
                          size="sm"
                          // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                          onClick={() => reactivateMutation.mutate({ userId: memberId })}
                          disabled={reactivateMutation.isPending}>
                          {t('actions.reactivate')}
                        </Button>
                      ) : !isDisabled && canDeleteMembers ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                          onClick={() =>
                            setDeactivateTarget({
                              userId: memberId,
                              name: displayName(m),
                            })
                          }>
                          {t('actions.deactivate')}
                        </Button>
                      ) : null}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </AtelierTableShell>

      {!!deactivateTarget && (
        <DeactivateDialog
          open={!!deactivateTarget}
          // biome-ignore lint/nursery/noJsxPropsBind: dialog/popover state handler
          onOpenChange={open => {
            if (!open) setDeactivateTarget(null);
          }}
          userId={deactivateTarget.userId}
          userName={deactivateTarget.name}
        />
      )}
    </>
  );
}
