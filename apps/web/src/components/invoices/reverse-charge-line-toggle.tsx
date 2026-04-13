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

import { AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

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
      toast.error(err instanceof Error ? err.message : 'Failed to override reverse charge');
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
        aria-label="Apply reverse charge to this line"
      />
      <Label className="text-sm">Reverse charge</Label>
      {isReverseCharge && (
        <Badge variant="info" data-testid="reverse-charge-chip">
          <AlertCircle className="size-3" aria-hidden />
          <span>{ruleLabel ?? 'RC auto-detected'}</span>
        </Badge>
      )}

      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Override auto-detected reverse charge?</AlertDialogTitle>
            <AlertDialogDescription>
              Turning reverse charge off applies the standard rate to this line. Please record a
              business reason — it will be written to the invoice audit log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rc-override-reason">Reason</Label>
            <Textarea
              id="rc-override-reason"
              data-testid="reverse-charge-override-reason"
              value={reason}
              // biome-ignore lint/nursery/noJsxPropsBind: small dialog component
              onChange={event => setReason(event.target.value)}
              placeholder="e.g. Customer prefers standard rate per contract clause 4.2"
              maxLength={MAX_REASON_LENGTH}
              rows={3}
              aria-invalid={!reasonValid && reason.length > 0}
            />
            <p className="text-xs text-muted-foreground">
              {reasonTrim.length < MIN_REASON_LENGTH
                ? `Minimum ${MIN_REASON_LENGTH} characters required`
                : `${reasonTrim.length} / ${MAX_REASON_LENGTH}`}
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              // biome-ignore lint/nursery/noJsxPropsBind: small dialog component
              onClick={handleConfirm}
              disabled={!reasonValid || submitting}
              data-testid="reverse-charge-override-confirm">
              {submitting ? 'Saving…' : 'Override reverse charge'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
