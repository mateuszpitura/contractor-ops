/**
 * Data hook for the shipment timeline — mutation to append a new
 * shipment-event row. Pulled out of the component to satisfy
 * `scripts/check-web-vite-data-layer.mjs` (no `useMutation` outside
 * `hooks/`). Ported alongside `shipment-timeline.tsx` from legacy
 * apps/web (commit 62a97d73).
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

const UPDATABLE_STATUSES = [
  'LABEL_GENERATED',
  'PICKED_UP',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'FAILED',
  'RETURNED',
] as const;

type UpdatableStatus = (typeof UPDATABLE_STATUSES)[number];

export function useShipmentTimeline() {
  const t = useTranslations('Equipment');
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const addEvent = useMutation(
    trpc.equipment.addShipmentEvent.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.statusUpdated'));
        void queryClient.invalidateQueries({
          queryKey: trpc.equipment.getById.queryKey(),
        });
      },
      onError: () => {
        toast.error(t('error.actionFailed'));
      },
    }),
  );

  return {
    addEvent: (input: { shipmentId: string; status: UpdatableStatus; notes?: string }) =>
      addEvent.mutate(input),
    isAdding: addEvent.isPending,
  } as const;
}

export type { UpdatableStatus };
export { UPDATABLE_STATUSES };
