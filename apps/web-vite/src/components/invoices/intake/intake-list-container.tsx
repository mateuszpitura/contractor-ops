import { useIntakeList } from '../hooks/use-intake-list.js';
import { IntakeList, IntakeListError } from './intake-list.js';
import { IntakeUploadDialogContainer } from './intake-upload-dialog-container.js';

interface IntakeListContainerProps {
  initialStatus?: string | null;
}

export function IntakeListContainer({ initialStatus }: IntakeListContainerProps) {
  const list = useIntakeList(initialStatus);

  return (
    <>
      {list.isError ? <IntakeListError onRetry={list.handleRetry} /> : <IntakeList list={list} />}
      <IntakeUploadDialogContainer open={list.uploadOpen} onOpenChange={list.setUploadOpen} />
    </>
  );
}
