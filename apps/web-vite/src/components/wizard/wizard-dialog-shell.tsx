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
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogSection,
  DialogTitle,
} from '@contractor-ops/ui/components/shadcn/dialog';
import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';

import { useDirection } from '../../hooks/use-direction.js';

export interface WizardDialogShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  stepper?: ReactNode;
  children: ReactNode;
  showDirtyClose: boolean;
  onConfirmDirtyClose: () => void;
  onCancelDirtyClose: () => void;
  onBack?: () => void;
  onNext?: () => void;
  backLabel?: string;
  nextLabel?: string;
  isSubmitting?: boolean;
  nextDisabled?: boolean;
  showBack?: boolean;
  isLastStep?: boolean;
  /** Replaces default back/next footer when set (e.g. contract wizard close on step 0). */
  footer?: ReactNode;
  contentClassName?: string;
  showCloseButton?: boolean;
}

/**
 * Shared wizard dialog chrome: stepper slot, dirty-close guard, footer navigation.
 */
export function WizardDialogShell({
  open,
  onOpenChange,
  title,
  stepper,
  children,
  showDirtyClose,
  onConfirmDirtyClose,
  onCancelDirtyClose,
  onBack,
  onNext,
  backLabel = 'Back',
  nextLabel = 'Next',
  isSubmitting = false,
  nextDisabled = false,
  showBack = true,
  isLastStep = false,
  footer,
  contentClassName,
  showCloseButton = false,
}: WizardDialogShellProps) {
  const direction = useDirection();

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          dir={direction}
          className={contentClassName ?? 'max-w-2xl'}
          showCloseButton={showCloseButton}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          {stepper ? <DialogSection className="pt-2">{stepper}</DialogSection> : null}
          <DialogBody>{children}</DialogBody>
          {footer ?? (
            <DialogFooter className="gap-2 sm:gap-0">
              {showBack && onBack ? (
                <Button type="button" variant="outline" onClick={onBack} disabled={isSubmitting}>
                  {backLabel}
                </Button>
              ) : null}
              {onNext ? (
                <Button type="button" onClick={onNext} disabled={nextDisabled || isSubmitting}>
                  {isSubmitting ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
                  {nextLabel}
                </Button>
              ) : null}
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDirtyClose}>
        <AlertDialogContent dir={direction}>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Discard them and close?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={onCancelDirtyClose}>Keep editing</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirmDirtyClose}>Discard</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
