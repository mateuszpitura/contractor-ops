import { useIntakeUpload } from '../hooks/use-intake-upload.js';
import {
  IntakeUploadDialog,
  IntakeUploadDropzone,
  IntakeUploadErrorBlock,
} from './intake-upload-dialog.js';

interface IntakeUploadDialogContainerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function IntakeUploadDialogContainer({
  open,
  onOpenChange,
}: IntakeUploadDialogContainerProps) {
  const upload = useIntakeUpload(onOpenChange);

  const body = upload.localError ? (
    <IntakeUploadErrorBlock localError={upload.localError} onReset={upload.handleReset} />
  ) : (
    <IntakeUploadDropzone upload={upload} />
  );

  return <IntakeUploadDialog open={open} upload={upload} body={body} />;
}
