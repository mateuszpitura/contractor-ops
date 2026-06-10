/**
 * Kleinunternehmerregelung toggle (DE-only).
 *
 * Flipping this flag rewrites VAT handling for every future DE invoice
 * (forces `KU` rate, suppresses VAT-breakdown row, emits § 19 UStG footer).
 * Non-DE orgs never render the toggle (router enforces too).
 */

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
import { AlertTriangle } from 'lucide-react';
import { useId } from 'react';

import { useTranslations } from '../../i18n/useTranslations.js';
import { useKleinunternehmerToggle } from './hooks/use-kleinunternehmer-toggle.js';
import type { useKleinunternehmerToggle as UseKleinunternehmerToggle } from './hooks/use-kleinunternehmer-toggle.js';

interface KleinunternehmerToggleViewProps {
  isKleinunternehmer: boolean;
  toggle: ReturnType<typeof UseKleinunternehmerToggle>;
}

export function KleinunternehmerToggleView({
  isKleinunternehmer,
  toggle,
}: KleinunternehmerToggleViewProps) {
  const tCommon = useTranslations('Common');
  const id = useId();
  const {
    t,
    confirmOpen,
    setConfirmOpen,
    pendingValue,
    mutation,
    handleCheckedChange,
    handleConfirm,
  } = toggle;

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

interface KleinunternehmerToggleProps {
  orgCountryCode: string | null | undefined;
  isKleinunternehmer: boolean;
}

export function KleinunternehmerToggle({
  orgCountryCode,
  isKleinunternehmer,
}: KleinunternehmerToggleProps) {
  const toggle = useKleinunternehmerToggle();
  if (orgCountryCode !== 'DE') return null;
  return <KleinunternehmerToggleView isKleinunternehmer={isKleinunternehmer} toggle={toggle} />;
}
