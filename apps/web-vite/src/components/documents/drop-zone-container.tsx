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

// Decision: mutation host — useDocumentDropZone owns requestUpload/confirmUpload
// mutations + in-flight files[] state. Mounted by tab-documents, contract
// documents-tab, and task-attachments; per-file rows are list rendering, not a variant.
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
