import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useId, useState } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';
import { useCourierConfigs } from './use-courier-configs.js';

interface DpdCredentials {
  username: string;
  password: string;
  fid: string;
  sandbox: boolean;
}

interface UpsCredentials {
  clientId: string;
  clientSecret: string;
  accountNumber: string;
  sandbox: boolean;
}

export function useCarrierCredentialForm(carrier: 'dpd' | 'ups') {
  const trpc = useTRPC();
  const id = useId();
  const t = useTranslations('Settings.carriers');
  const queryClient = useQueryClient();
  const { isConfigured } = useCourierConfigs();
  const isConnected = isConfigured(carrier);

  const [dpdCreds, setDpdCreds] = useState<DpdCredentials>({
    username: '',
    password: '',
    fid: '',
    sandbox: false,
  });

  const [upsCreds, setUpsCreds] = useState<UpsCredentials>({
    clientId: '',
    clientSecret: '',
    accountNumber: '',
    sandbox: false,
  });

  const saveMutation = useMutation(
    trpc.equipment.saveCourierConfig.mutationOptions({
      onSuccess: () => {
        toast.success(t('credentialsSaved'));
        queryClient.invalidateQueries({
          queryKey: trpc.equipment.getCourierConfigs.queryKey(),
        });
      },
      onError: () => {
        toast.error(t('saveFailed'));
      },
    }),
  );

  const testMutation = useMutation(
    trpc.equipment.testCourierConnection.mutationOptions({
      onSuccess: () => {
        toast.success(t('connectionVerified'));
        queryClient.invalidateQueries(trpc.equipment.pathFilter());
      },
      onError: () => {
        toast.error(t('connectionFailed'));
      },
    }),
  );

  const handleSave = useCallback(() => {
    const credentials =
      carrier === 'dpd'
        ? { carrier: 'dpd' as const, ...dpdCreds }
        : { carrier: 'ups' as const, ...upsCreds };
    saveMutation.mutate(credentials);
  }, [carrier, dpdCreds, upsCreds, saveMutation]);

  const handleTest = useCallback(() => {
    const credentials =
      carrier === 'dpd'
        ? { carrier: 'dpd' as const, ...dpdCreds }
        : { carrier: 'ups' as const, ...upsCreds };
    testMutation.mutate(credentials);
  }, [carrier, dpdCreds, upsCreds, testMutation]);

  const isPending = saveMutation.isPending || testMutation.isPending;

  return {
    id,
    t,
    carrier,
    isConnected,
    dpdCreds,
    setDpdCreds,
    upsCreds,
    setUpsCreds,
    handleSave,
    handleTest,
    isPending,
    isTestPending: testMutation.isPending,
    isSavePending: saveMutation.isPending,
  } as const;
}
