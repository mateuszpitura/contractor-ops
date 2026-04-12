"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Loader2, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { validateBankStatementFile } from "@/lib/file-validation";
import { trpc } from "@/trpc/init";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MatchResult {
  transactionIndex: number;
  amountMinor: number;
  iban: string;
  matched: boolean;
  itemId?: string;
  invoiceNumber?: string;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BankStatementDialogProps {
  runId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BankStatementDialog({ runId, open, onOpenChange }: BankStatementDialogProps) {
  const t = useTranslations("Payments");
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step state: "upload" | "parsing" | "results" | "error"
  const [step, setStep] = useState<"upload" | "parsing" | "results" | "error">("upload");
  const [parseError, setParseError] = useState<string>("");
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [selectedMatches, setSelectedMatches] = useState<Set<number>>(new Set());

  // Import statement mutation
  const importMutation = useMutation(
    trpc.payment.importStatement.mutationOptions({
      onSuccess: (data) => {
        const results = ((data as Record<string, unknown>)?.matches ?? []) as MatchResult[];
        setMatches(results);

        // Pre-select matched items
        const matchedIndices = new Set<number>();
        for (const m of results) {
          if (m.matched) matchedIndices.add(m.transactionIndex);
        }
        setSelectedMatches(matchedIndices);
        setStep("results");
      },
      onError: (err) => {
        setParseError(err.message || t("errors.failedToImportStatement"));
        setStep("error");
      },
    }),
  );

  // Confirm matches mutation
  const confirmMutation = useMutation(
    trpc.payment.confirmStatementMatches.mutationOptions({
      onSuccess: () => {
        const matchedCount = Array.from(selectedMatches).length;
        toast.success(t("toast.statementImported", { count: matchedCount }));
        void queryClient.invalidateQueries({
          queryKey: [["payment"]],
        });
        handleClose();
      },
      onError: () => {
        toast.error(t("errors.failedToConfirmMatches"));
      },
    }),
  );

  // Handle file selection
  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      // Validate file
      const validation = validateBankStatementFile(file);
      if (!validation.valid) {
        const errorKey =
          validation.error === "INVALID_FORMAT"
            ? "errors.invalidFileFormat"
            : "errors.fileTooLarge";
        setParseError(t(errorKey));
        setStep("error");
        return;
      }

      setStep("parsing");

      try {
        const text = await file.text();
        importMutation.mutate({
          runId,
          fileContent: text,
          fileName: file.name,
        });
      } catch {
        setParseError(t("errors.failedToReadFile"));
        setStep("error");
      }
    },
    [importMutation, runId, t],
  );

  // Toggle match selection
  const toggleMatch = useCallback((index: number) => {
    setSelectedMatches((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  // Confirm selected matches
  const handleConfirm = useCallback(() => {
    const matchesToConfirm = matches
      .filter((m) => m.matched && selectedMatches.has(m.transactionIndex))
      .map((m) => ({
        itemId: m.itemId!,
        transactionIndex: m.transactionIndex,
      }));

    confirmMutation.mutate({
      runId,
      matches: matchesToConfirm,
    });
  }, [confirmMutation, matches, selectedMatches, runId]);

  // Close and reset
  const handleClose = useCallback(() => {
    onOpenChange(false);
    setTimeout(() => {
      setStep("upload");
      setParseError("");
      setMatches([]);
      setSelectedMatches(new Set());
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = "";
    }, 200);
  }, [onOpenChange]);

  // Reset to upload step
  const handleRetry = useCallback(() => {
    setStep("upload");
    setParseError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const matchedCount = matches.filter((m) => m.matched).length;
  const totalCount = matches.length;
  const selectedCount = selectedMatches.size;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{t("bankStatement.title")}</DialogTitle>
        </DialogHeader>

        {/* Step 1: Upload */}
        {step === "upload" && (
          <div className="space-y-4">
            <div
              className="flex flex-col items-center justify-center gap-3 py-12 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file && fileInputRef.current) {
                  const dt = new DataTransfer();
                  dt.items.add(file);
                  fileInputRef.current.files = dt.files;
                  fileInputRef.current.dispatchEvent(new Event("change", { bubbles: true }));
                }
              }}
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground text-center">
                {t("bankStatement.dropzoneText")}
              </p>
              <p className="text-xs text-muted-foreground">{t("bankStatement.dropzoneFormats")}</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".mt940,.csv"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>
        )}

        {/* Step 2: Parsing */}
        {step === "parsing" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{t("bankStatement.parsingProgress")}</p>
            <Progress value={60} className="w-48" />
          </div>
        )}

        {/* Step 3: Results */}
        {step === "results" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("bankStatement.matchedCount", {
                count: matchedCount,
                total: totalCount,
              })}
            </p>

            <div className="rounded-xl border bg-background max-h-[300px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead className="text-xs">{t("bankStatement.colAmount")}</TableHead>
                    <TableHead className="text-xs">{t("bankStatement.colIban")}</TableHead>
                    <TableHead className="text-xs">{t("bankStatement.colStatus")}</TableHead>
                    <TableHead className="text-xs">{t("bankStatement.colInvoice")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matches.map((match) => (
                    <TableRow
                      key={match.transactionIndex}
                      className={!match.matched ? "bg-yellow-500/10" : ""}
                    >
                      <TableCell>
                        {match.matched && (
                          <Checkbox
                            checked={selectedMatches.has(match.transactionIndex)}
                            onCheckedChange={() => toggleMatch(match.transactionIndex)}
                          />
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs tabular-nums">
                        {new Intl.NumberFormat("pl-PL", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        }).format(match.amountMinor / 100)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        ****{match.iban.slice(-4)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            match.matched
                              ? "bg-green-500/10 text-green-600 dark:text-green-400"
                              : "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                          }
                        >
                          {match.matched
                            ? t("bankStatement.matched")
                            : t("bankStatement.unmatched")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{match.invoiceNumber ?? "\u2014"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 border-t pt-4">
              <Button variant="ghost" onClick={handleClose}>
                {t("bankStatement.cancel")}
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={selectedCount === 0 || confirmMutation.isPending}
              >
                {confirmMutation.isPending ? (
                  <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />
                ) : null}
                {t("bankStatement.confirmMatches", { count: selectedCount })}
              </Button>
            </div>
          </div>
        )}

        {/* Error state */}
        {step === "error" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm text-muted-foreground text-center">{parseError}</p>
            <button
              type="button"
              className="text-sm text-primary hover:underline"
              onClick={handleRetry}
            >
              {t("bankStatement.tryAgain")}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
