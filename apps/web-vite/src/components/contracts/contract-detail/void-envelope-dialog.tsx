import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@contractor-ops/ui/components/shadcn/alert-dialog';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { Textarea } from '@contractor-ops/ui/components/shadcn/textarea';
import { Loader2, Trash2 } from 'lucide-react';
import { useId } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import type { useVoidEnvelopeDialog } from '../hooks/use-void-envelope-dialog.js';

type VoidEnvelopeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  voidDialog: ReturnType<typeof useVoidEnvelopeDialog>;
};

export function VoidEnvelopeDialog({ open, onOpenChange, voidDialog }: VoidEnvelopeDialogProps) {
  const id = useId();
  const t = useTranslations('ContractDetail.signing.voidDialog');

  const { handleConfirm, isPending, reason, setReason } = voidDialog;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Trash2 className="size-4" />
            {t('title')}
          </AlertDialogTitle>
          <AlertDialogDescription>{t('description')}</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor={`${id}-void-reason`}>{t('reasonLabel')}</Label>
          <Textarea
            id={`${id}-void-reason`}
            rows={2}
            placeholder={t('reasonPlaceholder')}
            value={reason}
            // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
            onChange={e => setReason(e.target.value)}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>{t('keepActive')}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
            onClick={handleConfirm}
            disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="me-1.5 size-4 animate-spin" />
                {t('voiding')}
              </>
            ) : (
              t('voidEnvelope')
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
