import { DropZoneSurface } from '@contractor-ops/ui/components/origin/drop-zone-surface';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@contractor-ops/ui/components/shadcn/dialog';
import { AlertCircle, UploadCloud } from 'lucide-react';
import type { ChangeEvent, DragEvent, KeyboardEvent, ReactNode } from 'react';
import { useCallback } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import type {
  IntakeUploadLocalErrorKind,
  useIntakeUpload as UseIntakeUpload,
} from '../hooks/use-intake-upload.js';
import { useIntakeUpload } from '../hooks/use-intake-upload.js';

const ACCEPT_ATTR = '.xml,.pdf,application/xml,text/xml,application/pdf';

export interface IntakeUploadDialogFrameProps {
  open: boolean;
  upload: ReturnType<typeof UseIntakeUpload>;
  body: ReactNode;
}

export function IntakeUploadDialogFrame({ open, upload, body }: IntakeUploadDialogFrameProps) {
  const t = useTranslations('EInvoice.intake');

  return (
    <Dialog open={open} onOpenChange={upload.handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UploadCloud className="size-4" />
            {t('uploadDialogTitle')}
          </DialogTitle>
          {/* biome-ignore lint/correctness/useUniqueElementIds: stable anchor — referenced by aria-describedby in the sibling IntakeUploadDropzone, which sits behind an opaque ReactNode body prop and cannot share a useId */}
          <DialogDescription id="intake-upload-helper" className="sr-only">
            {t('dropZoneSecondary')}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>{body}</DialogBody>
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
  const { setIsDragOver, fileInputRef, isPending } = upload;

  const handleDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragOver(true);
    },
    [setIsDragOver],
  );

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, [setIsDragOver]);

  const handleClick = useCallback(() => {
    if (!isPending) fileInputRef.current?.click();
  }, [fileInputRef, isPending]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if ((event.key === 'Enter' || event.key === ' ') && !isPending) {
        event.preventDefault();
        fileInputRef.current?.click();
      }
    },
    [fileInputRef, isPending],
  );

  return (
    <div data-slot="intake-upload-dropzone">
      <DropZoneSurface
        role="button"
        tabIndex={isPending ? -1 : 0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={upload.handleDrop}
        aria-describedby="intake-upload-helper"
        isDragActive={upload.isDragOver}
        isLoading={isPending}
        loadingLabel={t('uploadValidating')}
        disabled={isPending}
        label={t('dropZonePrimary')}
        description={t('dropZoneSecondary')}>
        {/* biome-ignore lint/correctness/useUniqueElementIds: stable test anchor — queried via document.getElementById('intake-upload-input') in intake-upload-dialog.test.tsx */}
        <input
          ref={fileInputRef}
          id="intake-upload-input"
          type="file"
          accept={ACCEPT_ATTR}
          className="sr-only"
          disabled={isPending}
          onChange={upload.handleChange as (event: ChangeEvent<HTMLInputElement>) => void}
        />
      </DropZoneSurface>
    </div>
  );
}

interface IntakeUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function IntakeUploadDialog({ open, onOpenChange }: IntakeUploadDialogProps) {
  const upload = useIntakeUpload(onOpenChange);

  if (upload.localError) {
    return (
      <IntakeUploadDialogFrame
        open={open}
        upload={upload}
        body={
          <IntakeUploadErrorBlock localError={upload.localError} onReset={upload.handleReset} />
        }
      />
    );
  }

  return (
    <IntakeUploadDialogFrame
      open={open}
      upload={upload}
      body={<IntakeUploadDropzone upload={upload} />}
    />
  );
}
