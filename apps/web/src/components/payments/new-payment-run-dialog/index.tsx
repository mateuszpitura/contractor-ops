"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StepConfirmation } from "./step-confirmation";
import { StepReview } from "./step-review";
import { StepSelect } from "./step-select";

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-4 mt-2">
      {[1, 2, 3].map((step) => (
        <div
          key={step}
          className={`h-2 w-2 rounded-full transition-colors ${
            step <= currentStep ? "bg-primary" : "bg-muted"
          }`}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface NewPaymentRunDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onViewRun?: (runId: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NewPaymentRunDialog({ open, onOpenChange, onViewRun }: NewPaymentRunDialogProps) {
  const t = useTranslations("Payments");
  const queryClient = useQueryClient();

  // Step state
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Selection state
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
  const [groupByCurrency, setGroupByCurrency] = useState(false);

  // Confirmation state
  const [confirmationData, setConfirmationData] = useState<{
    runNumber: string;
    fileBase64: string;
    fileName: string;
    invoiceCount: number;
    totalMinor: number;
    currency: string;
    exportFormat: string;
  } | null>(null);

  // Reset state when dialog closes
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        // Reset after close animation
        setTimeout(() => {
          setStep(1);
          setSelectedInvoiceIds([]);
          setGroupByCurrency(false);
          setConfirmationData(null);
        }, 200);
      }
      onOpenChange(open);
    },
    [onOpenChange],
  );

  const handleComplete = useCallback(
    (data: NonNullable<typeof confirmationData>) => {
      setConfirmationData(data);
      setStep(3);
      // Invalidate payment queries to refresh the list
      void queryClient.invalidateQueries({
        queryKey: [["payment"]],
      });
    },
    [queryClient],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-3xl max-h-[80vh] overflow-y-auto"
        // Prevent close during locking (Step 2 handles this internally)
      >
        <DialogHeader>
          <DialogTitle>{t("dialog.title")}</DialogTitle>
          <StepIndicator currentStep={step} />
        </DialogHeader>

        {step === 1 && (
          <StepSelect
            selectedInvoiceIds={selectedInvoiceIds}
            onSelectionChange={setSelectedInvoiceIds}
            groupByCurrency={groupByCurrency}
            onGroupByCurrencyChange={setGroupByCurrency}
            onCancel={() => handleOpenChange(false)}
            onNext={() => setStep(2)}
          />
        )}

        {step === 2 && (
          <StepReview
            selectedInvoiceIds={selectedInvoiceIds}
            groupByCurrency={groupByCurrency}
            onBack={() => setStep(1)}
            onComplete={handleComplete}
          />
        )}

        {step === 3 && confirmationData && (
          <StepConfirmation
            {...confirmationData}
            onViewRun={() => {
              handleOpenChange(false);
              // Could trigger side panel open via onViewRun callback
              onViewRun?.(confirmationData.runNumber);
            }}
            onClose={() => handleOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
