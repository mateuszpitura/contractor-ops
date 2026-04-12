"use client";

import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
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
  const t = useTranslations("Zatca.csrGeneration");
  const [csrPem, setCsrPem] = useState<string | null>(null);

  const generateMutation = useMutation({
    ...zatcaTrpc.generateCsr.mutationOptions(),
    onSuccess: (data: unknown) => {
      const result = data as { csrPem: string };
      setCsrPem(result.csrPem);
      toast.success(t("toast.success"));
    },
    onError: (error: Error) => {
      toast.error(error.message || t("toast.error"));
    },
  });

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">{t("title")}</h3>
        <p className="text-sm text-muted-foreground">
          {t("description")}
        </p>
      </div>

      <div className="space-y-2 text-sm text-muted-foreground">
        <p>
          <span className="font-medium text-foreground">{t("keyType")}</span> {t("keyTypeValue")}
        </p>
        <p>
          {t("privateKeyNote")}
        </p>
      </div>

      {/* CSR Preview */}
      {csrPem && (
        <div className="rounded-lg border bg-muted/30 p-4">
          <p className="mb-2 text-xs font-medium text-muted-foreground">{t("csrPreviewLabel")}</p>
          <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs text-foreground">
            {csrPem}
          </pre>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onBack}>
          {t("back")}
        </Button>
        {csrPem ? (
          <Button onClick={onSuccess}>{t("next")}</Button>
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
            {t("generateCsr")}
          </Button>
        )}
      </div>
    </div>
  );
}
