import { DropZoneSurface } from '@contractor-ops/ui/components/origin/drop-zone-surface';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Progress } from '@contractor-ops/ui/components/shadcn/progress';
import { FileText, Loader2, ShieldAlert, ShieldCheck, ShieldQuestion, X } from 'lucide-react';
import { memo, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

import { tDynLoose } from '../../../i18n/typed-keys.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import type { UploadingFile } from '../hooks/use-contract-wizard-step-documents.js';

type UploadStatus = UploadingFile['status'];

const ACCEPTED_TYPES: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
};

const MAX_FILE_SIZE = 25 * 1024 * 1024;

function formatFileSizeData(bytes: number): { key: string; size: string } {
  if (bytes < 1024) return { key: 'bytes', size: String(bytes) };
  if (bytes < 1024 * 1024) return { key: 'kilobytes', size: (bytes / 1024).toFixed(1) };
  return { key: 'megabytes', size: (bytes / (1024 * 1024)).toFixed(1) };
}

function ScanStatusBadge({ status }: { status: UploadStatus }) {
  const t = useTranslations('Contracts.wizard');

  switch (status) {
    case 'scanning':
    case 'confirming':
      return (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          {t('scan.scanning')}
        </span>
      );
    case 'clean':
      return (
        <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
          <ShieldCheck className="h-3 w-3" />
          {t('scan.clean')}
        </span>
      );
    case 'infected':
      return (
        <span className="inline-flex items-center gap-1 text-xs text-destructive">
          <ShieldAlert className="h-3 w-3" />
          {t('scan.infected')}
        </span>
      );
    case 'failed':
      return (
        <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
          <ShieldQuestion className="h-3 w-3" />
          {t('scan.failed')}
        </span>
      );
    default:
      return null;
  }
}

interface FileRowProps {
  item: UploadingFile;
  onRemove: (fileId: string) => void;
}

// memo + stable per-item handler avoids recreating onClick for every row on parent rerender.
const FileRow = memo(function FileRow({ item, onRemove }: FileRowProps) {
  const tCommon = useTranslations('Common');
  const handleRemove = useCallback(() => onRemove(item.id), [onRemove, item.id]);

  const { key, size } = formatFileSizeData(item.file.size);

  return (
    <div className="flex items-center gap-3 rounded-md border px-3 py-2">
      <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate">{item.file.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-muted-foreground">
            {tDynLoose(tCommon, 'fileSize', key, { size })}
          </span>
          {item.status === 'uploading' ? (
            <Progress value={item.progress} className="h-1.5 flex-1 max-w-[120px]" />
          ) : (
            <ScanStatusBadge status={item.status} />
          )}
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0"
        onClick={handleRemove}>
        <X className="h-3.5 w-3.5" />
        <span className="sr-only">{tCommon('srOnly.remove')}</span>
      </Button>
    </div>
  );
});

interface StepDocumentsProps {
  onSkip?: () => void;
  files: UploadingFile[];
  onDrop: (acceptedFiles: File[]) => void;
  removeFile: (fileId: string) => void;
}

/**
 * Step 3: Document upload via presigned URLs (requestUpload + PUT to R2 + confirmUpload).
 */
export function StepDocuments({ onSkip, files, onDrop, removeFile }: StepDocumentsProps) {
  const t = useTranslations('Contracts.wizard');

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: MAX_FILE_SIZE,
    multiple: true,
  });

  return (
    <div className="space-y-4">
      <DropZoneSurface
        {...getRootProps()}
        isDragActive={isDragActive}
        label={
          <>
            {t('dropZone.body')}{' '}
            <span className="font-medium text-primary">{t('dropZone.browse')}</span>
          </>
        }
        description={t('dropZone.accepted')}>
        <input {...getInputProps()} />
      </DropZoneSurface>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map(item => (
            <FileRow key={item.id} item={item} onRemove={removeFile} />
          ))}
        </div>
      )}

      <div className="text-center">
        <button
          type="button"
          className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline transition-colors"
          onClick={onSkip}>
          {t('skipDocuments')}
        </button>
      </div>
    </div>
  );
}
