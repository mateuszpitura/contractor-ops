import { useIntakeList } from '../hooks/use-intake-list.js';
import { IntakeList, IntakeListError } from './intake-list.js';
import { IntakeUploadDialogContainer } from './intake-upload-dialog-container.js';

interface IntakeListContainerProps {
  initialStatus?: string | null;
}

export function IntakeListContainer({ initialStatus }: IntakeListContainerProps) {
  const list = useIntakeList(initialStatus);

  if (list.isError) {
    return (
      <>
        <IntakeListError onRetry={list.handleRetry} />
        <IntakeUploadDialogContainer open={list.uploadOpen} onOpenChange={list.setUploadOpen} />
      </>
    );
  }

  return (
    <>
      <IntakeList list={list} />
      <IntakeUploadDialogContainer open={list.uploadOpen} onOpenChange={list.setUploadOpen} />
    </>
  );
}
