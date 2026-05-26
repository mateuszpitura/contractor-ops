import { AttachDocDialogView } from './attach-doc-dialog.js';
import { useAttachDocDialog } from './hooks/use-attach-doc-dialog.js';

interface AttachDocDialogProps {
  workflowTaskRunId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Decision: dialog host — open/onOpenChange gated by DocLinksSection.
// Search-query loading renders as an inline skeleton row tied to user input,
// not a container variant.
export function AttachDocDialog(props: AttachDocDialogProps) {
  const hookProps = useAttachDocDialog(props);
  return <AttachDocDialogView {...hookProps} {...props} />;
}
