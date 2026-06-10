import { useCallback } from 'react';

import { useResourceMutation } from '../../../hooks/use-resource-mutation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

const contractorPrefixKey = ['contractor'] as const;

export interface ContractorBulkActionsHandlers {
  onBulkArchive: (ids: string[]) => void;
  onBulkAssignOwner: (ids: string[], ownerUserId: string) => void;
  onExport: (ids: string[], format: 'csv' | 'xlsx') => void;
  isArchiving: boolean;
  isAssigningOwner: boolean;
  isExporting: boolean;
}

export function useContractorBulkActions(count: number): ContractorBulkActionsHandlers {
  const trpc = useTRPC();
  const tc = useTranslations('Contractors');

  const bulkArchiveMutation = useResourceMutation(trpc.contractor.bulkArchive.mutationOptions(), {
    invalidate: [contractorPrefixKey],
    successMessage: tc('archived', { count }),
    errorMessage: tc('error.loadFailed'),
  });

  const bulkAssignOwnerMutation = useResourceMutation(
    trpc.contractor.bulkAssignOwner.mutationOptions(),
    {
      invalidate: [contractorPrefixKey],
      successMessage: tc('ownerAssigned', { count }),
      errorMessage: tc('error.loadFailed'),
    },
  );

  const exportMutation = useResourceMutation(
    trpc.contractor.export.mutationOptions({
      onSuccess: data => {
        const result = data as {
          data: string;
          filename: string;
          mimeType: string;
        };
        const binaryStr = atob(result.data);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: result.mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.filename;
        a.click();
        URL.revokeObjectURL(url);
      },
    }),
    {
      invalidate: [contractorPrefixKey],
      successMessage: tc('exported', { count }),
      errorMessage: tc('error.loadFailed'),
    },
  );

  const onBulkArchive = useCallback(
    (ids: string[]) => {
      bulkArchiveMutation.mutate({ ids });
    },
    [bulkArchiveMutation],
  );

  const onBulkAssignOwner = useCallback(
    (ids: string[], ownerUserId: string) => {
      bulkAssignOwnerMutation.mutate({ ids, ownerUserId });
    },
    [bulkAssignOwnerMutation],
  );

  const onExport = useCallback(
    (ids: string[], format: 'csv' | 'xlsx') => {
      exportMutation.mutate({ ids, format });
    },
    [exportMutation],
  );

  return {
    onBulkArchive,
    onBulkAssignOwner,
    onExport,
    isArchiving: bulkArchiveMutation.isPending,
    isAssigningOwner: bulkAssignOwnerMutation.isPending,
    isExporting: exportMutation.isPending,
  };
}
