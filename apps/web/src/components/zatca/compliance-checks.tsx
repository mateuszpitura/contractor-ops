"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { zatcaTrpc, type ComplianceCheckResult } from "./zatca-trpc";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ComplianceChecksProps {
  onSuccess: () => void;
  onBack: () => void;
}

// ---------------------------------------------------------------------------
// Status badge mapping
// ---------------------------------------------------------------------------

const STATUS_BADGE: Record<string, { variant: "success" | "destructive" | "warning"; label: string }> = {
  CLEARED: { variant: "success", label: "CLEARED" },
  REPORTED: { variant: "success", label: "REPORTED" },
  REJECTED: { variant: "destructive", label: "REJECTED" },
  ERROR: { variant: "destructive", label: "ERROR" },
};

// ---------------------------------------------------------------------------
// Compliance Checks — Step 4
// ---------------------------------------------------------------------------

/**
 * Step 4 of ZATCA onboarding wizard.
 * Submits 6 test invoices to ZATCA compliance endpoint.
 * Shows results with badges (CLEARED/REPORTED green, REJECTED red).
 * Progress bar tracks completion.
 * Next enabled only when all 6 pass.
 */
export function ComplianceChecks({ onSuccess, onBack }: ComplianceChecksProps) {
  const [results, setResults] = useState<ComplianceCheckResult[]>([]);

  const checksMutation = useMutation({
    ...zatcaTrpc.runComplianceChecks.mutationOptions(),
    onSuccess: (data: unknown) => {
      const typedData = data as ComplianceCheckResult[];
      setResults(typedData);
      const allPassed = typedData.every(
        (r) => r.status === "CLEARED" || r.status === "REPORTED",
      );
      if (allPassed) {
        toast.success("All 6 compliance checks passed. Your setup is ready for production.");
      } else {
        const failedCount = typedData.filter(
          (r) => r.status === "REJECTED" || r.status === "ERROR",
        ).length;
        toast.error(`Compliance check failed: ${failedCount} test(s) did not pass. Review your tax details and try again.`);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to run compliance checks");
    },
  });

  const allPassed =
    results.length === 6 &&
    results.every((r) => r.status === "CLEARED" || r.status === "REPORTED");
  const completedCount = results.length;
  const progressValue = (completedCount / 6) * 100;

  // Test invoice labels
  const TEST_LABELS = [
    "Standard tax invoice",
    "Standard credit note",
    "Standard debit note",
    "Simplified invoice",
    "Simplified credit note",
    "Simplified debit note",
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">Step 4 of 5: Run Compliance Checks</h3>
        <p className="text-sm text-muted-foreground">
          6 test invoices will be submitted to ZATCA&apos;s sandbox to verify your
          setup.
        </p>
      </div>

      {results.length === 0 && (
        <Button
          onClick={() => (checksMutation.mutate as () => void)()}
          disabled={checksMutation.isPending}
        >
          {checksMutation.isPending && (
            <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          )}
          Run Compliance Checks
        </Button>
      )}

      {/* Test Results */}
      {(results.length > 0 || checksMutation.isPending) && (
        <div className="space-y-3 rounded-lg border bg-muted/20 p-4" role="list" aria-label="Compliance check results">
          {TEST_LABELS.map((label, i) => {
            const result = results[i];
            const isRunning = checksMutation.isPending && !result;
            const isPending = !checksMutation.isPending && !result;

            return (
              <div key={label} className="flex items-center justify-between" role="listitem">
                <div className="flex items-center gap-2 text-sm">
                  {result ? (
                    result.status === "CLEARED" || result.status === "REPORTED" ? (
                      <Check className="h-4 w-4 text-green-600" aria-hidden="true" />
                    ) : (
                      <X className="h-4 w-4 text-destructive" aria-hidden="true" />
                    )
                  ) : isRunning ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" aria-label="Running" />
                  ) : isPending ? (
                    <span className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" aria-label="Pending" />
                  ) : null}
                  <span className={result ? "text-foreground" : "text-muted-foreground"}>
                    {label}
                  </span>
                </div>

                {result && (
                  <Badge variant={STATUS_BADGE[result.status]?.variant ?? "warning"}>
                    {STATUS_BADGE[result.status]?.label ?? result.status}
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Progress bar */}
      {(results.length > 0 || checksMutation.isPending) && (
        <div className="space-y-1">
          <Progress value={progressValue}>
            <span className="text-xs text-muted-foreground">
              {completedCount}/6
            </span>
          </Progress>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onSuccess} disabled={!allPassed}>
          Next
        </Button>
      </div>
    </div>
  );
}
