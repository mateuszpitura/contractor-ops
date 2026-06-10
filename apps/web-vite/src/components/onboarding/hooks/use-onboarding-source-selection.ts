import { useQuery, useQueryClient } from '@tanstack/react-query';
import { TRPCClientError } from '@trpc/client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { useRouter } from '../../../i18n/navigation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export interface OnboardingSource {
  provider: string;
  connected: boolean;
}

export interface UseOnboardingSourceSelectionParams {
  selectedSources: string[];
  onSourcesChange: (sources: string[]) => void;
}

export interface UseOnboardingSourceSelectionResult {
  isLoading: boolean;
  isError: boolean;
  sources: OnboardingSource[];
  selectedSources: string[];
  handleToggle: (provider: string) => void;
  handleConnect: (provider: string) => Promise<void>;
  handleRefetch: () => void;
  handleSkip: () => void;
  connectingProvider: string | null;
}

const POPUP_W = 600;
const POPUP_H = 700;

export function useOnboardingSourceSelection(
  params: UseOnboardingSourceSelectionParams,
): UseOnboardingSourceSelectionResult {
  const { selectedSources, onSourcesChange } = params;
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const t = useTranslations('OnboardingImport');

  const sourcesQuery = useQuery(trpc.onboardingImport.listSources.queryOptions());
  const sources = (sourcesQuery.data ?? []) as OnboardingSource[];
  const oauthPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (oauthPollRef.current) {
        clearInterval(oauthPollRef.current);
        oauthPollRef.current = null;
      }
    };
  }, []);

  const handleToggle = useCallback(
    (provider: string) => {
      if (selectedSources.includes(provider)) {
        onSourcesChange(selectedSources.filter(s => s !== provider));
      } else {
        onSourcesChange([...selectedSources, provider]);
      }
    },
    [selectedSources, onSourcesChange],
  );

  const handleConnect = useCallback(
    async (provider: string) => {
      if (connectingProvider) return;
      setConnectingProvider(provider);
      try {
        const result = await queryClient.fetchQuery(
          trpc.integration.getOAuthUrlGeneric.queryOptions({ provider }),
        );
        const url = result?.url;
        if (!url) {
          toast.error(t('step1.connectError'));
          return;
        }

        const left = window.screenX + (window.outerWidth - POPUP_W) / 2;
        const top = window.screenY + (window.outerHeight - POPUP_H) / 2;
        const popup = window.open(
          url,
          `oauth-${provider}`,
          `width=${POPUP_W},height=${POPUP_H},left=${left},top=${top}`,
        );

        if (!popup) {
          toast.error(t('step1.popupBlocked'));
          return;
        }

        if (oauthPollRef.current) {
          clearInterval(oauthPollRef.current);
        }
        oauthPollRef.current = setInterval(() => {
          if (popup.closed) {
            if (oauthPollRef.current) {
              clearInterval(oauthPollRef.current);
              oauthPollRef.current = null;
            }
            void sourcesQuery.refetch();
          }
        }, 500);
      } catch (error) {
        if (error instanceof TRPCClientError && error.data?.code === 'FORBIDDEN') {
          toast.error(t('step1.connectPermissionError'));
        } else {
          toast.error(t('step1.connectError'));
        }
      } finally {
        setConnectingProvider(null);
      }
    },
    [connectingProvider, queryClient, trpc, sourcesQuery, t],
  );

  const handleRefetch = useCallback(() => {
    void sourcesQuery.refetch();
  }, [sourcesQuery]);

  const handleSkip = useCallback(() => {
    router.push('/settings?tab=members');
  }, [router]);

  return {
    isLoading: sourcesQuery.isLoading,
    isError: sourcesQuery.isError,
    sources,
    selectedSources,
    handleToggle,
    handleConnect,
    handleRefetch,
    handleSkip,
    connectingProvider,
  };
}
