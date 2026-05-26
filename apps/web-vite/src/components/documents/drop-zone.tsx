import { FileUpload } from '@contractor-ops/ui/components/origin/file-upload';
import { useState } from 'react';

import { useTranslations } from '../../i18n/useTranslations.js';
import { ACCEPTED_TYPES, MAX_FILE_SIZE } from './drop-zone-constants.js';
import type { useDocumentDropZone } from './hooks/use-document-drop-zone.js';
import { UploadProgress } from './upload-progress.js';

type DropZoneViewProps = ReturnType<typeof useDocumentDropZone> & {
  onFilesAccepted?: (files: File[]) => void;
  onFileRejected?: (files: File[]) => void;
  disabled?: boolean;
};

const ACCEPT_ATTR = Object.entries(ACCEPTED_TYPES)
  .flatMap(([mime, exts]) => [mime, ...(exts as readonly string[])])
  .join(',');

export function DropZoneView({
  files,
  onDrop: uploadDrop,
  removeFile,
  onFilesAccepted,
  onFileRejected,
  disabled,
}: DropZoneViewProps) {
  const t = useTranslations('Documents');
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);

  const handleChange = (next: File[]) => {
    const valid = next.filter(f => f.size <= MAX_FILE_SIZE);
    const rejected = next.filter(f => f.size > MAX_FILE_SIZE);
    setStagedFiles([]);
    if (valid.length > 0) {
      onFilesAccepted?.(valid);
      uploadDrop(valid);
    }
    if (rejected.length > 0) {
      onFileRejected?.(rejected);
    }
  };

  return (
    <div className="space-y-4">
      <FileUpload
        files={stagedFiles}
        onFilesChange={handleChange}
        accept={ACCEPT_ATTR}
        maxSizeBytes={MAX_FILE_SIZE}
        multiple
        disabled={disabled}
        label={t('dropZone.body')}
        description={t('dropZone.accepted')}
      />

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
