import { useTranslations } from '../../../i18n/useTranslations.js';
import { useLeitwegIdDeleteDialog } from './hooks/use-leitweg-id-delete-dialog.js';
import { LeitwegIdDeleteDialog } from './leitweg-id-delete-dialog.js';

interface LeitwegIdDeleteDialogContainerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  id: string;
  value: string;
}

// Decision: dialog host — open/onOpenChange + target id gated by LeitwegIdListCard;
// hook scopes the delete mutation lifecycle to dialog mount.
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
