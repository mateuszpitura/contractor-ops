import { AttachDocDialogView } from './attach-doc-dialog.js';
import { useAttachDocDialog } from './hooks/use-attach-doc-dialog.js';

interface AttachDocDialogProps {
  workflowTaskRunId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Decisive passthrough: this is a dialog host. The hook exposes no top-level
// loading/empty/error variant — `searchQuery.isLoading` only fires after the
// user types and is rendered inline as a skeleton row inside the result list,
// which is a single render path tied to user input. No container-level pick
// to lift.
export function AttachDocDialog(props: AttachDocDialogProps) {
  const hookProps = useAttachDocDialog(props);
  return <AttachDocDialogView {...hookProps} {...props} />;
}
