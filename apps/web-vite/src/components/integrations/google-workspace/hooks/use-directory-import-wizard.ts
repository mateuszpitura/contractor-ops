import type { DirectoryRole } from '@contractor-ops/validators';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { useCommonToasts } from '../../../../i18n/use-common-toasts.js';
import { useTranslations } from '../../../../i18n/useTranslations.js';
import { useTRPC } from '../../../../providers/trpc-provider.js';
import type { DirectoryUser } from '../directory-preview/data-table.js';

export type WizardStep = 1 | 2 | 3;

export interface UseDirectoryImportWizardParams {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function useDirectoryImportWizard({ open, onOpenChange }: UseDirectoryImportWizardParams) {
  const trpc = useTRPC();
  const t = useTranslations('GoogleWorkspace.import');
  const queryClient = useQueryClient();
  const toasts = useCommonToasts();

  const [step, setStep] = useState<WizardStep>(1);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [defaultRole, setDefaultRole] = useState<DirectoryRole>('readonly');
  const [groupMappings, setGroupMappings] = useState<Map<string, DirectoryRole>>(new Map());

  const handleOpenChange = useCallback(
    (value: boolean) => {
      if (!value) {
        setStep(1);
        setSelectedEmails(new Set());
        setDefaultRole('readonly');
        setGroupMappings(new Map());
      }
      onOpenChange(value);
    },
    [onOpenChange],
  );

  const directoryQuery = useQuery({
    ...trpc.googleWorkspace.listDirectory.queryOptions(),
    enabled: open,
  });
  const directoryData = directoryQuery.data;
  const users: DirectoryUser[] = (directoryData?.users ?? []) as DirectoryUser[];
  const stats = directoryData?.stats;

  const listGroupsMutation = useMutation(
    trpc.googleWorkspace.listUserGroups.mutationOptions({
      onError: err => toast.error(err.message),
      onSuccess: () => {
        toast.success(toasts.done());
        queryClient.invalidateQueries(trpc.googleWorkspace.pathFilter());
      },
    }),
  );

  const handleGoToStep2 = useCallback(() => {
    const emails = Array.from(selectedEmails);
    listGroupsMutation.mutate({ userEmails: emails });
    setStep(2);
  }, [selectedEmails, listGroupsMutation]);

  const groups = listGroupsMutation.data?.groups ?? [];

  const handleGroupMappingChange = useCallback((groupEmail: string, role: DirectoryRole) => {
    setGroupMappings(prev => {
      const next = new Map(prev);
      next.set(groupEmail, role);
      return next;
    });
  }, []);

  const selectedUsers = useMemo(
    () => users.filter(u => selectedEmails.has(u.primaryEmail)),
    [users, selectedEmails],
  );

  const userGroupMemberships = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const group of groups) {
      for (const email of group.memberEmails) {
        if (!map[email]) map[email] = [];
        map[email].push(group.email);
      }
    }
    return map;
  }, [groups]);

  const roleBreakdown = useMemo(() => {
    const counts = new Map<string, { role: DirectoryRole; count: number; source: string }>();

    for (const user of selectedUsers) {
      let role: DirectoryRole = defaultRole;
      let source = t('roleSourceDefault');

      const userGroups = userGroupMemberships[user.primaryEmail] ?? [];
      for (const [groupEmail, mappedRole] of groupMappings) {
        if (userGroups.includes(groupEmail)) {
          role = mappedRole;
          const group = groups.find(g => g.email === groupEmail);
          source = group?.name ?? groupEmail;
          break;
        }
      }

      const key = `${role}:${source}`;
      const existing = counts.get(key);
      if (existing) {
        existing.count++;
      } else {
        counts.set(key, { role, count: 1, source });
      }
    }

    return Array.from(counts.values()).map(({ role, count, source }) => ({
      role,
      count,
      source,
    }));
  }, [selectedUsers, defaultRole, groupMappings, userGroupMemberships, groups, t]);

  const importMutation = useMutation({
    ...trpc.googleWorkspace.bulkImport.mutationOptions(),
    onSuccess: data => {
      const succeededCount = data.succeeded.length;
      const failedCount = data.failed.length;

      if (failedCount === 0) {
        toast.success(t('successToast', { count: succeededCount }));
        handleOpenChange(false);
      } else {
        toast.error(
          t('partialError', {
            succeeded: succeededCount,
            total: succeededCount + failedCount,
            failed: failedCount,
          }),
        );
      }

      void queryClient.invalidateQueries({
        queryKey: trpc.googleWorkspace.listDirectory.queryKey(),
      });
      void queryClient.invalidateQueries({
        queryKey: trpc.googleWorkspace.syncStatus.queryKey(),
      });
    },
    onError: () => {
      toast.error(t('fetchError'));
    },
  });

  const handleConfirmImport = useCallback(() => {
    const usersPayload = selectedUsers.map(u => ({
      email: u.primaryEmail,
      name: u.name.fullName,
      googleUserId: u.id,
    }));

    const groupRoleMappingsPayload = Array.from(groupMappings.entries()).map(
      ([groupEmail, role]) => ({
        groupEmail,
        groupName: groups.find(g => g.email === groupEmail)?.name ?? groupEmail,
        role,
      }),
    );

    importMutation.mutate({
      users: usersPayload,
      defaultRole,
      groupRoleMappings: groupRoleMappingsPayload,
      userRoleOverrides: {},
      userGroupMemberships,
    });
  }, [selectedUsers, defaultRole, groupMappings, groups, userGroupMemberships, importMutation]);

  const stepsConfig: Array<{ step: WizardStep; label: string }> = [
    { step: 1, label: t('step1Title') },
    { step: 2, label: t('step2Title') },
    { step: 3, label: t('step3Title') },
  ];

  return {
    open,
    handleOpenChange,
    step,
    setStep,
    selectedEmails,
    setSelectedEmails,
    defaultRole,
    setDefaultRole,
    groupMappings,
    handleGroupMappingChange,
    directoryQuery,
    directoryData,
    users,
    stats,
    listGroupsMutation,
    handleGoToStep2,
    groups,
    selectedUsers,
    roleBreakdown,
    importMutation,
    handleConfirmImport,
    stepsConfig,
    t,
  } as const;
}
