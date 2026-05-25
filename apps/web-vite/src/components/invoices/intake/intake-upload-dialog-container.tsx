import { useIntakeUpload } from '../hooks/use-intake-upload.js';
import { IntakeUploadDialog } from './intake-upload-dialog.js';

interface IntakeUploadDialogContainerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Dialog body variant pick (error vs dropzone) is decided inside the
// presentational `IntakeUploadDialog` because the user must remain in the
// open dialog while toggling between dropzone and error state. Keeping
// the pick in the view avoids tearing down the dialog on transitions.
// Container stays thin to keep the hook (file validation + upload
// mutation) inside the invoices folder.
export function IntakeUploadDialogContainer({
  open,
  onOpenChange,
}: IntakeUploadDialogContainerProps) {
  const upload = useIntakeUpload(onOpenChange);

  return <IntakeUploadDialog open={open} upload={upload} />;
}
