import { useOverrideComplianceItem } from './hooks/use-override-compliance-item.js';
import { OverrideComplianceItemDialogView } from './override-compliance-item-dialog.js';

export interface OverrideComplianceItemDialogContainerProps {
  itemId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Wires the override mutation hook to the override modal view (D-12). */
export function OverrideComplianceItemDialogContainer({
  itemId,
  open,
  onOpenChange,
}: OverrideComplianceItemDialogContainerProps) {
  const { override, isPending } = useOverrideComplianceItem(() => onOpenChange(false));

  return (
    <OverrideComplianceItemDialogView
      open={open}
      onOpenChange={onOpenChange}
      isPending={isPending}
      onSubmit={({ reasonCategory, reasonNote }) =>
        override({ itemId, reasonCategory, reasonNote })
      }
    />
  );
}
