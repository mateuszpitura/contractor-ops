import { DropZoneView } from './drop-zone.js';
import { useDocumentDropZone } from './hooks/use-document-drop-zone.js';

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
