// Decision: confirmation dialog rendered conditionally by LeitwegIdListCard via open prop.
// Container scopes the delete mutation lifecycle per id.
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useLeitwegIdDeleteDialog } from './hooks/use-leitweg-id-delete-dialog.js';
import { LeitwegIdDeleteDialog } from './leitweg-id-delete-dialog.js';

interface LeitwegIdDeleteDialogContainerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  id: string;
  value: string;
}

export function LeitwegIdDeleteDialogContainer({
  open,
  onOpenChange,
  id,
  value,
}: LeitwegIdDeleteDialogContainerProps) {
  const tCommon = useTranslations('Common');
  const dialog = useLeitwegIdDeleteDialog({ onOpenChange, id, value });

  return (
    <LeitwegIdDeleteDialog open={open} onOpenChange={onOpenChange} tCommon={tCommon} {...dialog} />
  );
}
