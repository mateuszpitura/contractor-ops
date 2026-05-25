import { UploadCloud } from 'lucide-react';
import { useDropzone } from 'react-dropzone';

import { useTranslations } from '../../i18n/useTranslations.js';
import { ACCEPTED_TYPES, MAX_FILE_SIZE } from './drop-zone-constants.js';
import type { useDocumentDropZone } from './hooks/use-document-drop-zone.js';
import { UploadProgress } from './upload-progress.js';

type DropZoneViewProps = ReturnType<typeof useDocumentDropZone> & {
  onFilesAccepted?: (files: File[]) => void;
  onFileRejected?: (files: File[]) => void;
  disabled?: boolean;
};

export function DropZoneView({
  files,
  onDrop: uploadDrop,
  removeFile,
  onFilesAccepted,
  onFileRejected,
  disabled,
}: DropZoneViewProps) {
  const t = useTranslations('Documents');

  const onDrop = (acceptedFiles: File[], rejectedFiles: unknown[]) => {
    onFilesAccepted?.(acceptedFiles);
    if (rejectedFiles.length > 0) {
      onFileRejected?.(acceptedFiles);
    }
    uploadDrop(acceptedFiles);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: MAX_FILE_SIZE,
    multiple: true,
    disabled,
  });

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors ${
          disabled
            ? 'pointer-events-none opacity-50'
            : isDragActive
              ? 'border-primary bg-primary/[0.03]'
              : 'border-border bg-muted/50 hover:border-muted-foreground/30'
        }`}>
        <input {...getInputProps()} />
        <UploadCloud
          className={`mb-3 size-8 text-muted-foreground transition-transform ${
            isDragActive ? 'scale-110 text-primary' : ''
          }`}
        />
        <p className="text-center text-sm text-muted-foreground">
          {t('dropZone.body')}{' '}
          <span className="cursor-pointer font-medium text-primary">{t('dropZone.browse')}</span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{t('dropZone.accepted')}</p>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map(item => (
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
            <UploadProgress key={item.id} file={item} onRemove={() => removeFile(item.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
