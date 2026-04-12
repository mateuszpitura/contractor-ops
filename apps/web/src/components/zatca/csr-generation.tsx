"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { zatcaTrpc } from "./zatca-trpc";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CsrGenerationProps {
  onSuccess: () => void;
  onBack: () => void;
}

// ---------------------------------------------------------------------------
// CSR Generation — Step 2
// ---------------------------------------------------------------------------

/**
 * Step 2 of ZATCA onboarding wizard.
 * Generates an ECDSA P-256 CSR with ZATCA-required attributes.
 * Displays CSR preview in a code block (font-mono text-xs).
 * Private key never leaves the server.
 */
export function CsrGeneration({ onSuccess, onBack }: CsrGenerationProps) {
  const [csrPem, setCsrPem] = useState<string | null>(null);

  const generateMutation = useMutation({
    ...zatcaTrpc.generateCsr.mutationOptions(),
    onSuccess: (data: unknown) => {
      const result = data as { csrPem: string };
      setCsrPem(result.csrPem);
      toast.success("CSR generated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to generate CSR");
    },
  });

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">Step 2 of 5: Generate Certificate Request</h3>
        <p className="text-sm text-muted-foreground">
          A Certificate Signing Request will be generated using your tax details
          from Step 1.
        </p>
      </div>

      <div className="space-y-2 text-sm text-muted-foreground">
        <p>
          <span className="font-medium text-foreground">Key Type:</span>{" "}
          ECDSA P-256 (recommended by ZATCA)
        </p>
        <p>
          The private key will be stored securely in your organization&apos;s
          secret vault. It never leaves the server.
        </p>
      </div>

      {/* CSR Preview */}
      {csrPem && (
        <div className="rounded-lg border bg-muted/30 p-4">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            CSR Preview (read-only)
          </p>
          <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs text-foreground">
            {csrPem}
          </pre>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        {csrPem ? (
          <Button onClick={onSuccess}>Next</Button>
        ) : (
          <Button
            onClick={() => (generateMutation.mutate as () => void)()}
            disabled={generateMutation.isPending}
          >
            {generateMutation.isPending && (
              <Loader2
                className="me-1.5 h-3.5 w-3.5 animate-spin"
                aria-label="Loading"
                aria-hidden="true"
              />
            )}
            Generate CSR
          </Button>
        )}
      </div>
    </div>
  );
}
