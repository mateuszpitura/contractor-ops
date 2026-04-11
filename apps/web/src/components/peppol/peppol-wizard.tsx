"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Globe, Loader2 } from "lucide-react";

import { trpc } from "@/trpc/init";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PeppolWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

const STEPS = [
  { label: "TRN", number: 1 },
  { label: "ASP", number: 2 },
  { label: "Credentials", number: 3 },
  { label: "Register", number: 4 },
  { label: "Confirm", number: 5 },
] as const;

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {STEPS.map((step, i) => (
        <div key={step.number} className="flex items-center gap-2">
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition-colors ${
              step.number < current
                ? "bg-primary text-primary-foreground"
                : step.number === current
                  ? "ring-2 ring-primary bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {step.number < current ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              step.number
            )}
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={`h-px w-6 ${
                step.number < current ? "bg-primary" : "bg-muted"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Wizard
// ---------------------------------------------------------------------------

export function PeppolWizard({ open, onOpenChange }: PeppolWizardProps) {
  const queryClient = useQueryClient();

  // Form state
  const [step, setStep] = useState(1);
  const [trn, setTrn] = useState("");
  const [aspProvider] = useState<"storecove">("storecove");
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [environment, setEnvironment] = useState<"sandbox" | "production">(
    "sandbox",
  );
  const [registrationError, setRegistrationError] = useState<string | null>(
    null,
  );

  // Connect mutation
  const connectMutation = useMutation(
    trpc.peppol.connect.mutationOptions({
      onSuccess: () => {
        setStep(5);
        queryClient.invalidateQueries({
          queryKey: trpc.peppol.getStatus.queryKey(),
        });
      },
      onError: (error) => {
        setRegistrationError(error.message || "Registration failed");
      },
    }),
  );

  function resetAndClose() {
    setStep(1);
    setTrn("");
    setApiKey("");
    setShowApiKey(false);
    setEnvironment("sandbox");
    setRegistrationError(null);
    onOpenChange(false);
  }

  const participantId = trn.length === 15 ? `0192:${trn}` : "";
  const canGoNext =
    (step === 1 && trn.length === 15 && /^\d{15}$/.test(trn)) ||
    step === 2 ||
    (step === 3 && apiKey.length > 0);

  function handleNext() {
    if (step === 3) {
      // Step 4: trigger registration
      setStep(4);
      setRegistrationError(null);
      connectMutation.mutate({ trn, aspProvider, apiKey, environment });
    } else if (step < 5) {
      setStep(step + 1);
    }
  }

  function handleRetry() {
    setRegistrationError(null);
    connectMutation.mutate({ trn, aspProvider, apiKey, environment });
  }

  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
      <DialogContent className="max-w-[640px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Connect to Peppol Network
          </DialogTitle>
          <DialogDescription>
            Register your organization on the Peppol network to send and
            receive e-invoices with UAE trading partners.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <StepIndicator current={step} />
        </div>

        <div className="min-h-[200px]">
          {/* Step 1: TRN Entry */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-base font-semibold">
                Step 1: Tax Registration Number
              </h3>
              <div className="space-y-2">
                <Label htmlFor="trn">Tax Registration Number (TRN)</Label>
                <Input
                  id="trn"
                  placeholder="123456789012345"
                  value={trn}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 15);
                    setTrn(val);
                  }}
                  pattern="[0-9]*"
                  maxLength={15}
                  inputMode="numeric"
                />
                <p className="text-sm text-muted-foreground">
                  15-digit UAE TRN
                </p>
              </div>
              {participantId && (
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-sm text-muted-foreground">
                    Peppol Participant ID will be:
                  </p>
                  <p className="font-mono text-sm font-medium">
                    {participantId}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 2: ASP Selection */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-base font-semibold">
                Step 2: Select ASP Provider
              </h3>
              <RadioGroup
                value={aspProvider}
                className="space-y-3"
              >
                <label
                  htmlFor="storecove"
                  className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                >
                  <RadioGroupItem value="storecove" id="storecove" />
                  <div>
                    <p className="text-sm font-medium">Storecove</p>
                    <p className="text-sm text-muted-foreground">
                      Certified Peppol ASP — 60+ countries supported
                    </p>
                  </div>
                </label>
              </RadioGroup>
              <p className="text-sm text-muted-foreground">
                More providers coming soon.
              </p>
            </div>
          )}

          {/* Step 3: API Credentials */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-base font-semibold">
                Step 3: API Credentials
              </h3>
              <div className="space-y-2">
                <Label htmlFor="apiKey">Storecove API Key</Label>
                <div className="relative">
                  <Input
                    id="apiKey"
                    type={showApiKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter your API key"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 px-2 text-xs"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? "Hide" : "Show"}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Obtain from Storecove dashboard
                </p>
              </div>
              <div className="space-y-2">
                <Label>Environment</Label>
                <RadioGroup
                  value={environment}
                  onValueChange={(val) =>
                    setEnvironment(val as "sandbox" | "production")
                  }
                  className="flex gap-4"
                >
                  <label className="flex cursor-pointer items-center gap-2">
                    <RadioGroupItem value="sandbox" />
                    <span className="text-sm">Sandbox (testing)</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <RadioGroupItem value="production" />
                    <span className="text-sm">Production</span>
                  </label>
                </RadioGroup>
              </div>
            </div>
          )}

          {/* Step 4: Register Participant */}
          {step === 4 && (
            <div className="space-y-4">
              <h3 className="text-base font-semibold">
                Step 4: Register Participant
              </h3>
              <div className="rounded-lg border p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Participant ID</span>
                  <span className="font-mono">{participantId}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">ASP Provider</span>
                  <span>Storecove</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Environment</span>
                  <span className="capitalize">{environment}</span>
                </div>
              </div>

              {connectMutation.isPending && (
                <div className="space-y-3">
                  <Progress value={null} className="h-2" />
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Registering your organization on the Peppol network...
                  </div>
                </div>
              )}

              {registrationError && (
                <Alert variant="destructive">
                  <AlertTitle>Registration Failed</AlertTitle>
                  <AlertDescription>{registrationError}</AlertDescription>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={handleRetry}
                  >
                    Retry
                  </Button>
                </Alert>
              )}
            </div>
          )}

          {/* Step 5: Confirmation */}
          {step === 5 && (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <CheckCircle2 className="h-12 w-12 text-success" />
              <div className="space-y-1">
                <h3 className="text-base font-semibold">
                  Connected to Peppol Network
                </h3>
                <p className="text-sm text-muted-foreground">
                  You can now send and receive e-invoices through the Peppol
                  network.
                </p>
              </div>
              <div className="rounded-lg border p-4 text-left w-full max-w-sm space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Participant ID</span>
                  <span className="font-mono">{participantId}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">ASP</span>
                  <span>Storecove</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Environment</span>
                  <span className="capitalize">{environment}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between pt-2">
          {step > 1 && step < 5 && (
            <Button
              variant="outline"
              onClick={() => setStep(step - 1)}
              disabled={step === 4 && connectMutation.isPending}
            >
              Back
            </Button>
          )}
          {step === 5 ? (
            <Button className="ml-auto" onClick={resetAndClose}>
              Done
            </Button>
          ) : step < 4 ? (
            <Button
              className="ml-auto"
              onClick={handleNext}
              disabled={!canGoNext}
            >
              Next
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
