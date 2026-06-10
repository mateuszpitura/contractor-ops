import { FileUpload } from '@contractor-ops/ui/components/origin/file-upload';
import { useCallback, useState } from 'react';

import { useTranslations } from '../../i18n/useTranslations.js';
import { ACCEPTED_TYPES, MAX_FILE_SIZE } from './drop-zone-constants.js';
import type { useDocumentDropZone as UseDocumentDropZone } from './hooks/use-document-drop-zone.js';
import { useDocumentDropZone } from './hooks/use-document-drop-zone.js';
import { UploadProgress } from './upload-progress.js';

type UploadFileItem = ReturnType<typeof useDocumentDropZone>['files'][number];

interface UploadProgressItemProps {
  item: UploadFileItem;
  onRemoveFile: (id: string) => void;
}

function UploadProgressItem({ item, onRemoveFile }: UploadProgressItemProps) {
  const handleRemove = useCallback(() => onRemoveFile(item.id), [onRemoveFile, item.id]);
  return <UploadProgress file={item} onRemove={handleRemove} />;
}

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

  const handleChange = useCallback(
    (next: File[]) => {
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
    },
    [onFilesAccepted, onFileRejected, uploadDrop],
  );

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
            <UploadProgressItem key={item.id} item={item} onRemoveFile={removeFile} />
          ))}
        </div>
      )}
    </div>
  );
}

type DropZoneProps = {
  onFilesAccepted?: (files: File[]) => void;
  onFileRejected?: (files: File[]) => void;
  disabled?: boolean;
  entityType?: string;
  entityId?: string;
  documentType?: string;
};

export function DropZone({
  onFilesAccepted,
  onFileRejected,
  disabled,
  entityType,
  entityId,
  documentType = 'OTHER',
}: DropZoneProps) {
  const dropZone = useDocumentDropZone({ entityType, entityId, documentType });

  return (
    <DropZoneView
      {...dropZone}
      onFilesAccepted={onFilesAccepted}
      onFileRejected={onFileRejected}
      disabled={disabled}
    />
  );
}

export function DropZoneContainer(props: DropZoneProps) {
  return <DropZone {...props} />;
}
