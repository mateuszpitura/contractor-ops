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

  if (upload.localError) {
    return (
      <IntakeUploadDialog
        open={open}
        upload={upload}
        body={
          <IntakeUploadErrorBlock localError={upload.localError} onReset={upload.handleReset} />
        }
      />
    );
  }

  return (
    <IntakeUploadDialog
      open={open}
      upload={upload}
      body={<IntakeUploadDropzone upload={upload} />}
    />
  );
}
