"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

import { trpc } from "@/trpc/init";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { StepCompany } from "./step-company";
import { StepBilling } from "./step-billing";
import { StepAssignment } from "./step-assignment";

// ---------------------------------------------------------------------------
// Wizard form schema (mirrors contractorCreateSchema from validators package)
// Defined locally to avoid cross-package dependency from web -> validators
// ---------------------------------------------------------------------------

const wizardSchema = z.object({
  legalName: z.string().min(1, "Legal name is required").max(255),
  displayName: z.string().min(1).max(255),
  type: z.enum(["SOLE_TRADER", "COMPANY", "INDIVIDUAL_FREELANCER", "OTHER"]),
  taxId: z.string().min(1, "NIP is required"),
  vatId: z.string().optional(),
  registrationNumber: z.string().optional(),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  countryCode: z.string().length(2),
  currency: z.string().length(3),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  billingModel: z.string().min(1, "Billing model is required"),
  rateValueGrosze: z.number().int().positive("Rate must be positive"),
  bankAccount: z.string().optional(),
  paymentTermsDays: z.number().int().positive().optional(),
  ownerUserId: z.string().min(1, "Owner is required"),
  primaryTeamId: z.string().optional(),
  primaryProjectId: z.string().optional(),
  defaultCostCenterId: z.string().optional(),
});

export type WizardFormValues = z.infer<typeof wizardSchema>;

// Per-step validation schemas
const stepSchemas = [
  // Step 1: Company details
  z.object({
    legalName: z.string().min(1),
    displayName: z.string().min(1),
    type: z.enum(["SOLE_TRADER", "COMPANY", "INDIVIDUAL_FREELANCER", "OTHER"]),
    taxId: z.string().min(1),
    email: z.string().email(),
  }),
  // Step 2: Billing
  z.object({
    billingModel: z.string().min(1),
    currency: z.string().length(3),
    rateValueGrosze: z.number().positive(),
  }),
  // Step 3: Assignment
  z.object({
    ownerUserId: z.string().min(1),
  }),
] as const;

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

function StepIndicator({
  steps,
  currentStep,
}: {
  steps: string[];
  currentStep: number;
}) {
  return (
    <div className="flex items-center justify-center gap-0 px-4 py-3">
      {steps.map((label, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;

        return (
          <div key={label} className="flex items-center">
            {index > 0 && (
              <div
                className={`mx-2 h-px w-8 ${
                  index <= currentStep ? "bg-primary" : "bg-border"
                }`}
              />
            )}
            <div className="flex items-center gap-2">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                  isCompleted
                    ? "bg-primary text-primary-foreground"
                    : isCurrent
                      ? "border-2 border-primary text-primary"
                      : "border border-border text-muted-foreground"
                }`}
              >
                {isCompleted ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  index + 1
                )}
              </div>
              <span
                className={`text-[13px] ${
                  isCurrent
                    ? "font-medium text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Wizard dialog
// ---------------------------------------------------------------------------

interface WizardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * 3-step add contractor wizard dialog.
 * Uses a single React Hook Form instance across all steps.
 * Validates per-step on "Next" click using step-specific schema picks.
 */
export function WizardDialog({ open, onOpenChange }: WizardDialogProps) {
  const t = useTranslations("ContractorWizard");
  const queryClient = useQueryClient();

  const [currentStep, setCurrentStep] = useState(0);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  const form = useForm<WizardFormValues>({
    resolver: zodResolver(wizardSchema),
    defaultValues: {
      legalName: "",
      displayName: "",
      type: undefined,
      taxId: "",
      vatId: "",
      registrationNumber: "",
      email: "",
      phone: "",
      countryCode: "PL",
      currency: "PLN",
      addressLine1: "",
      addressLine2: "",
      city: "",
      postalCode: "",
      billingModel: "",
      rateValueGrosze: 0,
      bankAccount: "",
      paymentTermsDays: undefined,
      ownerUserId: "",
      primaryTeamId: "",
      primaryProjectId: "",
      defaultCostCenterId: "",
    },
  });

  const createMutation = useMutation(
    trpc.contractor.create.mutationOptions({
      onSuccess: () => {
        toast.success(t("success"));
        queryClient.invalidateQueries({ queryKey: ["contractor"] });
        handleClose(true);
      },
      onError: () => {
        toast.error(t("error"));
      },
    }),
  );

  const stepLabels = [t("step1"), t("step2"), t("step3")];
  const nextLabels = [t("next1"), t("next2"), t("submit")];

  const isDirty = form.formState.isDirty;

  const handleClose = (force = false) => {
    if (!force && isDirty) {
      setShowDiscardDialog(true);
      return;
    }
    form.reset();
    setCurrentStep(0);
    onOpenChange(false);
  };

  const handleDiscard = () => {
    setShowDiscardDialog(false);
    form.reset();
    setCurrentStep(0);
    onOpenChange(false);
  };

  const handleNext = async () => {
    const schema = stepSchemas[currentStep];
    if (!schema) return;

    // Validate only the current step's fields
    const stepFields = Object.keys(schema.shape) as Array<
      keyof WizardFormValues
    >;
    const isValid = await form.trigger(stepFields);

    if (!isValid) return;

    if (currentStep < 2) {
      setCurrentStep((s) => s + 1);
    } else {
      // Final step — submit
      form.handleSubmit((data) => {
        // Ensure displayName defaults to legalName if empty
        const submitData = {
          ...data,
          displayName: data.displayName || data.legalName,
        };
        createMutation.mutate(submitData);
      })();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
        <DialogContent
          className="sm:max-w-[640px]"
          showCloseButton={false}
        >
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
          </DialogHeader>

          {/* Step indicator */}
          <StepIndicator steps={stepLabels} currentStep={currentStep} />

          {/* Step content */}
          <div className="min-h-[320px] px-1">
            {currentStep === 0 && <StepCompany form={form} />}
            {currentStep === 1 && <StepBilling form={form} />}
            {currentStep === 2 && <StepAssignment form={form} />}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t pt-4 mt-2">
            <div>
              {currentStep > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                >
                  {t("back")}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => handleClose()}
                >
                  {isDirty ? t("discardChanges") : t("close")}
                </Button>
              )}
            </div>
            <Button
              type="button"
              onClick={handleNext}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("submit")}
                </>
              ) : (
                nextLabels[currentStep]
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Discard confirmation */}
      <AlertDialog
        open={showDiscardDialog}
        onOpenChange={setShowDiscardDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("discardConfirm.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("discardConfirm.body")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("discardConfirm.keep")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDiscard}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("discardConfirm.discard")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
