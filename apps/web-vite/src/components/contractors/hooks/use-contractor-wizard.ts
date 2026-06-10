import type { AppRouter } from '@contractor-ops/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { inferRouterOutputs } from '@trpc/server';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';
import type { WizardFormValues } from '../contractor-wizard/wizard-dialog.js';

type UserListItem = inferRouterOutputs<AppRouter>['user']['list'][number];

export function useContractorWizardAssignmentOptions() {
  const trpc = useTRPC();

  const usersQuery = useQuery(trpc.user.list.queryOptions());
  const users: UserListItem[] = Array.isArray(usersQuery.data) ? usersQuery.data : [];

  const teamsQuery = useQuery(
    trpc.organizationDefinitions.team.list.queryOptions({ status: 'ACTIVE', limit: 200 }),
  );
  const projectsQuery = useQuery(
    trpc.organizationDefinitions.project.list.queryOptions({ status: 'ACTIVE', limit: 200 }),
  );
  const costCentersQuery = useQuery(
    trpc.organizationDefinitions.costCenter.list.queryOptions({ status: 'ACTIVE', limit: 200 }),
  );

  const ownerItems = users.map(member => {
    const userId = String(member.userId ?? member.id ?? '');
    const label = String(member.name ?? member.email ?? userId);
    return { value: userId, label };
  });

  return {
    ownerItems,
    teams: teamsQuery.data?.items ?? [],
    projects: projectsQuery.data?.items ?? [],
    costCenters: costCentersQuery.data?.items ?? [],
  } as const;
}

export function useContractorCompanyLookup() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const t = useTranslations('ContractorWizard.fields');
  const tv = useTranslations('Validation.contractor');
  const [isLookupLoading, setIsLookupLoading] = useState(false);

  const lookup = useCallback(
    async (
      nipValue: string,
      setValue: (
        name: keyof WizardFormValues,
        value: string,
        options?: { shouldDirty?: boolean },
      ) => void,
    ) => {
      const cleanNip = (nipValue ?? '').replace(/[\s-]/g, '');
      if (cleanNip.length !== 10) {
        toast.error(tv('nipFormat'));
        return;
      }

      setIsLookupLoading(true);
      try {
        const data = (await queryClient.fetchQuery(
          trpc.contractor.companyLookup.queryOptions({ nip: cleanNip }),
        )) as Record<string, unknown>;

        if (data?.found) {
          const fieldMap: [string, keyof WizardFormValues][] = [
            ['legalName', 'legalName'],
            ['legalName', 'displayName'],
            ['regon', 'registrationNumber'],
            ['addressLine1', 'addressLine1'],
            ['city', 'city'],
            ['postalCode', 'postalCode'],
          ];
          for (const [sourceKey, targetKey] of fieldMap) {
            if (data[sourceKey]) {
              setValue(targetKey, String(data[sourceKey]), { shouldDirty: true });
            }
          }
          toast.success(t('nipSuccess'));
        } else {
          toast.error(t('nipError'));
        }
      } catch {
        toast.error(t('nipError'));
      } finally {
        setIsLookupLoading(false);
      }
    },
    [queryClient, t, trpc.contractor.companyLookup, tv],
  );

  return { lookup, isLookupLoading } as const;
}

export function useContractorWizardCreate(onSuccess: () => void) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const t = useTranslations('ContractorWizard');

  return useMutation(
    trpc.contractor.create.mutationOptions({
      onSuccess: () => {
        toast.success(t('success'));
        queryClient.invalidateQueries({ queryKey: ['contractor'] });
        onSuccess();
      },
      onError: (error: unknown) => {
        const message =
          typeof error === 'object' && error && 'message' in error
            ? String((error as { message?: unknown }).message ?? '')
            : '';
        toast.error(message || t('error'));
      },
    }),
  );
}
