import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@contractor-ops/ui/components/shadcn/dialog';

import { useTranslations } from '../../i18n/useTranslations.js';
import { PlanComparisonGrid } from './plan-comparison-grid.js';

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
        // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
        onPointerDownOutside={e => e.preventDefault()}
        // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
        onEscapeKeyDown={e => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="font-display text-[28px] font-semibold leading-tight">
            {t('title')}
          </DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          <PlanComparisonGrid
            compact={true}
            onSelectPlan={onSelectPlan}
            isSelecting={isSelecting}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
