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

/**
 * Decision rule (apps/web-vite/ARCHITECTURE.md): this container is the
 * mandatory tRPC/mutation boundary for the upload flow — `useDocumentDropZone`
 * owns the `requestUpload` + `confirmUpload` mutations and the in-flight
 * `files[]` state. The view renders the same drop target regardless of
 * upload progress (per-file rows are list rendering, not a section-level
 * variant pick), so no isLoading/isEmpty/isError lift applies. Kept as a
 * thin mutation host per the audit's annotation-only criterion.
 */
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
