"use client";

import { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { UploadCloud, FileText, X, Loader2 } from "lucide-react";

import { trpc } from "@/trpc/init";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const invoiceSubmitSchema = z
  .object({
    contractId: z.string().min(1, "Please select a contract"),
    invoiceNumber: z
      .string()
      .min(1, "Invoice number is required")
      .max(100),
    issueDate: z.string().min(1, "Issue date is required"),
    dueDate: z.string().min(1, "Due date is required"),
    netAmount: z
      .string()
      .min(1, "Net amount is required")
      .refine(
        (v) => !isNaN(Number(v)) && Number(v) > 0,
        "Must be a positive number",
      ),
    grossAmount: z
      .string()
      .min(1, "Gross amount is required")
      .refine(
        (v) => !isNaN(Number(v)) && Number(v) > 0,
        "Must be a positive number",
      ),
  })
  .refine(
    (data) => {
      if (data.issueDate && data.dueDate) {
        return new Date(data.dueDate) >= new Date(data.issueDate);
      }
      return true;
    },
    {
      message: "Due date must be on or after issue date",
      path: ["dueDate"],
    },
  );

type InvoiceSubmitValues = z.infer<typeof invoiceSubmitSchema>;

// ---------------------------------------------------------------------------
// Upload state
// ---------------------------------------------------------------------------

type UploadState =
  | { status: "idle" }
  | { status: "uploading"; progress: number }
  | {
      status: "uploaded";
      documentId: string;
      storageKey: string;
      originalFileName: string;
      fileSizeBytes: number;
    }
  | { status: "error"; message: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatAmount(grosze: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(grosze / 100);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InvoiceSubmitForm() {
  const router = useRouter();
  const [upload, setUpload] = useState<UploadState>({ status: "idle" });

  // Fetch active contracts
  const { data: contracts, isLoading: contractsLoading } = useQuery(
    trpc.portal.getActiveContracts.queryOptions(),
  );

  // Mutations
  const getUploadUrl = useMutation(
    trpc.portal.getUploadUrl.mutationOptions(),
  );

  const submitInvoice = useMutation(
    trpc.portal.submitInvoice.mutationOptions(),
  );

  // Form
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isValid },
  } = useForm<InvoiceSubmitValues>({
    resolver: zodResolver(invoiceSubmitSchema),
    defaultValues: {
      contractId: "",
      invoiceNumber: "",
      issueDate: "",
      dueDate: "",
      netAmount: "",
      grossAmount: "",
    },
    mode: "onBlur",
  });

  const selectedContractId = watch("contractId");
  const invoiceNumber = watch("invoiceNumber");
  const issueDate = watch("issueDate");
  const dueDate = watch("dueDate");
  const netAmount = watch("netAmount");
  const grossAmount = watch("grossAmount");

  // Auto-select if only 1 active contract
  useEffect(() => {
    if (contracts && contracts.length === 1 && !selectedContractId) {
      setValue("contractId", contracts[0]!.id, { shouldValidate: true });
    }
  }, [contracts, selectedContractId, setValue]);

  // Selected contract info
  const selectedContract = contracts?.find((c) => c.id === selectedContractId);

  // File upload handler
  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      setUpload({ status: "uploading", progress: 0 });

      try {
        // Step 1: Get presigned upload URL
        const { uploadUrl, documentId, storageKey } =
          await getUploadUrl.mutateAsync({
            filename: file.name,
            contentType: "application/pdf",
          });

        setUpload({ status: "uploading", progress: 20 });

        // Step 2: Upload to presigned URL with progress tracking
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", uploadUrl);
          xhr.setRequestHeader("Content-Type", "application/pdf");

          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const percent = Math.round(
                20 + (event.loaded / event.total) * 70,
              );
              setUpload({ status: "uploading", progress: percent });
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          };
          xhr.onerror = () => reject(new Error("Upload failed"));
          xhr.send(file);
        });

        setUpload({
          status: "uploaded",
          documentId,
          storageKey,
          originalFileName: file.name,
          fileSizeBytes: file.size,
        });
      } catch {
        setUpload({
          status: "error",
          message: "Failed to upload the file. Check your connection and try again.",
        });
        toast.error(
          "Failed to upload the file. Check your connection and try again.",
        );
      }
    },
    [getUploadUrl],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    multiple: false,
    disabled: upload.status === "uploading",
  });

  // Remove uploaded file
  const removeFile = () => {
    setUpload({ status: "idle" });
  };

  // Submit handler
  const onSubmit = async (values: InvoiceSubmitValues) => {
    if (upload.status !== "uploaded") {
      toast.error("Please upload an invoice PDF first.");
      return;
    }

    try {
      const result = await submitInvoice.mutateAsync({
        contractId: values.contractId,
        invoiceNumber: values.invoiceNumber,
        issueDate: new Date(values.issueDate),
        dueDate: new Date(values.dueDate),
        netAmountGrosze: Math.round(parseFloat(values.netAmount) * 100),
        grossAmountGrosze: Math.round(parseFloat(values.grossAmount) * 100),
        documentId: upload.documentId,
        storageKey: upload.storageKey,
        originalFileName: upload.originalFileName,
        fileSizeBytes: upload.fileSizeBytes,
      });

      router.push(
        `/portal/invoices/submit/success?invoiceId=${result.invoiceId}&invoiceNumber=${encodeURIComponent(result.invoiceNumber)}`,
      );
    } catch {
      toast.error(
        "Failed to submit invoice. Your data has been saved. Please try again.",
      );
    }
  };

  const canSubmit =
    isValid && upload.status === "uploaded" && !submitInvoice.isPending;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {/* Section 1: Contract Selection */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold">Contract</h2>
        <div className="space-y-2">
          <Label htmlFor="contractId" className="text-[13px]">
            Select contract
          </Label>
          {contractsLoading ? (
            <div className="h-8 animate-pulse rounded-lg bg-muted" />
          ) : (
            <Select
              value={selectedContractId}
              onValueChange={(val) =>
                setValue("contractId", val ?? "", { shouldValidate: true })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a contract..." />
              </SelectTrigger>
              <SelectContent>
                {contracts?.map((contract) => (
                  <SelectItem key={contract.id} value={contract.id}>
                    {contract.title} ({((contract.rateValueGrosze ?? 0) / 100).toFixed(0)}{" "}
                    {contract.currency}/{contract.rateType?.toLowerCase()})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {errors.contractId && (
            <p className="text-sm text-destructive">
              {errors.contractId.message}
            </p>
          )}
          {selectedContract && (
            <p className="text-[13px] text-muted-foreground">
              Expected: {((selectedContract.rateValueGrosze ?? 0) / 100).toFixed(0)}{" "}
              {selectedContract.currency}/{selectedContract.billingModel?.toLowerCase()}
            </p>
          )}
        </div>
      </div>

      <Separator />

      {/* Section 2: Upload */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold">Invoice PDF</h2>

        {upload.status === "idle" || upload.status === "error" ? (
          <div
            {...getRootProps()}
            className={`flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors ${
              isDragActive
                ? "border-primary bg-primary/[0.03]"
                : "border-border bg-muted/50 hover:border-muted-foreground/30"
            }`}
          >
            <input {...getInputProps()} />
            <UploadCloud
              className={`mb-3 h-8 w-8 text-muted-foreground transition-transform ${
                isDragActive ? "scale-110 text-primary" : ""
              }`}
            />
            <p className="text-center text-sm text-muted-foreground">
              Drop your invoice PDF here or{" "}
              <span className="cursor-pointer font-medium text-primary">
                browse
              </span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              PDF files only, up to 25 MB
            </p>
          </div>
        ) : upload.status === "uploading" ? (
          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm">Uploading...</span>
            </div>
            <Progress value={upload.progress} />
          </div>
        ) : upload.status === "uploaded" ? (
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{upload.originalFileName}</p>
                <p className="text-[13px] text-muted-foreground">
                  {formatFileSize(upload.fileSizeBytes)}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={removeFile}
              aria-label="Remove file"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : null}

        {upload.status === "error" && (
          <p className="text-sm text-destructive">{upload.message}</p>
        )}
      </div>

      <Separator />

      {/* Section 3: Metadata */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold">Invoice Details</h2>

        <div className="space-y-2">
          <Label htmlFor="invoiceNumber" className="text-[13px]">
            Invoice number
          </Label>
          <Input
            id="invoiceNumber"
            type="text"
            placeholder="INV-001"
            {...register("invoiceNumber")}
          />
          {errors.invoiceNumber && (
            <p className="text-sm text-destructive">
              {errors.invoiceNumber.message}
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="issueDate" className="text-[13px]">
              Issue date
            </Label>
            <Input id="issueDate" type="date" {...register("issueDate")} />
            {errors.issueDate && (
              <p className="text-sm text-destructive">
                {errors.issueDate.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="dueDate" className="text-[13px]">
              Due date
            </Label>
            <Input id="dueDate" type="date" {...register("dueDate")} />
            {errors.dueDate && (
              <p className="text-sm text-destructive">
                {errors.dueDate.message}
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="netAmount" className="text-[13px]">
              Net amount{selectedContract ? ` (${selectedContract.currency})` : ""}
            </Label>
            <Input
              id="netAmount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              {...register("netAmount")}
            />
            {errors.netAmount && (
              <p className="text-sm text-destructive">
                {errors.netAmount.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="grossAmount" className="text-[13px]">
              Gross amount{selectedContract ? ` (${selectedContract.currency})` : ""}
            </Label>
            <Input
              id="grossAmount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              {...register("grossAmount")}
            />
            {errors.grossAmount && (
              <p className="text-sm text-destructive">
                {errors.grossAmount.message}
              </p>
            )}
          </div>
        </div>
      </div>

      <Separator />

      {/* Section 4: Review Summary */}
      {(invoiceNumber || selectedContract || upload.status === "uploaded") && (
        <Card>
          <CardHeader>
            <CardTitle>Review</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {selectedContract && (
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-muted-foreground">
                  Contract
                </span>
                <span className="text-sm">{selectedContract.title}</span>
              </div>
            )}
            {invoiceNumber && (
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-muted-foreground">
                  Invoice Number
                </span>
                <span className="text-sm">{invoiceNumber}</span>
              </div>
            )}
            {issueDate && (
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-muted-foreground">
                  Issue Date
                </span>
                <span className="text-sm">{issueDate}</span>
              </div>
            )}
            {dueDate && (
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-muted-foreground">
                  Due Date
                </span>
                <span className="text-sm">{dueDate}</span>
              </div>
            )}
            {netAmount && selectedContract && (
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-muted-foreground">
                  Net Amount
                </span>
                <span className="text-sm">
                  {formatAmount(
                    Math.round(parseFloat(netAmount) * 100),
                    selectedContract.currency,
                  )}
                </span>
              </div>
            )}
            {grossAmount && selectedContract && (
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-muted-foreground">
                  Gross Amount
                </span>
                <span className="text-sm font-medium">
                  {formatAmount(
                    Math.round(parseFloat(grossAmount) * 100),
                    selectedContract.currency,
                  )}
                </span>
              </div>
            )}
            {upload.status === "uploaded" && (
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-muted-foreground">
                  Uploaded File
                </span>
                <span className="text-sm">{upload.originalFileName}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Submit button */}
      <Button
        type="submit"
        className="w-full md:w-auto"
        disabled={!canSubmit}
      >
        {submitInvoice.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Submitting...
          </>
        ) : (
          "Submit Invoice"
        )}
      </Button>
    </form>
  );
}
