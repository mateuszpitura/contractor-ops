import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { toast } from 'sonner';

import { usePermissions } from '../../../hooks/use-permissions.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useSession } from '../../../providers/auth-provider.js';
import { useTRPC } from '../../../providers/trpc-provider.js';
import { useSettingsUsers } from './use-settings-users.js';

export type Member = {
  id?: string;
  userId?: string;
  email?: string | null;
  name?: string | null;
  role?: string | null;
  status?: string | null;
  createdAt?: string | null;
};

export const roleBadgeColors: Record<string, string> = {
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

export const assignableRoles = [
  'admin',
  'finance_admin',
  'ops_manager',
  'team_manager',
  'legal_compliance_viewer',
  'it_admin',
  'external_accountant',
  'readonly',
] as const;

export function displayName(member: Member) {
  return member.name?.trim() || member.email?.trim() || '\u2014';
}

export function displayStatus(member: Member): string {
  const s = member.status?.toLowerCase() ?? 'active';
  if (s === 'banned') return 'disabled';
  return s;
}

export function useUsersTable() {
  const trpc = useTRPC();
  const t = useTranslations('Users');
  const tToast = useTranslations('Settings.toast');
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const session = useSession();
  const currentUserId = session.data?.user?.id;
  const canManageMembers = can('member', ['update']);
  const canDeleteMembers = can('member', ['delete']);
  const canReadConsent = can('settings', ['read']);

  const { usersQuery: membersQuery } = useSettingsUsers();

  const members = useMemo(() => {
    const data = membersQuery.data;
    if (!Array.isArray(data)) return [];
    return data as unknown as Member[];
  }, [membersQuery.data]);

  const showActionsColumn =
    (canManageMembers || canDeleteMembers || canReadConsent) &&
    members.some(m => {
      const isSelf = m.userId === currentUserId;
      const isDisabled = displayStatus(m) === 'disabled';
      return (
        (isDisabled && canManageMembers) ||
        (!(isDisabled || isSelf) && canDeleteMembers) ||
        canReadConsent
      );
    });

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

  return {
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
  } as const;
}
