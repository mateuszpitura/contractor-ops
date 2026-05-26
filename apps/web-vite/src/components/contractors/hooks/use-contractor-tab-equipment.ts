import { useQuery } from '@tanstack/react-query';

import { useTRPC } from '../../../providers/trpc-provider.js';

export type ContractorTabEquipmentItem = {
  assignmentId: string;
  assignedAt: string;
  equipment: {
    id: string;
    name: string;
    serialNumber: string | null;
    type: string;
    status: string;
  };
  latestShipment: {
    id: string;
    carrier: string;
    currentStatus: string;
    trackingNumber: string | null;
  } | null;
};

export function useContractorTabEquipment(contractorId: string) {
  const trpc = useTRPC();
  const query = useQuery(trpc.equipment.listByContractor.queryOptions({ contractorId }));
  const items = (query.data ?? []) as unknown as ContractorTabEquipmentItem[];

  return {
    items,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
  } as const;
}
