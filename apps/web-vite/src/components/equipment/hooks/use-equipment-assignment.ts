import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useEquipmentAssignmentSearch(search: string) {
  const trpc = useTRPC();

  return useQuery(
    trpc.contractor.list.queryOptions({
      page: 1,
      pageSize: 50,
      search: search.length >= 2 ? search : undefined,
    }),
  );
}

export function useEquipmentAssign(options: {
  equipmentId: string;
  selectedContractorName: string;
  onSuccess: () => void;
}) {
  const { equipmentId, selectedContractorName, onSuccess } = options;
  const t = useTranslations('Equipment');
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const assignMutation = useMutation(
    trpc.equipment.assign.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.assigned', { name: selectedContractorName }));
        queryClient.invalidateQueries({
          queryKey: trpc.equipment.list.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.equipment.getById.queryKey(),
        });
        onSuccess();
      },
      onError: () => {
        toast.error(t('error.actionFailed'));
      },
    }),
  );

  const assign = useCallback(
    (contractorId: string) => {
      assignMutation.mutate({ equipmentId, contractorId });
    },
    [assignMutation, equipmentId],
  );

  return { assignMutation, assign, isPending: assignMutation.isPending } as const;
}

export function useAssignmentDialog(options: {
  equipmentId: string;
  onOpenChange: (open: boolean) => void;
}) {
  const [search, setSearch] = useState('');
  const [selectedContractorId, setSelectedContractorId] = useState<string | null>(null);
  const [selectedContractorName, setSelectedContractorName] = useState('');

  const contractorsQuery = useEquipmentAssignmentSearch(search);

  const contractors =
    (
      contractorsQuery.data as
        | { items: Array<{ id: string; displayName: string | null; legalName: string }> }
        | undefined
    )?.items ?? [];

  const resetSelection = useCallback(() => {
    setSelectedContractorId(null);
    setSelectedContractorName('');
    setSearch('');
  }, []);

  const { assignMutation, assign } = useEquipmentAssign({
    equipmentId: options.equipmentId,
    selectedContractorName,
    onSuccess: () => {
      options.onOpenChange(false);
      resetSelection();
    },
  });

  const handleAssign = useCallback(() => {
    if (!selectedContractorId) return;
    assign(selectedContractorId);
  }, [selectedContractorId, assign]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      options.onOpenChange(open);
      if (!open) resetSelection();
    },
    [options, resetSelection],
  );

  return {
    search,
    setSearch,
    selectedContractorId,
    setSelectedContractorId,
    selectedContractorName,
    setSelectedContractorName,
    contractorsQuery,
    contractors,
    assignMutation,
    handleAssign,
    handleOpenChange,
  } as const;
}
