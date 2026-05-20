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

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@contractor-ops/ui/components/shadcn/alert-dialog';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { Switch } from '@contractor-ops/ui/components/shadcn/switch';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { toast } from 'sonner';
import { trpc } from '@/trpc/init';

interface KleinunternehmerToggleProps {
  orgCountryCode: string | null | undefined;
  isKleinunternehmer: boolean;
}

export function KleinunternehmerToggle({
  orgCountryCode,
  isKleinunternehmer,
}: KleinunternehmerToggleProps) {
  const t = useTranslations('organization.kleinunternehmer');
  const tCommon = useTranslations('Common');
  const id = useId();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingValue, setPendingValue] = useState<boolean | null>(null);

  const queryClient = useQueryClient();
  const mutation = useMutation(
    trpc.organization.setKleinunternehmer.mutationOptions({
      onSuccess: (result: { isKleinunternehmer: boolean }) => {
        toast.success(
          result.isKleinunternehmer
            ? `${t('toggleLabel')} enabled`
            : `${t('toggleLabel')} disabled`,
        );
        void queryClient.invalidateQueries({
          queryKey: trpc.organization.getCurrent.queryKey(),
        });
      },
      onError: (err: { message?: string }) => {
        toast.error(err.message || `Failed to update ${t('toggleLabel')}`);
      },
      onSettled: () => {
        setConfirmOpen(false);
        setPendingValue(null);
      },
    }),
  );

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
            {t('toggleLabel')}
          </Label>
          <p className="text-sm text-muted-foreground max-w-prose">{t('description')}</p>
        </div>
        <Switch
          id={`${id}-kleinunternehmer-switch`}
          checked={isKleinunternehmer}
          // biome-ignore lint/nursery/noJsxPropsBind: small toggle component
          onCheckedChange={handleCheckedChange}
          disabled={mutation.isPending}
          aria-label={t('toggleLabel')}
        />
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4" />
              {pendingValue ? t('confirmEnableTitle') : t('confirmDisableTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingValue ? t('confirmEnableBody') : t('confirmDisableBody')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutation.isPending}>{tCommon('cancel')}</AlertDialogCancel>
            <Button
              type="button"
              // biome-ignore lint/nursery/noJsxPropsBind: small toggle component
              onClick={handleConfirm}
              disabled={mutation.isPending}
              data-testid="kleinunternehmer-confirm">
              {mutation.isPending ? `${tCommon('save')}…` : tCommon('save')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
