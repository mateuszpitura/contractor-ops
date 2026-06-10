// ---------------------------------------------------------------------------
// Classification disclaimer dialog
// ---------------------------------------------------------------------------
// Blocking AlertDialog that pre-empts the outcome page until the user ticks
// the acknowledgement checkbox and confirms. Escape + overlay click are
// disabled — the disclaimer must not be bypassable by keyboard or pointer.
// Initial focus lands on the checkbox so keyboard users never tab through
// the confirm button first.
//
// Copy is rendered verbatim from packages/validators/src/legal/disclaimers.ts
// (locked constants). Never duplicate these strings into messages/*.json —
// the locked-phrases-guard test enforces absence.

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@contractor-ops/ui/components/shadcn/alert-dialog';
import { Checkbox } from '@contractor-ops/ui/components/shadcn/checkbox';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import {
  DISCLAIMER_IR35_ACKNOWLEDGEMENT,
  DISCLAIMER_IR35_BODY,
  DISCLAIMER_SCHEIN_ACKNOWLEDGEMENT,
  DISCLAIMER_SCHEIN_BODY,
} from '@contractor-ops/validators';
import { AlertTriangle } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useTranslations } from '../../../i18n/useTranslations.js';
import type { useClassificationDisclaimerAck as UseClassificationDisclaimerAck } from './hooks/use-classification-disclaimer.js';
import { useClassificationDisclaimerAck } from './hooks/use-classification-disclaimer.js';

export type ClassificationCountryCode = 'GB' | 'DE';

export interface ClassificationDisclaimerDialogProps {
  readonly assessmentId: string;
  readonly countryCode: ClassificationCountryCode;
  readonly open: boolean;
  readonly onAcknowledged: () => void;
  readonly onDeferred: () => void;
}

const DISCLAIMER_COPY: Record<
  ClassificationCountryCode,
  { body: string; acknowledgement: string }
> = {
  GB: { body: DISCLAIMER_IR35_BODY, acknowledgement: DISCLAIMER_IR35_ACKNOWLEDGEMENT },
  DE: { body: DISCLAIMER_SCHEIN_BODY, acknowledgement: DISCLAIMER_SCHEIN_ACKNOWLEDGEMENT },
};

/**
 * Blocking pre-outcome disclaimer. Mount on the outcome route with `open=true`
 * when `assessment.disclaimerAcknowledgedAt === null`. Closing the modal
 * requires either (a) tick + confirm → acknowledgeDisclaimer mutation, or
 * (b) "Return to engagement" → `onDeferred`.
 */
export type ClassificationDisclaimerDialogViewProps = ClassificationDisclaimerDialogProps &
  Pick<ReturnType<typeof UseClassificationDisclaimerAck>, 'acknowledge' | 'isPending'>;

export function ClassificationDisclaimerDialogView(props: ClassificationDisclaimerDialogViewProps) {
  const { countryCode, open, onDeferred, acknowledge, isPending } = props;
  const t = useTranslations('Classification');
  const copy = DISCLAIMER_COPY[countryCode];
  const titleId = useId();
  const descId = useId();
  const checkboxId = useId();
  const [acknowledged, setAcknowledged] = useState(false);
  const checkboxRef = useRef<HTMLButtonElement | null>(null);

  // Initial focus on the checkbox — Radix/base-ui auto-focus the first
  // tabbable, which is usually the cancel button. Override after mount.
  useEffect(() => {
    if (!open) return;
    // Schedule focus after base-ui finishes its own focus trap initialisation.
    const raf = requestAnimationFrame(() => {
      checkboxRef.current?.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, [open]);
  const handleConfirm = useCallback(() => {
    if (!acknowledged || isPending) return;
    acknowledge();
  }, [acknowledge, acknowledged, isPending]);

  const handleCheckboxChange = useCallback((checked: boolean | 'indeterminate') => {
    setAcknowledged(checked === true);
  }, []);

  // Escape-key bypass hardening.
  // Base-UI AlertDialog is modal by default and does NOT dismiss on overlay
  // click. To also disable escape-key dismissal we intercept `onOpenChange`
  // (the base-ui equivalent of onEscapeKeyDown + onInteractOutside): every
  // attempted close from escape / outside interaction is swallowed, so the
  // dialog stays open until the explicit confirm or cancel button is clicked.
  // As defence in depth we also call preventDefault() on any Escape keydown
  // that bubbles up through the Popup — onEscapeKeyDown equivalent.
  const handleOpenChange = useCallback(
    (_nextOpen: boolean, eventDetails: { preventDefault?: () => void; reason?: string }) => {
      // Any attempted close arising from escape-key or outside interaction is
      // swallowed: the dialog stays open until the explicit confirm or cancel
      // button is clicked. `preventDefault` is provided by base-ui on the
      // event details object.
      eventDetails.preventDefault?.();
    },
    [],
  );

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
    }
  }, []);

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent
        role="alertdialog"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="max-w-lg"
        onKeyDown={handleKeyDown}>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-warning/10 text-warning">
            <AlertTriangle aria-hidden="true" />
          </AlertDialogMedia>
          <AlertDialogTitle id={titleId}>{t('disclaimer.title')}</AlertDialogTitle>
          <AlertDialogDescription id={descId}>{copy.body}</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex items-start gap-3 rounded-md border bg-muted/30 p-3">
          <Checkbox
            id={checkboxId}
            ref={checkboxRef}
            checked={acknowledged}
            onCheckedChange={handleCheckboxChange}
            aria-describedby={descId}
          />
          <Label htmlFor={checkboxId} className="cursor-pointer text-sm font-normal leading-snug">
            {copy.acknowledgement}
          </Label>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onDeferred} disabled={isPending}>
            {t('disclaimer.defer')}
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={!acknowledged || isPending}>
            {isPending ? t('disclaimer.acknowledging') : t('disclaimer.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function ClassificationDisclaimerDialogContainer(
  props: ClassificationDisclaimerDialogProps,
) {
  const { acknowledge, isPending } = useClassificationDisclaimerAck(
    props.assessmentId,
    props.onAcknowledged,
  );
  return (
    <ClassificationDisclaimerDialogView
      {...props}
      acknowledge={acknowledge}
      isPending={isPending}
    />
  );
}

/** @deprecated Use ClassificationDisclaimerDialog */
export { ClassificationDisclaimerDialogContainer as ClassificationDisclaimerDialog };
