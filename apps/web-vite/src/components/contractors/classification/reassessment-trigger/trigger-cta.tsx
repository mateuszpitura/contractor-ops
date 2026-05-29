// Phase 60 · CLASS-08 — ReassessmentTriggerCta.
// Step 11 codemod port from apps/web/src/components/contractors/classification/reassessment-trigger/trigger-cta.tsx.

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@contractor-ops/ui/components/shadcn/dropdown-menu';
import { MoreHorizontal, Play, RefreshCcw, X } from 'lucide-react';
import { useCallback, useState } from 'react';

import { useTranslations } from '../../../../i18n/useTranslations.js';
import { ReassessmentTriggerDismissDialog } from './dismiss-dialog.js';

export interface ReassessmentTriggerCtaProps {
  onStartAssessment: () => void;
  onViewPriorSds?: () => void;
  onConfirmDismiss: (reason: string) => void | Promise<void>;
  isDismissing?: boolean;
  className?: string;
}

export function ReassessmentTriggerCta({
  onStartAssessment,
  onViewPriorSds,
  onConfirmDismiss,
  isDismissing = false,
  className,
}: ReassessmentTriggerCtaProps) {
  const t = useTranslations('Classification.polish.reassessmentTrigger');
  const tCommon = useTranslations('Common');
  const [dismissOpen, setDismissOpen] = useState(false);

  const handleOpenDismiss = useCallback(() => setDismissOpen(true), []);
  const handleDismissConfirm = useCallback(
    async (reason: string) => {
      await onConfirmDismiss(reason);
      setDismissOpen(false);
    },
    [onConfirmDismiss],
  );

  return (
    <div className={className} data-slot="reassessment-trigger-cta">
      <Button type="button" size="sm" onClick={onStartAssessment}>
        <RefreshCcw aria-hidden="true" className="size-4" />
        {t('ctaPrimary')}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={tCommon('aria.moreActions')}>
              <MoreHorizontal className="size-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onStartAssessment}>
            <Play aria-hidden="true" className="size-4" /> {t('ctaPrimary')}
          </DropdownMenuItem>
          {onViewPriorSds ? (
            <DropdownMenuItem onSelect={onViewPriorSds}>
              <RefreshCcw aria-hidden="true" className="size-4" /> {t('ctaSecondary')}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onSelect={handleOpenDismiss}>
            <X aria-hidden="true" className="size-4" /> {t('dismissAction')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ReassessmentTriggerDismissDialog
        open={dismissOpen}
        onOpenChange={setDismissOpen}
        onConfirm={handleDismissConfirm}
        isSubmitting={isDismissing}
      />
    </div>
  );
}
