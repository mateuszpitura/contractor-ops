// ---------------------------------------------------------------------------
// Phase 57 · Plan 04 · Task 2 — Kleinunternehmerregelung toggle (DE-only)
// ---------------------------------------------------------------------------
//
// Flipping this flag rewrites VAT handling for every future DE invoice:
//   - forces `KU` rate on all lines
//   - suppresses the VAT-breakdown row in totals
//   - emits the § 19 UStG footer notice
//
// Per D-11 the flag is DE-only. Non-DE orgs never render the toggle (the
// tRPC router also rejects — defense in depth).
// Per Pitfall 7 the transition is confirmation-gated so it cannot be
// flipped accidentally.
// ---------------------------------------------------------------------------

'use client';

import { useId, useState } from 'react';
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
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { trpc } from '@/trpc/init';

interface KleinunternehmerToggleProps {
  orgCountryCode: string | null | undefined;
  isKleinunternehmer: boolean;
}

export function KleinunternehmerToggle({
  orgCountryCode,
  isKleinunternehmer,
}: KleinunternehmerToggleProps) {
  const id = useId();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingValue, setPendingValue] = useState<boolean | null>(null);

  const utils = trpc.useUtils();
  const mutation = trpc.organization.setKleinunternehmer.useMutation({
    onSuccess: result => {
      toast.success(
        result.isKleinunternehmer
          ? 'Kleinunternehmerregelung enabled'
          : 'Kleinunternehmerregelung disabled',
      );
      void utils.organization.getCurrent.invalidate();
    },
    onError: err => {
      toast.error(err.message || 'Failed to update Kleinunternehmer flag');
    },
    onSettled: () => {
      setConfirmOpen(false);
      setPendingValue(null);
    },
  });

  // DE-only gate (per D-11). Router also enforces — this is a UX-level guard.
  if (orgCountryCode !== 'DE') return null;

  const handleCheckedChange = (next: boolean) => {
    setPendingValue(next);
    setConfirmOpen(true);
  };

  const handleConfirm = () => {
    if (pendingValue !== null) {
      mutation.mutate({ enabled: pendingValue });
    }
  };

  return (
    <div className="space-y-3" data-testid="kleinunternehmer-toggle">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <Label htmlFor={`${id}-kleinunternehmer-switch`} className="text-base font-medium">
            Kleinunternehmerregelung (§ 19 UStG)
          </Label>
          <p className="text-sm text-muted-foreground max-w-prose">
            When enabled, all invoice lines are billed at 0% VAT with the § 19 UStG footer notice.
            The VAT breakdown is hidden on invoices. Only applicable for German small businesses
            below the § 19 threshold.
          </p>
        </div>
        <Switch
          id={`${id}-kleinunternehmer-switch`}
          checked={isKleinunternehmer}
          // biome-ignore lint/nursery/noJsxPropsBind: small toggle component
          onCheckedChange={handleCheckedChange}
          disabled={mutation.isPending}
          aria-label="Toggle Kleinunternehmerregelung"
        />
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingValue
                ? 'Enable Kleinunternehmerregelung?'
                : 'Disable Kleinunternehmerregelung?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingValue
                ? 'All new invoice lines will be billed at 0% VAT with the § 19 UStG footer notice. Confirm to continue.'
                : 'Future invoices will resume standard German VAT handling (19% / 7% / RC). Existing invoices are unaffected.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutation.isPending}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              // biome-ignore lint/nursery/noJsxPropsBind: small toggle component
              onClick={handleConfirm}
              disabled={mutation.isPending}
              data-testid="kleinunternehmer-confirm">
              {mutation.isPending ? 'Saving…' : 'Confirm'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
