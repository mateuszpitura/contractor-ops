import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@contractor-ops/ui/components/shadcn/dialog';

import { useTranslations } from '../../i18n/useTranslations.js';
import { PlanComparisonGrid } from './plan-comparison-grid.js';

const preventEvent = (e: { preventDefault: () => void }) => e.preventDefault();

interface SoftBlockModalProps {
  isOpen: boolean;
  onSelectPlan: (priceId: string) => void;
  isSelecting?: boolean;
}

export function SoftBlockModal({ isOpen, onSelectPlan, isSelecting = false }: SoftBlockModalProps) {
  const t = useTranslations('Billing.softBlock');
  return (
    <Dialog open={isOpen}>
      <DialogContent
        aria-modal="true"
        role="alertdialog"
        showCloseButton={false}
        className="max-w-4xl"
        onPointerDownOutside={preventEvent}
        onEscapeKeyDown={preventEvent}>
        <DialogHeader>
          <DialogTitle className="font-display text-[28px] font-semibold leading-tight">
            {t('title')}
          </DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <DialogBody className="mt-4">
          <PlanComparisonGrid
            compact={true}
            onSelectPlan={onSelectPlan}
            isSelecting={isSelecting}
          />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
