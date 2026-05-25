import type { ConsentPurpose } from '@contractor-ops/validators';
import { OPTIONAL_PURPOSES, REQUIRED_PURPOSES } from '@contractor-ops/validators';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

function downloadHtml(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

interface PrivacyNoticeSection {
  title: string;
  content: string;
}

interface PrivacyNotice {
  jurisdiction: string;
  legalReference: string;
  controller: { name: string; country: string };
  sections: PrivacyNoticeSection[];
}

interface ConsentRecord {
  id: string;
  purpose: ConsentPurpose;
  granted: boolean;
  createdAt: string | Date;
  version: number;
}

interface CrossBorderStatus {
  detected: boolean;
  orgRegion?: string | null;
  hostingRegion?: string | null;
}

export interface ConsentPurposeToggleData {
  purpose: ConsentPurpose;
  required: boolean;
  granted: boolean;
  disabled: boolean;
}

export interface ConsentHistoryEntry {
  id: string;
  purpose: string;
  granted: boolean;
  createdAt: string | Date;
  version: number;
}

export interface UseConsentManagementResult {
  isLoading: boolean;
  showNotRequired: boolean;
  notice: PrivacyNotice | undefined;
  purposeToggles: ConsentPurposeToggleData[];
  onToggle: (purpose: ConsentPurpose, granted: boolean) => void;
  consentHistory: ConsentHistoryEntry[];
  hasConsentHistory: boolean;
  crossBorder: CrossBorderStatus | undefined;
  showCrossBorder: boolean;
  dpaDownload: { onDownload: () => void; isPending: boolean };
  sccDownload: { onDownload: () => void; isPending: boolean };
}

export function useConsentManagement(): UseConsentManagementResult {
  const trpc = useTRPC();
  const t = useTranslations('Consent');
  const queryClient = useQueryClient();

  const noticeQuery = useQuery(trpc.consent.getPrivacyNotice.queryOptions());
  const consentQuery = useQuery(trpc.consent.getCurrentConsent.queryOptions());
  const historyQuery = useQuery(trpc.consent.getConsentHistory.queryOptions({}));
  const crossBorderQuery = useQuery(trpc.consent.getCrossBorderStatus.queryOptions());

  const grantMutation = useMutation(
    trpc.consent.grant.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.consent.getCurrentConsent.queryKey(),
        });
        void queryClient.invalidateQueries({
          queryKey: trpc.consent.getConsentHistory.queryKey({}),
        });
        toast.success(t('settings.consentUpdated'));
      },
      onError: error => {
        toast.error(error.message);
      },
    }),
  );

  const downloadDPAMutation = useMutation(
    trpc.consent.downloadDPA.mutationOptions({
      onSuccess: data => {
        downloadHtml(data.content, data.filename);
        toast.success(t('settings.dpaDownloaded'));
        void queryClient.invalidateQueries(trpc.consent.pathFilter());
      },
      onError: error => {
        toast.error(error.message);
      },
    }),
  );

  const downloadSCCMutation = useMutation(
    trpc.consent.downloadSCC.mutationOptions({
      onSuccess: data => {
        downloadHtml(data.content, data.filename);
        toast.success(t('settings.sccDownloaded'));
        void queryClient.invalidateQueries(trpc.consent.pathFilter());
      },
      onError: error => {
        if (error.data?.code === 'NOT_FOUND') {
          toast.info(t('settings.sccNotRequired'));
        } else {
          toast.error(error.message);
        }
      },
    }),
  );

  const onToggle = useCallback(
    (purpose: ConsentPurpose, granted: boolean) => {
      grantMutation.mutate({ purpose, granted });
    },
    [grantMutation],
  );

  const onDownloadDPA = useCallback(() => {
    downloadDPAMutation.mutate();
  }, [downloadDPAMutation]);

  const onDownloadSCC = useCallback(() => {
    downloadSCCMutation.mutate();
  }, [downloadSCCMutation]);

  const isLoading = noticeQuery.isLoading || consentQuery.isLoading;
  const notice = noticeQuery.data as PrivacyNotice | undefined;
  const showNotRequired = !(isLoading || notice);

  const currentConsent = consentQuery.data as
    | Partial<Record<ConsentPurpose, { granted: boolean } | undefined>>
    | undefined;
  const grantPending = grantMutation.isPending;

  const purposeToggles = useMemo<ConsentPurposeToggleData[]>(
    () =>
      [...REQUIRED_PURPOSES, ...OPTIONAL_PURPOSES].map(purpose => ({
        purpose,
        required: REQUIRED_PURPOSES.includes(purpose),
        granted: currentConsent?.[purpose]?.granted ?? false,
        disabled: grantPending,
      })),
    [currentConsent, grantPending],
  );

  const historyData = (historyQuery.data ?? []) as ConsentRecord[];
  const consentHistory = useMemo<ConsentHistoryEntry[]>(
    () =>
      historyData.map(record => ({
        id: record.id,
        purpose: record.purpose.toLowerCase().replace(/_/g, ' '),
        granted: record.granted,
        createdAt: record.createdAt,
        version: record.version,
      })),
    [historyData],
  );
  const hasConsentHistory = consentHistory.length > 0;

  const crossBorder = crossBorderQuery.data as CrossBorderStatus | undefined;
  const showCrossBorder = !!crossBorder;

  return {
    isLoading,
    showNotRequired,
    notice,
    purposeToggles,
    onToggle,
    consentHistory,
    hasConsentHistory,
    crossBorder,
    showCrossBorder,
    dpaDownload: {
      onDownload: onDownloadDPA,
      isPending: downloadDPAMutation.isPending,
    },
    sccDownload: {
      onDownload: onDownloadSCC,
      isPending: downloadSCCMutation.isPending,
    },
  };
}
