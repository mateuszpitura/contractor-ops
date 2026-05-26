import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { useLocale } from '../../../../i18n/navigation.js';
import { useFormatter } from '../../../../i18n/useFormatter.js';
import { useTranslations } from '../../../../i18n/useTranslations.js';
import { useTRPC } from '../../../../providers/trpc-provider.js';

export function useWhtCertificatesSection() {
  const trpc = useTRPC();
  const t = useTranslations('TaxAdmin.certificates');
  const format = useFormatter();
  const locale = useLocale();

  const [openId, setOpenId] = useState<string | null>(null);
  const [downloadPending, setDownloadPending] = useState(false);

  const listQuery = useQuery(trpc.tax.listWhtCertificates.queryOptions());

  const detailQuery = useQuery({
    ...trpc.tax.getWhtCertificate.queryOptions({ certificateId: openId ?? '' }),
    enabled: !!openId,
  });

  const handleDownload = async (documentId: string) => {
    setDownloadPending(true);
    try {
      const response = await fetch(
        `/api/trpc/document.getDownloadUrl?input=${encodeURIComponent(
          JSON.stringify({ documentId }),
        )}`,
      );
      if (!response.ok) throw new Error(t('toast.downloadFailed'));
      const data = await response.json();
      const url = data?.result?.data?.url;
      if (!url) throw new Error(t('toast.downloadFailed'));
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('toast.downloadFailed'));
    } finally {
      setDownloadPending(false);
    }
  };

  return {
    t,
    format,
    locale,
    openId,
    setOpenId,
    downloadPending,
    listQuery,
    detailQuery,
    rows: listQuery.data ?? [],
    detail: detailQuery.data,
    handleDownload,
  } as const;
}
