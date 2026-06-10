import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { usePortalTRPC } from '../../../providers/trpc-provider.js';
import type { PaczkomatPoint } from '../../equipment/paczkomat-picker.js';

export function usePortalReturnFlow(options: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnRequest?: {
    id: string;
    status: string;
    shipmentId: string | null;
    targetPointName: string | null;
  } | null;
  onSuccess: () => void;
}) {
  const t = useTranslations('Portal.return');
  const trpc = usePortalTRPC();
  const queryClient = useQueryClient();

  const getInitialStep = useCallback(() => {
    if (options.returnRequest?.status === 'SHIPMENT_CREATED') return 3;
    if (options.returnRequest?.status === 'PENDING_APPROVAL') return 2;
    return 1;
  }, [options.returnRequest?.status]);

  const [step, setStep] = useState(getInitialStep);
  const [selectedPoint, setSelectedPoint] = useState<PaczkomatPoint | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleOpenChange = useCallback(
    (v: boolean) => {
      if (v) {
        setStep(getInitialStep());
        setSelectedPoint(null);
      }
      options.onOpenChange(v);
    },
    [options, getInitialStep],
  );

  const requestMutation = useMutation(
    trpc.portal.requestReturn.mutationOptions({
      onSuccess: () => {
        toast.success(t('returnRequested'));
        void queryClient.invalidateQueries({
          queryKey: trpc.portal.getReturnStatus.queryKey(),
        });
        void queryClient.invalidateQueries({
          queryKey: trpc.portal.listEquipment.queryKey(),
        });
        options.onSuccess();
      },
      onError: () => {
        toast.error(t('returnRequested'));
      },
    }),
  );

  const handleRequestReturn = useCallback(() => {
    if (!selectedPoint) return;
    requestMutation.mutate({
      targetPointId: selectedPoint.id,
      targetPointName: selectedPoint.name,
      targetPointAddress: selectedPoint.address,
    });
  }, [selectedPoint, requestMutation]);

  const labelQuery = useQuery({
    ...trpc.portal.getReturnLabel.queryOptions({
      returnRequestId: options.returnRequest?.id ?? '',
    }),
    enabled: step === 3 && !!options.returnRequest?.id,
  });

  const labelData = labelQuery.data as { data: string; contentType: string } | undefined;

  const geowidgetToken: string = import.meta.env.VITE_INPOST_GEOWIDGET_TOKEN ?? '';

  return {
    step,
    setStep,
    selectedPoint,
    setSelectedPoint,
    pickerOpen,
    setPickerOpen,
    handleOpenChange,
    handleRequestReturn,
    requestMutation,
    labelQuery,
    labelData,
    geowidgetToken,
  } as const;
}
