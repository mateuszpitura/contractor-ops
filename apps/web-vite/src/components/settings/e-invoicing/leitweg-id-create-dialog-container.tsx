import { useState } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useLeitwegIdCreateDialog } from './hooks/use-leitweg-id-create-dialog.js';
import type { LeitwegIdDialogPrefill, LeitwegIdEditInitial } from './leitweg-id-create-dialog.js';
import { LeitwegIdCreateDialog } from './leitweg-id-create-dialog.js';

interface LeitwegIdCreateDialogContainerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: LeitwegIdEditInitial | null;
  prefill?: LeitwegIdDialogPrefill;
  onSaved?: (id: string) => void;
}

// Decision: side-effect setup — owns local formError state passed back through the hook
// callback; dialog open prop gated by LeitwegIdListCard (create + per-row edit reuse).
export function LeitwegIdCreateDialogContainer({
  open,
  onOpenChange,
  initial,
  prefill,
  onSaved,
}: LeitwegIdCreateDialogContainerProps) {
  const tCommon = useTranslations('Common');
  const [formError, setFormError] = useState<string | null>(null);
  const dialog = useLeitwegIdCreateDialog({
    onOpenChange,
    initial,
    onSaved,
    setFormError,
  });

  return (
    <LeitwegIdCreateDialog
      open={open}
      onOpenChange={onOpenChange}
      initial={initial}
      prefill={prefill}
      onSaved={onSaved}
      tCommon={tCommon}
      formError={formError}
      setFormError={setFormError}
      {...dialog}
    />
  );
}
