'use client';

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@contractor-ops/ui/components/shadcn/dialog';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { TRPCClientError } from '@trpc/client';
import { AlertCircle, Loader2, UploadCloud } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ChangeEvent, DragEvent } from 'react';
import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Accept + size rules — mirror the intake service gates.
//   - 5 MiB decoded byte ceiling (the service enforces the same limit).
//   - .xml or .pdf only; MIME double-checked server-side.
// ---------------------------------------------------------------------------

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MiB
const ACCEPT_ATTR = '.xml,.pdf,application/xml,text/xml,application/pdf';

const ALLOWED_EXTENSIONS = /\.(xml|pdf)$/i;

function inferFileKind(file: File): 'xml' | 'pdf' | null {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) return 'pdf';
  if (name.endsWith('.xml')) return 'xml';
  // Fall back to MIME sniffing for drag-drop sources that strip filenames.
  if (file.type === 'application/pdf') return 'pdf';
  if (file.type === 'application/xml' || file.type === 'text/xml') return 'xml';
  return null;
}

function encodeBase64(bytes: ArrayBuffer): string {
  // Chunked conversion to avoid `String.fromCharCode(...)` stack overflow on
  // 5 MiB buffers. 32 KiB chunks are safe across all browsers.
  const view = new Uint8Array(bytes);
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < view.length; i += CHUNK) {
    binary += String.fromCharCode(...view.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

interface IntakeUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type LocalErrorKind =
  | { kind: 'wrongType' }
  | { kind: 'tooLarge' }
  | { kind: 'xsdReject'; errors?: string }
  | { kind: 'noXmlAttachment' }
  | { kind: 'levelTooLow'; level?: string }
  | { kind: 'generic'; message?: string };

/**
 * Drop-zone Dialog for inbound XRechnung XML / ZUGFeRD PDF upload.
 * Validates file type + size client-side BEFORE calling the server so the
 * round-trip is only spent on plausible inputs. Maps typed tRPC error
 * codes onto inline error messages with actionable copy.
 */
export function IntakeUploadDialog({ open, onOpenChange }: IntakeUploadDialogProps) {
  const t = useTranslations('EInvoice.intake');
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [localError, setLocalError] = useState<LocalErrorKind | null>(null);
  const queryClient = useQueryClient();

  const uploadMutation = useMutation(
    trpc.invoiceIntake.upload.mutationOptions({
      onError: err => toast.error(err.message),

      onSuccess: () => {
        toast.success('Done.');
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
      if (!next) {
        handleReset();
      }
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
        // Map tRPC error messages (set at the router boundary as the
        // service's typed error code) onto inline localised copy.
        if (message === 'FILE_TOO_LARGE' || code === 'PAYLOAD_TOO_LARGE') {
          setLocalError({ kind: 'tooLarge' });
        } else if (message === 'CII_XSD_INVALID') {
          // Extract first errors from the details payload when available.
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
    (event: DragEvent<HTMLLabelElement>) => {
      event.preventDefault();
      setIsDragOver(false);
      const file = event.dataTransfer.files?.[0];
      if (file) {
        void handleFile(file);
      }
    },
    [handleFile],
  );

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        void handleFile(file);
      }
    },
    [handleFile],
  );

  const isPending = uploadMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UploadCloud className="size-4" />
            {t('uploadDialogTitle')}
          </DialogTitle>
          <DialogDescription id="intake-upload-helper">{t('dropZoneSecondary')}</DialogDescription>
        </DialogHeader>

        {localError ? (
          <div
            role="alert"
            className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p data-testid="intake-upload-error-message">
                {localError.kind === 'wrongType' && t('uploadWrongType')}
                {localError.kind === 'tooLarge' && t('errorFileTooLarge')}
                {localError.kind === 'xsdReject' &&
                  t('errorXsdReject', { errors: localError.errors ?? '' })}
                {localError.kind === 'noXmlAttachment' && t('errorNoXmlAttachment')}
                {localError.kind === 'levelTooLow' &&
                  t('errorLevelTooLow', { level: localError.level ?? 'BASIC' })}
                {localError.kind === 'generic' && t('errorGeneric')}
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleReset}
              className="self-start">
              {t('uploadTryAnother')}
            </Button>
          </div>
        ) : (
          <label
            htmlFor="intake-upload-input"
            onDragOver={event => {
              event.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            aria-describedby="intake-upload-helper"
            className={cn(
              'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors',
              isDragOver
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/30 hover:border-primary/60 hover:bg-accent/30',
              isPending && 'pointer-events-none opacity-60',
            )}
            data-slot="intake-upload-dropzone">
            {isPending ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
                <p className="text-sm font-medium">{t('uploadValidating')}</p>
              </>
            ) : (
              <>
                <UploadCloud className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm font-medium">{t('dropZonePrimary')}</p>
                <p className="text-xs text-muted-foreground">{t('dropZoneSecondary')}</p>
              </>
            )}
            <input
              ref={fileInputRef}
              id="intake-upload-input"
              type="file"
              accept={ACCEPT_ATTR}
              className="sr-only"
              disabled={isPending}
              onChange={handleChange}
            />
          </label>
        )}
      </DialogContent>
    </Dialog>
  );
}
