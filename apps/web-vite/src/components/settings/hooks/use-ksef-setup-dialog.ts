import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

type KsefConnectInput =
  | { authMethod: 'token'; token: string; environment: string }
  | {
      authMethod: 'certificate';
      certificateBase64: string;
      certificatePassword?: string;
      environment: string;
    };

interface UseKsefSetupDialogOptions {
  onOpenChange: (open: boolean) => void;
  orgNip: string | null;
}

export function useKsefSetupDialog({ onOpenChange, orgNip }: UseKsefSetupDialogOptions) {
  const trpc = useTRPC();
  const id = useId();
  const t = useTranslations('ksef');
  const queryClient = useQueryClient();

  const [authMethod, setAuthMethod] = useState<'token' | 'certificate'>('token');
  const [token, setToken] = useState('');
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [certificatePassword, setCertificatePassword] = useState('');
  const [environment] = useState<'test' | 'prod'>('prod');

  const connectMutation = useMutation(
    trpc.ksef.connect.mutationOptions({
      onSuccess: () => {
        toast.success(t('connectedToast'));
        queryClient.invalidateQueries({
          queryKey: trpc.ksef.connectionStatus.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.integration.getHealth.queryKey({ provider: 'ksef' }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.integration.getAllHealth.queryKey(),
        });
        resetAndClose();
      },
      onError: (error: { message?: string }) => {
        toast.error(error.message || t('connectionFailedToast'));
      },
    }),
  );

  function resetAndClose() {
    setToken('');
    setCertificateFile(null);
    setCertificatePassword('');
    setAuthMethod('token');
    onOpenChange(false);
  }

  async function handleSave() {
    if (authMethod === 'token') {
      (connectMutation.mutate as (input: KsefConnectInput) => void)({
        authMethod: 'token' as const,
        token,
        environment,
      });
    } else {
      let certificateBase64 = '';
      if (certificateFile) {
        const buffer = await certificateFile.arrayBuffer();
        certificateBase64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      }
      (connectMutation.mutate as (input: KsefConnectInput) => void)({
        authMethod: 'certificate' as const,
        certificateBase64,
        certificatePassword: certificatePassword || undefined,
        environment,
      });
    }
  }

  const isFormDisabled = !orgNip || connectMutation.isPending;
  const isSaveDisabled =
    isFormDisabled ||
    (authMethod === 'token' && !token.trim()) ||
    (authMethod === 'certificate' && !certificateFile);

  return {
    id,
    t,
    authMethod,
    setAuthMethod,
    token,
    setToken,
    certificateFile,
    setCertificateFile,
    certificatePassword,
    setCertificatePassword,
    isFormDisabled,
    isSaveDisabled,
    resetAndClose,
    handleSave,
    isPending: connectMutation.isPending,
  } as const;
}
