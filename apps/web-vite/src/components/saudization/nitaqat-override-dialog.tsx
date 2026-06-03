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
import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@contractor-ops/ui/components/shadcn/dialog';
import { Loader2 } from 'lucide-react';
import { useCallback, useState } from 'react';

import { useTranslations } from '../../i18n/useTranslations.js';

type OverrideKind = 'nitaqat' | 'activity';

export interface NitaqatOverrideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  thresholdsCustom: boolean;
  permittedActivityCatalogueCustom: boolean;
  onApplyNitaqatOverride: (custom: boolean) => void;
  isApplyingNitaqatOverride: boolean;
  onApplyActivityOverride: (custom: boolean) => void;
  isApplyingActivityOverride: boolean;
}

/**
 * GULF-10 drift-override surface. Applies a Nitaqat-threshold or permitted-activity
 * catalogue override (sets `*Custom = true` server-side, audit-logged in Plan 05) and
 * surfaces the "Custom — verify with adviser" `--warning` badge next to any overridden
 * value. Reset-to-default goes through a destructive AlertDialog confirmation
 * (UI-SPEC "Reset override to default?"). Canonical DialogBody + DialogFooter; all copy
 * via i18n; logical properties only.
 */
export function NitaqatOverrideDialog({
  open,
  onOpenChange,
  thresholdsCustom,
  permittedActivityCatalogueCustom,
  onApplyNitaqatOverride,
  isApplyingNitaqatOverride,
  onApplyActivityOverride,
  isApplyingActivityOverride,
}: NitaqatOverrideDialogProps) {
  const t = useTranslations('Saudization.override');
  const [resetKind, setResetKind] = useState<OverrideKind | null>(null);

  const confirmReset = useCallback(() => {
    if (resetKind === 'nitaqat') onApplyNitaqatOverride(false);
    if (resetKind === 'activity') onApplyActivityOverride(false);
    setResetKind(null);
  }, [resetKind, onApplyNitaqatOverride, onApplyActivityOverride]);

  const isResetting =
    (resetKind === 'nitaqat' && isApplyingNitaqatOverride) ||
    (resetKind === 'activity' && isApplyingActivityOverride);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>{t('title')}</DialogTitle>
            <DialogDescription>{t('description')}</DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-6 py-2">
            <OverrideRow
              heading={t('nitaqatHeading')}
              body={t('nitaqatBody')}
              isCustom={thresholdsCustom}
              customBadge={t('badge')}
              applyLabel={t('applyNitaqat')}
              resetLabel={t('reset')}
              isApplying={isApplyingNitaqatOverride}
              onApply={() => onApplyNitaqatOverride(true)}
              onResetRequest={() => setResetKind('nitaqat')}
            />
            <OverrideRow
              heading={t('activityHeading')}
              body={t('activityBody')}
              isCustom={permittedActivityCatalogueCustom}
              customBadge={t('badge')}
              applyLabel={t('applyActivity')}
              resetLabel={t('reset')}
              isApplying={isApplyingActivityOverride}
              onApply={() => onApplyActivityOverride(true)}
              onResetRequest={() => setResetKind('activity')}
            />
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={resetKind !== null} onOpenChange={value => !value && setResetKind(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('resetConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('resetConfirmBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReset} disabled={isResetting} variant="destructive">
              {isResetting ? (
                <Loader2 aria-hidden="true" className="me-2 size-4 animate-spin" />
              ) : null}
              {t('resetConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function OverrideRow({
  heading,
  body,
  isCustom,
  customBadge,
  applyLabel,
  resetLabel,
  isApplying,
  onApply,
  onResetRequest,
}: {
  heading: string;
  body: string;
  isCustom: boolean;
  customBadge: string;
  applyLabel: string;
  resetLabel: string;
  isApplying: boolean;
  onApply: () => void;
  onResetRequest: () => void;
}) {
  return (
    <section className="space-y-2 border-b pb-6 last:border-b-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold">{heading}</h3>
        {isCustom ? (
          <Badge variant="outline" className="border-warning/50 bg-warning/10 text-warning">
            {customBadge}
          </Badge>
        ) : null}
      </div>
      <p className="text-sm text-muted-foreground">{body}</p>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {isCustom ? (
          <Button variant="outline" size="sm" onClick={onResetRequest} disabled={isApplying}>
            {resetLabel}
          </Button>
        ) : (
          <Button size="sm" onClick={onApply} disabled={isApplying}>
            {isApplying ? (
              <Loader2 aria-hidden="true" className="me-2 size-4 animate-spin" />
            ) : null}
            {applyLabel}
          </Button>
        )}
      </div>
    </section>
  );
}
