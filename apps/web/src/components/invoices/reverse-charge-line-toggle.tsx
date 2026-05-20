// ---------------------------------------------------------------------------
// Phase 57 · Plan 04 · Task 2 — Reverse-charge per-line toggle
// ---------------------------------------------------------------------------
//
// Sits on each invoice line row where `detectReverseCharge` flagged the line
// as RC-applicable. The Switch is ON by default (auto-detected — the line is
// already on the "RC" rate). Flipping OFF requires a written business reason
// (D-13) which lands in the `InvoiceAuditLog` via `invoice.upsertLine`.
// ---------------------------------------------------------------------------

'use client';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@contractor-ops/ui/components/shadcn/alert-dialog';
import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { Switch } from '@contractor-ops/ui/components/shadcn/switch';
import { Textarea } from '@contractor-ops/ui/components/shadcn/textarea';
import { AlertCircle, AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { toast } from 'sonner';

interface ReverseChargeLineToggleProps {
  isReverseCharge: boolean;
  ruleLabel?: string;
  onDisable: (reason: string) => Promise<void> | void;
  onEnable?: () => Promise<void> | void;
  disabled?: boolean;
}

const MIN_REASON_LENGTH = 5;
const MAX_REASON_LENGTH = 500;

export function ReverseChargeLineToggle({
  isReverseCharge,
  ruleLabel,
  onDisable,
  onEnable,
  disabled,
}: ReverseChargeLineToggleProps) {
  const t = useTranslations('Invoices.reverseChargeToggle');
  const id = useId();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reasonTrim = reason.trim();
  const reasonValid =
    reasonTrim.length >= MIN_REASON_LENGTH && reasonTrim.length <= MAX_REASON_LENGTH;

  const handleCheckedChange = (next: boolean) => {
    if (!next && isReverseCharge) {
      setDialogOpen(true);
      return;
    }
    // User is re-enabling RC (auto-behaviour) — no reason required.
    if (onEnable) void onEnable();
  };

  const handleConfirm = async () => {
    if (!reasonValid) return;
    setSubmitting(true);
    try {
      await onDisable(reasonTrim);
      setDialogOpen(false);
      setReason('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('overrideError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex items-center gap-2" data-testid="reverse-charge-line-toggle">
      <Switch
        checked={isReverseCharge}
        // biome-ignore lint/nursery/noJsxPropsBind: small dialog component
        onCheckedChange={handleCheckedChange}
        disabled={disabled || submitting}
        aria-label={t('ariaLabel')}
      />
      <Label className="text-sm">{t('label')}</Label>
      {!!isReverseCharge && (
        <Badge variant="info" data-testid="reverse-charge-chip">
          <AlertCircle className="size-3" aria-hidden />
          <span>{ruleLabel ?? t('autoDetected')}</span>
        </Badge>
      )}

      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4" />
              {t('overrideDialogTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>{t('overrideDialogDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`${id}-rc-override-reason`}>{t('reasonLabel')}</Label>
            <Textarea
              id={`${id}-rc-override-reason`}
              data-testid="reverse-charge-override-reason"
              value={reason}
              // biome-ignore lint/nursery/noJsxPropsBind: small dialog component
              onChange={event => setReason(event.target.value)}
              placeholder={t('reasonPlaceholder')}
              maxLength={MAX_REASON_LENGTH}
              rows={3}
              aria-invalid={!reasonValid && reason.length > 0}
            />
            <p className="text-xs text-muted-foreground">
              {reasonTrim.length < MIN_REASON_LENGTH
                ? t('minLengthHint', { min: MIN_REASON_LENGTH })
                : t('charCount', { current: reasonTrim.length, max: MAX_REASON_LENGTH })}
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>{t('cancel')}</AlertDialogCancel>
            <Button
              type="button"
              // biome-ignore lint/nursery/noJsxPropsBind: small dialog component
              onClick={handleConfirm}
              disabled={!reasonValid || submitting}
              data-testid="reverse-charge-override-confirm">
              {submitting ? t('saving') : t('overrideCta')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
