/**
 * Phase 81 D-02 — presentational deprovisioning trigger: the start button plus
 * the impact-preview confirm dialog. Props-in / JSX-out — no tRPC, no business
 * logic. The container injects the cooldown/permission state, the preview slot
 * (the existing ImpactPreviewPanelContainer), and the start/cancel handlers.
 *
 * Dialog body/footer convention: the scrollable impact preview lives in
 * <DialogBody>; the confirm/cancel actions stay pinned in <DialogFooter>.
 */

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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@contractor-ops/ui/components/shadcn/tooltip';
import { ShieldOff } from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback } from 'react';

import { useTranslations } from '../../i18n/useTranslations.js';

export interface DeprovisioningTriggerProps {
  /** Disable the start button (cooldown active or a start is in flight). */
  disabled: boolean;
  /** Cooldown tooltip text (earliest date) — shown when present. */
  disabledTooltip?: string | null;
  /** Whether the confirm dialog is open. */
  confirmOpen: boolean;
  onOpenConfirm: () => void;
  onCloseConfirm: () => void;
  onConfirmStart: () => void;
  /** A start request is in flight. */
  starting: boolean;
  /** The existing impact-preview panel, injected by the container (D-02). */
  previewSlot: ReactNode;
}

export function DeprovisioningTrigger({
  disabled,
  disabledTooltip,
  confirmOpen,
  onOpenConfirm,
  onCloseConfirm,
  onConfirmStart,
  starting,
  previewSlot,
}: DeprovisioningTriggerProps) {
  const t = useTranslations('Idp.trigger');

  const handleOpenChange = useCallback(
    (open: boolean) => (open ? onOpenConfirm() : onCloseConfirm()),
    [onOpenConfirm, onCloseConfirm],
  );

  const startButton = (
    <Button
      type="button"
      size="sm"
      variant="destructive"
      disabled={disabled}
      onClick={onOpenConfirm}>
      <ShieldOff className="size-4" aria-hidden="true" />
      {t('start')}
    </Button>
  );

  return (
    <>
      {disabled && disabledTooltip ? (
        <TooltipProvider>
          <Tooltip>
            {/* span wrapper so the tooltip still fires over a disabled button */}
            <TooltipTrigger
              render={(props: React.HTMLAttributes<HTMLSpanElement>) => (
                <span {...props} className="inline-flex">
                  {startButton}
                </span>
              )}
            />
            <TooltipContent>{disabledTooltip}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        startButton
      )}

      <Dialog open={confirmOpen} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldOff className="size-4" aria-hidden="true" />
              {t('confirmTitle')}
            </DialogTitle>
            <DialogDescription>{t('confirmBody')}</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">{previewSlot}</DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCloseConfirm} disabled={starting}>
              {t('cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={onConfirmStart}
              disabled={starting}>
              {starting ? t('confirmLoading') : t('confirmCta')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
