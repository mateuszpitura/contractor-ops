/**
 * Sole tRPC boundary for the payroll export surface. Exposes the registered
 * targets (each annotated with whether the caller's org may currently use it —
 * the per-adapter payroll.* flag) plus the export mutation, which streams the
 * generated file to a browser download. No component below this hook touches
 * tRPC or React Query.
 */

import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useTranslatedError } from '../../../i18n/use-translated-error.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export interface PayrollTarget {
  profileId: string;
  country: string;
  displayName: string;
  flagKey: string;
  enabled: boolean;
}

function triggerDownload(fileBase64: string, filename: string, mimeType: string): void {
  const binary = atob(fileBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const url = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function usePayrollExport() {
  const trpc = useTRPC();
  const t = useTranslations('PayrollExport');
  const translateError = useTranslatedError();

  const targetsQuery = useQuery(trpc.payrollExport.listTargets.queryOptions());

  const exportMutation = useMutation(
    trpc.payrollExport.export.mutationOptions({
      onSuccess: result => {
        triggerDownload(result.fileBase64, result.filename, result.mimeType);
        if (result.warnings.length > 0) {
          toast.warning(t('toasts.exportedWithWarnings', { count: result.warnings.length }));
        } else {
          toast.success(t('toasts.exported'));
        }
      },
      onError: (err: { message?: string }) =>
        toast.error(translateError(err) || t('errors.generic')),
    }),
  );

  return {
    targets: (targetsQuery.data ?? []) as PayrollTarget[],
    isLoading: targetsQuery.isLoading,
    isError: targetsQuery.isError,
    retry: () => void targetsQuery.refetch(),
    runExport: (targetId: string, employeeIds: string[], format?: 'csv' | 'xml') =>
      exportMutation.mutate(format ? { targetId, employeeIds, format } : { targetId, employeeIds }),
    isExporting: exportMutation.isPending,
    exportingTargetId: exportMutation.isPending ? exportMutation.variables?.targetId : undefined,
  } as const;
}
