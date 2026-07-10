import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { useCommonToasts } from '../../../i18n/use-common-toasts.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

// ---------------------------------------------------------------------------
// Low-level data access — primitives reused by section-level hooks.
// ---------------------------------------------------------------------------

export function usePeppolStatus() {
  const trpc = useTRPC();
  const statusQuery = useQuery(trpc.peppol.getStatus.queryOptions());
  const participantQuery = useQuery(trpc.peppol.getParticipant.queryOptions());

  return { statusQuery, participantQuery } as const;
}

export function usePeppolDisconnect() {
  const trpc = useTRPC();
  const t = useTranslations('Peppol.statusCard');
  const queryClient = useQueryClient();

  return useMutation(
    trpc.peppol.disconnect.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.disconnected'));
        queryClient.invalidateQueries({
          queryKey: trpc.peppol.getStatus.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.peppol.getParticipant.queryKey(),
        });
      },
      onError: error => {
        toast.error(error.message || t('toast.disconnectError'));
      },
    }),
  );
}

export function usePeppolConnect(options?: {
  onSuccess?: () => void;
  onError?: (msg: string) => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const toasts = useCommonToasts();

  return useMutation(
    trpc.peppol.connect.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.peppol.getStatus.queryKey(),
        });
        toast.success(toasts.done());
        options?.onSuccess?.();
      },
      onError: error => {
        const msg = error.message || 'Registration failed';
        toast.error(error.message);
        options?.onError?.(msg);
      },
    }),
  );
}

export function usePeppolRetryTransmission() {
  const trpc = useTRPC();
  const t = useTranslations('Peppol.transmission');
  const queryClient = useQueryClient();

  return useMutation(
    trpc.peppol.retryTransmission.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.retryQueued'));
        queryClient.invalidateQueries({
          queryKey: trpc.peppol.getTransmissions.queryKey(),
        });
      },
      onError: error => {
        toast.error(error.message || t('toast.retryFailed'));
      },
    }),
  );
}

// ---------------------------------------------------------------------------
// Section-level hooks — return props bags + flags consumed directly by views.
// ---------------------------------------------------------------------------

export interface PeppolStatusCardProps {
  isLoading: boolean;
  isConnected: boolean;
  participant:
    | NonNullable<ReturnType<typeof usePeppolStatus>['statusQuery']['data']>['participant']
    | null;
  connection:
    | NonNullable<ReturnType<typeof usePeppolStatus>['statusQuery']['data']>['connection']
    | null;
  counts:
    | NonNullable<ReturnType<typeof usePeppolStatus>['participantQuery']['data']>['_count']
    | null;
  onDisconnect: () => void;
  isDisconnecting: boolean;
}

export function usePeppolStatusCard(): PeppolStatusCardProps {
  const { statusQuery, participantQuery } = usePeppolStatus();
  const disconnect = usePeppolDisconnect();

  const isLoading = statusQuery.isLoading;
  const isConnected = !!statusQuery.data;
  const participant = statusQuery.data?.participant ?? null;
  const connection = statusQuery.data?.connection ?? null;
  const counts = participantQuery.data?._count ?? null;

  const onDisconnect = useCallback(() => {
    disconnect.mutate(undefined as never);
  }, [disconnect]);

  return {
    isLoading,
    isConnected,
    participant,
    connection,
    counts,
    onDisconnect,
    isDisconnecting: disconnect.isPending,
  };
}

export interface PeppolTransmissionStatusInput {
  transmissionId: string;
  status: string;
}

export interface PeppolTransmissionStatusProps {
  isFailed: boolean;
  onRetry: () => void;
  isRetrying: boolean;
}

export function usePeppolTransmissionStatus(
  input: PeppolTransmissionStatusInput,
): PeppolTransmissionStatusProps {
  const retry = usePeppolRetryTransmission();
  const isFailed = input.status === 'FAILED' || input.status === 'REJECTED';

  const onRetry = useCallback(() => {
    retry.mutate({ transmissionId: input.transmissionId });
  }, [retry, input.transmissionId]);

  return {
    isFailed,
    onRetry,
    isRetrying: retry.isPending,
  };
}

export type PeppolWizardStep = 1 | 2 | 3 | 4 | 5;
export type PeppolWizardEnvironment = 'sandbox' | 'production';
export type PeppolWizardAsp = 'storecove';

export interface PeppolWizardProps {
  step: PeppolWizardStep;
  trn: string;
  setTrn: (value: string) => void;
  aspProvider: PeppolWizardAsp;
  apiKey: string;
  setApiKey: (value: string) => void;
  showApiKey: boolean;
  toggleShowApiKey: () => void;
  environment: PeppolWizardEnvironment;
  setEnvironment: (value: PeppolWizardEnvironment) => void;
  participantId: string;
  canGoNext: boolean;
  isPending: boolean;
  registrationError: string | null;
  next: () => void;
  back: () => void;
  retry: () => void;
  resetAndClose: () => void;
}

export function usePeppolWizard(options: {
  onOpenChange: (open: boolean) => void;
}): PeppolWizardProps {
  const { onOpenChange } = options;
  const [step, setStep] = useState<PeppolWizardStep>(1);
  const [trn, setTrn] = useState('');
  const [aspProvider] = useState<PeppolWizardAsp>('storecove');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [environment, setEnvironment] = useState<PeppolWizardEnvironment>('sandbox');
  const [registrationError, setRegistrationError] = useState<string | null>(null);

  const connect = usePeppolConnect({
    onSuccess: () => setStep(5),
    onError: msg => setRegistrationError(msg),
  });

  const participantId = trn.length === 15 ? `0235:${trn}` : '';
  const canGoNext =
    (step === 1 && trn.length === 15 && /^\d{15}$/.test(trn)) ||
    step === 2 ||
    (step === 3 && apiKey.length > 0);

  const submitRegistration = useCallback(() => {
    setRegistrationError(null);
    connect.mutate({ trn, aspProvider, apiKey, environment });
  }, [connect, trn, aspProvider, apiKey, environment]);

  const next = useCallback(() => {
    if (step === 3) {
      setStep(4);
      submitRegistration();
      return;
    }
    if (step < 5) {
      setStep((step + 1) as PeppolWizardStep);
    }
  }, [step, submitRegistration]);

  const back = useCallback(() => {
    if (step > 1) {
      setStep((step - 1) as PeppolWizardStep);
    }
  }, [step]);

  const retry = useCallback(() => {
    submitRegistration();
  }, [submitRegistration]);

  const resetAndClose = useCallback(() => {
    setStep(1);
    setTrn('');
    setApiKey('');
    setShowApiKey(false);
    setEnvironment('sandbox');
    setRegistrationError(null);
    onOpenChange(false);
  }, [onOpenChange]);

  const toggleShowApiKey = useCallback(() => {
    setShowApiKey(v => !v);
  }, []);

  return {
    step,
    trn,
    setTrn,
    aspProvider,
    apiKey,
    setApiKey,
    showApiKey,
    toggleShowApiKey,
    environment,
    setEnvironment,
    participantId,
    canGoNext,
    isPending: connect.isPending,
    registrationError,
    next,
    back,
    retry,
    resetAndClose,
  };
}
