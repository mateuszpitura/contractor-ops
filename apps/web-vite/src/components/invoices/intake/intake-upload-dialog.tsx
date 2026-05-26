import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@contractor-ops/ui/components/shadcn/dialog';
import { AlertCircle, Loader2, UploadCloud } from 'lucide-react';
import type { ChangeEvent, DragEvent, ReactNode } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { cn } from '../../../lib/utils.js';
import type { IntakeUploadLocalErrorKind, useIntakeUpload } from '../hooks/use-intake-upload.js';

const ACCEPT_ATTR = '.xml,.pdf,application/xml,text/xml,application/pdf';

interface IntakeUploadDialogProps {
  open: boolean;
  upload: ReturnType<typeof useIntakeUpload>;
  body: ReactNode;
}

export function IntakeUploadDialog({ open, upload, body }: IntakeUploadDialogProps) {
  const t = useTranslations('EInvoice.intake');

  return (
    <Dialog open={open} onOpenChange={upload.handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UploadCloud className="size-4" />
            {t('uploadDialogTitle')}
          </DialogTitle>
          <DialogDescription id="intake-upload-helper">{t('dropZoneSecondary')}</DialogDescription>
        </DialogHeader>

        {body}
      </DialogContent>
    </Dialog>
  );
}

interface IntakeUploadErrorBlockProps {
  localError: IntakeUploadLocalErrorKind;
  onReset: () => void;
}

export function IntakeUploadErrorBlock({ localError, onReset }: IntakeUploadErrorBlockProps) {
  const t = useTranslations('EInvoice.intake');

  return (
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
      <Button type="button" variant="secondary" size="sm" onClick={onReset} className="self-start">
        {t('uploadTryAnother')}
      </Button>
    </div>
  );
}

interface IntakeUploadDropzoneProps {
  upload: ReturnType<typeof useIntakeUpload>;
}

export function IntakeUploadDropzone({ upload }: IntakeUploadDropzoneProps) {
  const t = useTranslations('EInvoice.intake');

  return (
    <label
      htmlFor="intake-upload-input"
      onDragOver={(event: DragEvent<HTMLLabelElement>) => {
        event.preventDefault();
        upload.setIsDragOver(true);
      }}
      onDragLeave={() => upload.setIsDragOver(false)}
      onDrop={upload.handleDrop}
      aria-describedby="intake-upload-helper"
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors',
        upload.isDragOver
          ? 'border-primary bg-primary/5'
          : 'border-muted-foreground/30 hover:border-primary/60 hover:bg-accent/30',
        upload.isPending && 'pointer-events-none opacity-60',
      )}
      data-slot="intake-upload-dropzone">
      {upload.isPending ? (
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
        ref={upload.fileInputRef}
        id="intake-upload-input"
        type="file"
        accept={ACCEPT_ATTR}
        className="sr-only"
        disabled={upload.isPending}
        onChange={upload.handleChange as (event: ChangeEvent<HTMLInputElement>) => void}
      />
    </label>
  );
}
