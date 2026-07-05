import type { PortalAppRouter } from '@contractor-ops/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { inferRouterOutputs } from '@trpc/server';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../../i18n/useTranslations.js';
import { usePortalTRPC } from '../../../../providers/trpc-provider.js';
import { isModuleDarkError } from './use-employee-dashboard.js';

type PortalRouterOutputs = inferRouterOutputs<PortalAppRouter>;

export type EmployeeAkta = PortalRouterOutputs['portalEmployee']['getMyAkta'];
export type EmployeeAktaSection = EmployeeAkta['sections'][number];
export type EmployeeAktaDocument = EmployeeAktaSection['documents'][number];

export function useEmployeeAkta() {
  const t = useTranslations('Portal.employee.documents');
  const trpc = usePortalTRPC();
  const queryClient = useQueryClient();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const aktaQuery = useQuery(
    trpc.portalEmployee.getMyAkta.queryOptions(undefined, { retry: false }),
  );

  const isUnavailable = aktaQuery.isError && isModuleDarkError(aktaQuery.error);
  const sections = aktaQuery.data?.sections ?? [];
  const totalDocuments = sections.reduce((count, section) => count + section.documents.length, 0);

  const download = useCallback(
    async (documentId: string) => {
      setDownloadingId(documentId);
      try {
        const result = await queryClient.fetchQuery(
          trpc.portalEmployee.getMyAktaDocumentUrl.queryOptions({ documentId }, { retry: false }),
        );
        window.open(result.downloadUrl, '_blank', 'noopener,noreferrer');
      } catch {
        toast.error(t('downloadError'));
      } finally {
        setDownloadingId(null);
      }
    },
    [queryClient, trpc.portalEmployee.getMyAktaDocumentUrl, t],
  );

  return {
    isLoading: aktaQuery.isPending,
    isError: aktaQuery.isError && !isUnavailable,
    isUnavailable,
    isEmpty: !(aktaQuery.isPending || aktaQuery.isError) && totalDocuments === 0,
    sections,
    totalDocuments,
    download,
    downloadingId,
  } as const;
}
