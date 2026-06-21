import * as Sentry from '@sentry/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import type { FieldPath, FieldPathValue, UseFormReturn } from 'react-hook-form';
import { toast } from 'sonner';

import { useTranslatedError } from '../../../i18n/use-translated-error.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';
import type { ContractWizardFormValues } from '../contract-wizard/wizard-dialog.js';

type PrefillEntry = {
  [P in FieldPath<ContractWizardFormValues>]: {
    field: P;
    value: FieldPathValue<ContractWizardFormValues, P>;
  };
}[FieldPath<ContractWizardFormValues>];

/**
 * Map the saved contractor record onto the contract-wizard fields it can
 * seed, in apply order. Each field is guarded independently; absent/invalid
 * values are skipped so the form keeps its own defaults.
 */
function collectContractorPrefill(contractor: Record<string, unknown>): PrefillEntry[] {
  const entries: PrefillEntry[] = [];

  if (contractor.currency) {
    entries.push({ field: 'currency', value: contractor.currency as string });
  }

  const customFields = contractor.customFieldsJson as Record<string, unknown> | null;
  if (customFields) {
    if (typeof customFields.billingModel === 'string') {
      entries.push({
        field: 'billingModel',
        value: customFields.billingModel as ContractWizardFormValues['billingModel'],
      });
    }
    if (typeof customFields.rateValueMinor === 'number' && customFields.rateValueMinor > 0) {
      entries.push({ field: 'rateValueMinor', value: customFields.rateValueMinor });
    }
  }

  return entries;
}

export function useContractWizardPrefill(
  form: UseFormReturn<ContractWizardFormValues>,
  contractorId: string | undefined,
  onPrefilled: (fields: Set<string>) => void,
) {
  const trpc = useTRPC();
  const hasPreFilled = useRef(false);

  const contractorQuery = useQuery({
    ...trpc.contractor.getById.queryOptions({ id: contractorId ?? '' }),
    enabled: !!contractorId,
  });

  useEffect(() => {
    if (contractorQuery.data && !hasPreFilled.current) {
      hasPreFilled.current = true;
      const preFilledSet = new Set<string>();

      const contractor = contractorQuery.data as Record<string, unknown>;
      for (const { field, value } of collectContractorPrefill(contractor)) {
        form.setValue(field, value, { shouldDirty: false });
        preFilledSet.add(field);
      }

      onPrefilled(preFilledSet);
    }
  }, [contractorQuery.data, form, onPrefilled]);

  const resetPrefill = useCallback(() => {
    hasPreFilled.current = false;
  }, []);

  return { resetPrefill } as const;
}

export function useContractWizardCreate(uploadedDocumentIds: string[], onSuccess: () => void) {
  const t = useTranslations('Contracts.wizard');
  const translateError = useTranslatedError();
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  const linkToEntityMutation = useMutation(
    trpc.document.linkToEntity.mutationOptions({
      onError: err => toast.error(translateError(err) || t('error')),
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.document.pathFilter());
      },
    }),
  );

  const linkDocuments = useCallback(
    async (contractId: string) => {
      for (const docId of uploadedDocumentIds) {
        try {
          await linkToEntityMutation.mutateAsync({
            documentId: docId,
            entityType: 'CONTRACT',
            entityId: contractId,
          } as Parameters<typeof linkToEntityMutation.mutateAsync>[0]);
        } catch (error) {
          Sentry.captureException(error, {
            tags: { feature: 'contract-wizard' },
            extra: { documentId: docId, contractId },
          });
        }
      }
    },
    [linkToEntityMutation, uploadedDocumentIds],
  );

  const createMutation = useMutation(
    trpc.contract.create.mutationOptions({
      onSuccess: async data => {
        const contractId = (data as Record<string, unknown>).id as string;

        if (uploadedDocumentIds.length > 0) {
          await linkDocuments(contractId);
        }

        toast.success(t('success'));
        queryClient.invalidateQueries({ queryKey: ['contract'] });
        onSuccess();
      },
      onError: () => {
        toast.error(t('error'));
      },
    }),
  );

  return {
    createMutation,
    isPending: createMutation.isPending,
    submitCreate: createMutation.mutate,
  } as const;
}
