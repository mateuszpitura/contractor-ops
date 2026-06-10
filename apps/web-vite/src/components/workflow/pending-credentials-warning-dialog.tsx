import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Checkbox } from '@contractor-ops/ui/components/shadcn/checkbox';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@contractor-ops/ui/components/shadcn/dialog';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { Textarea } from '@contractor-ops/ui/components/shadcn/textarea';
import { useState } from 'react';
import { useTranslations } from '../../i18n/useTranslations.js';

export interface PendingCredential {
  id: string;
  label: string;
  vaultProvider: string;
}

export interface PendingCredentialsWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendingCredentials: PendingCredential[];
  isSubmitting: boolean;
  /** Confirm force-complete with the captured reason (>=20 chars). */
  onConfirm: (reason: string) => void;
}

const MIN_REASON = 20;

/**
 * Opened when completeTask raises PRECONDITION_FAILED with
 * cause.blockedTaskKind=PENDING_CREDENTIALS. Captures a >=20-char reason +
 * acknowledgement, then calls forceCompleteRunWithPendingCredentials.
 */
export function PendingCredentialsWarningDialog({
  open,
  onOpenChange,
  pendingCredentials,
  isSubmitting,
  onConfirm,
}: PendingCredentialsWarningDialogProps) {
  const t = useTranslations('Workflow.pendingCredentialsDialog');
  const [reason, setReason] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);

  const canConfirm = reason.trim().length >= MIN_REASON && acknowledged && !isSubmitting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="pending-credentials-dialog">
        <DialogHeader>
          <DialogTitle>{t('title', { count: pendingCredentials.length })}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <p className="text-sm text-muted-foreground">{t('description')}</p>
          <ul className="space-y-1 text-sm">
            {pendingCredentials.map(c => (
              <li key={c.id} className="flex items-center gap-2">
                <span className="font-medium">{c.label}</span>
                <span className="text-muted-foreground">({c.vaultProvider})</span>
              </li>
            ))}
          </ul>
          <div className="space-y-1">
            <Label htmlFor="force-reason">{t('reasonLabel')}</Label>
            <Textarea
              id="force-reason"
              value={reason}
              onChange={e => setReason(e.target.value)}
              data-testid="force-reason"
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="force-ack"
              checked={acknowledged}
              onCheckedChange={v => setAcknowledged(v === true)}
              data-testid="force-acknowledge"
            />
            <Label htmlFor="force-ack" className="text-sm font-normal">
              {t('acknowledgeLabel')}
            </Label>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancelButton')}
          </Button>
          <Button
            disabled={!canConfirm}
            data-testid="force-confirm"
            onClick={() => onConfirm(reason.trim())}>
            {t('confirmButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
