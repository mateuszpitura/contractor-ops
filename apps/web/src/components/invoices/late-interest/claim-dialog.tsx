'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Claim statutory interest dialog (non-destructive)
// ---------------------------------------------------------------------------

interface ClaimDialogProps {
  invoiceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ClaimDialog({ invoiceId, open, onOpenChange }: ClaimDialogProps) {
  const t = useTranslations('Payments.lateInterest.claim');
  const utils = trpc.useUtils();

  const [issueSecondaryInvoice, setIssueSecondaryInvoice] = useState(false);

  const claimMutation = trpc.latePaymentInterest.claim.useMutation({
    onSuccess: () => {
      toast.success(t('successToast'));
      void utils.latePaymentInterest.getForInvoice.invalidate({ invoiceId });
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleConfirm = () => {
    claimMutation.mutate({
      invoiceId,
      issueSecondaryInvoice,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-3 py-4">
          <Checkbox
            id="issue-secondary-invoice"
            checked={issueSecondaryInvoice}
            onCheckedChange={(checked) => setIssueSecondaryInvoice(!!checked)}
          />
          <Label htmlFor="issue-secondary-invoice" className="text-sm leading-relaxed">
            {t('issueSecondaryInvoice')}
          </Label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={claimMutation.isPending}
          >
            {claimMutation.isPending ? t('confirming') : t('confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
