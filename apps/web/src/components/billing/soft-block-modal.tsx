'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PlanComparisonGrid } from './plan-comparison-grid';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SoftBlockModalProps {
  isOpen: boolean;
  onSelectPlan: (priceId: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SoftBlockModal({ isOpen, onSelectPlan }: SoftBlockModalProps) {
  return (
    <Dialog open={isOpen}>
      <DialogContent
        aria-modal="true"
        role="alertdialog"
        showCloseButton={false}
        className="max-w-4xl"
        onPointerDownOutside={e => e.preventDefault()}
        onEscapeKeyDown={e => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="font-display text-[28px] font-semibold leading-tight">
            Your trial has ended
          </DialogTitle>
          <DialogDescription>
            Your data is safe. Choose a plan to continue using Contractor Ops.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          <PlanComparisonGrid compact={true} onSelectPlan={onSelectPlan} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
