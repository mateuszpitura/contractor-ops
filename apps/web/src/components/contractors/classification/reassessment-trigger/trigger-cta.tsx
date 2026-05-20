'use client';

// ---------------------------------------------------------------------------
// Phase 60 · CLASS-08 — ReassessmentTriggerCta
// ---------------------------------------------------------------------------
// Action bar surfaced next to the chip. Offers the three actions from UI-SPEC:
//   - Start new assessment (primary)
//   - View prior SDS (secondary)
//   - Dismiss (destructive — guarded by DismissDialog)
//
// Consumers wire the `onStartAssessment` / `onViewPriorSds` / `onConfirmDismiss`
// callbacks — this component does NOT couple to tRPC directly so it stays
// testable without a full client context.

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@contractor-ops/ui/components/shadcn/dropdown-menu';
import { MoreHorizontal, Play, RefreshCcw, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { ReassessmentTriggerDismissDialog } from './dismiss-dialog';

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
          <DropdownMenuItem onSelect={() => setDismissOpen(true)}>
            <X aria-hidden="true" className="size-4" /> {t('dismissAction')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ReassessmentTriggerDismissDialog
        open={dismissOpen}
        onOpenChange={setDismissOpen}
        onConfirm={async reason => {
          await onConfirmDismiss(reason);
          setDismissOpen(false);
        }}
        isSubmitting={isDismissing}
      />
    </div>
  );
}
