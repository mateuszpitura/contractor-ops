import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Checkbox } from '@contractor-ops/ui/components/shadcn/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@contractor-ops/ui/components/shadcn/dialog';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { CheckCircle } from 'lucide-react';
import { useState } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';

interface ClaimDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (issueAsSecondaryInvoice: boolean) => void;
  isPending: boolean;
}

export function ClaimDialog({ open, onOpenChange, onConfirm, isPending }: ClaimDialogProps) {
  const t = useTranslations('Payments.lateInterest.claim');
  const [issueSecondaryInvoice, setIssueSecondaryInvoice] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="size-4" />
            {t('title')}
          </DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-3 py-4">
          <Checkbox
            id="issue-secondary-invoice"
            checked={issueSecondaryInvoice}
            onCheckedChange={checked => setIssueSecondaryInvoice(!!checked)}
          />
          <Label htmlFor="issue-secondary-invoice" className="text-sm leading-relaxed">
            {t('issueSecondaryInvoice')}
          </Label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={() => onConfirm(issueSecondaryInvoice)} disabled={isPending}>
            {isPending ? t('confirming') : t('confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
