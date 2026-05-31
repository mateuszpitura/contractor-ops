import { useMutation, useQueryClient } from '@tanstack/react-query';
import { TRPCClientError } from '@trpc/client';
import type { ChangeEvent, DragEvent } from 'react';
import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';

import { useRouter } from '../../../i18n/navigation.js';
import { useCommonToasts } from '../../../i18n/use-common-toasts.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = /\.(xml|pdf)$/i;

function inferFileKind(file: File): 'xml' | 'pdf' | null {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) return 'pdf';
  if (name.endsWith('.xml')) return 'xml';
  if (file.type === 'application/pdf') return 'pdf';
  if (file.type === 'application/xml' || file.type === 'text/xml') return 'xml';
  return null;
}

function encodeBase64(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes);
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < view.length; i += CHUNK) {
    binary += String.fromCharCode(...view.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export type IntakeUploadLocalErrorKind =
  | { kind: 'wrongType' }
  | { kind: 'tooLarge' }
  | { kind: 'xsdReject'; errors?: string }
  | { kind: 'noXmlAttachment' }
  | { kind: 'levelTooLow'; level?: string }
  | { kind: 'generic'; message?: string };

export function useIntakeUpload(onOpenChange: (open: boolean) => void) {
  const t = useTranslations('EInvoice.intake');
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const toasts = useCommonToasts();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [localError, setLocalError] = useState<IntakeUploadLocalErrorKind | null>(null);

  const uploadMutation = useMutation(
    trpc.invoiceIntake.upload.mutationOptions({
      onError: err => toast.error(err.message),
      onSuccess: () => {
        toast.success(toasts.done());
        queryClient.invalidateQueries(trpc.invoiceIntake.pathFilter());
      },
    }),
  );

  const handleReset = useCallback(() => {
    setLocalError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleClose = useCallback(
    (next: boolean) => {
      if (!next) handleReset();
      onOpenChange(next);
    },
    [handleReset, onOpenChange],
  );

  const handleFile = useCallback(
    async (file: File) => {
      setLocalError(null);

      if (!ALLOWED_EXTENSIONS.test(file.name)) {
        setLocalError({ kind: 'wrongType' });
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        setLocalError({ kind: 'tooLarge' });
        return;
      }
      const fileKind = inferFileKind(file);
      if (!fileKind) {
        setLocalError({ kind: 'wrongType' });
        return;
      }

      try {
        const bytes = await file.arrayBuffer();
        const base64 = encodeBase64(bytes);
        const result = await uploadMutation.mutateAsync({
          fileKind,
          fileBase64: base64,
          mime: file.type || (fileKind === 'pdf' ? 'application/pdf' : 'application/xml'),
          originalFilename: file.name,
        });

        if (result.kind === 'DEDUP_RETURNED') {
          toast.message(t('uploadDedupToast'));
        } else {
          toast.success(t('uploadSuccessToast', { id: result.intakeId }));
        }
        handleClose(false);
        router.push(`/invoices/intake/${result.intakeId}`);
      } catch (err) {
        const code = err instanceof TRPCClientError ? err.data?.code : undefined;
        const message =
          err instanceof TRPCClientError ? err.message : err instanceof Error ? err.message : '';
        if (message === 'FILE_TOO_LARGE' || code === 'PAYLOAD_TOO_LARGE') {
          setLocalError({ kind: 'tooLarge' });
        } else if (message === 'CII_XSD_INVALID') {
          const details = (err as { data?: { details?: { errors?: string[] } } }).data?.details;
          const errors = details?.errors?.join('; ');
          setLocalError({ kind: 'xsdReject', errors });
        } else if (message === 'ZUGFERD_NO_XML_ATTACHMENT') {
          setLocalError({ kind: 'noXmlAttachment' });
        } else if (message === 'ZUGFERD_LEVEL_UNSUPPORTED') {
          const details = (err as { data?: { details?: { level?: string } } }).data?.details;
          setLocalError({ kind: 'levelTooLow', level: details?.level });
        } else if (message === 'UNSUPPORTED_MIME') {
          setLocalError({ kind: 'wrongType' });
        } else {
          setLocalError({ kind: 'generic', message });
        }
      }
    },
    [handleClose, router, t, uploadMutation],
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragOver(false);
      const file = event.dataTransfer.files?.[0];
      if (file) void handleFile(file);
    },
    [handleFile],
  );

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) void handleFile(file);
    },
    [handleFile],
  );

  return {
    fileInputRef,
    isDragOver,
    setIsDragOver,
    localError,
    isPending: uploadMutation.isPending,
    handleReset,
    handleClose,
    handleDrop,
    handleChange,
  } as const;
}
