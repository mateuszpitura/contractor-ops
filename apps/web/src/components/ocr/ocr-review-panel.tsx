"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { trpc } from "@/trpc/init";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PdfViewer } from "@/components/ocr/pdf-viewer";
import { ConfidenceFieldWrapper } from "@/components/ocr/confidence-field-wrapper";
import { NipValidationBadge } from "@/components/ocr/nip-validation-badge";
import { ExtractionStatusBar } from "@/components/ocr/extraction-status-bar";
import { OcrProcessingOverlay } from "@/components/ocr/ocr-processing-overlay";
import { LineItemsTable } from "@/components/ocr/line-items-table";

// ---------------------------------------------------------------------------
// Types (mirrored from @contractor-ops/integrations/types/ocr)
// ---------------------------------------------------------------------------

interface OcrExtractionField {
  key: string;
  value: string | number | null;
  confidence: number;
}

interface OcrLineItem {
  description: string;
  quantity: number | null;
  unit: string | null;
  unitPriceGrosze: number | null;
  netAmountGrosze: number | null;
  vatRate: string | null;
  vatAmountGrosze: number | null;
  grossAmountGrosze: number | null;
  confidence: number;
}

interface OcrExtractionResult {
  status: "EXTRACTED" | "PARTIAL" | "FAILED";
  fields: Record<string, OcrExtractionField>;
  lineItems: OcrLineItem[];
  processingTimeMs: number;
  pageCount: number;
  overallConfidence: number;
  errorMessage?: string;
}

export interface ExtractedInvoiceData {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  subtotalGrosze: number;
  vatAmountGrosze: number;
  totalGrosze: number;
  sellerTaxId: string;
  sellerName: string;
  buyerTaxId: string;
  buyerName: string;
  sellerBankAccount: string;
  lineItems: LineItemFormData[];
}

interface LineItemFormData {
  id: string;
  description: string;
  quantity: number | null;
  unit: string | null;
  unitPriceGrosze: number | null;
  netAmountGrosze: number | null;
  vatRate: string | null;
  vatAmountGrosze: number | null;
  grossAmountGrosze: number | null;
  confidence: number;
}

interface OcrReviewPanelProps {
  pdfUrl: string;
  extractionId: string;
  onAccept: (data: ExtractedInvoiceData) => void;
  onDiscard: () => void;
  onRetrigger: () => void;
  isPortal?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CURRENCIES = ["PLN", "EUR", "USD", "GBP"] as const;

function getFieldValue(
  fields: Record<string, { value: string | number | null }> | undefined,
  key: string,
): string {
  const field = fields?.[key];
  if (!field || field.value == null) return "";
  return String(field.value);
}

function getFieldConfidence(
  fields: Record<string, { confidence: number }> | undefined,
  key: string,
): number {
  return fields?.[key]?.confidence ?? 0;
}

function getNumericFieldGrosze(
  fields: Record<string, { value: string | number | null }> | undefined,
  key: string,
): number {
  const field = fields?.[key];
  if (!field || field.value == null) return 0;
  const num = typeof field.value === "number" ? field.value : parseFloat(field.value);
  return isNaN(num) ? 0 : num;
}

function formatGrosze(grosze: number): string {
  if (grosze === 0) return "";
  return (grosze / 100).toFixed(2);
}

function parseGrosze(display: string): number {
  const value = parseFloat(display);
  if (isNaN(value)) return 0;
  return Math.round(value * 100);
}

function mapLineItems(items: OcrLineItem[]): LineItemFormData[] {
  return items.map((item) => ({
    id: crypto.randomUUID(),
    description: item.description,
    quantity: item.quantity,
    unit: item.unit,
    unitPriceGrosze: item.unitPriceGrosze,
    netAmountGrosze: item.netAmountGrosze,
    vatRate: item.vatRate,
    vatAmountGrosze: item.vatAmountGrosze,
    grossAmountGrosze: item.grossAmountGrosze,
    confidence: item.confidence,
  }));
}

// ---------------------------------------------------------------------------
// Field cascade animation
// ---------------------------------------------------------------------------

const FIELD_ORDER = [
  "invoiceNumber",
  "issueDate",
  "dueDate",
  "currency",
  "sellerTaxId",
  "buyerTaxId",
  "sellerName",
  "buyerName",
  "subtotalGrosze",
  "vatAmountGrosze",
  "totalGrosze",
  "sellerBankAccount",
] as const;

function useCascadeAnimation(isReady: boolean) {
  const [visibleFields, setVisibleFields] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isReady) {
      setVisibleFields(new Set());
      return;
    }

    const timers: ReturnType<typeof setTimeout>[] = [];
    FIELD_ORDER.forEach((field, index) => {
      const timer = setTimeout(() => {
        setVisibleFields((prev) => new Set([...prev, field]));
      }, index * 50);
      timers.push(timer);
    });

    return () => timers.forEach(clearTimeout);
  }, [isReady]);

  return visibleFields;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OcrReviewPanel({
  pdfUrl,
  extractionId,
  onAccept,
  onDiscard,
  onRetrigger,
  isPortal = false,
}: OcrReviewPanelProps) {
  // Polling query: admin vs portal endpoint
  const adminQuery = useQuery({
    ...trpc.ocr.getResult.queryOptions({ extractionId }),
    enabled: !isPortal,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "PROCESSING" || status === "PENDING" ? 2000 : false;
    },
  });

  const portalQuery = useQuery({
    ...trpc.ocr.portalGetResult.queryOptions({ extractionId }),
    enabled: isPortal,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "PROCESSING" || status === "PENDING" ? 2000 : false;
    },
  });

  const extraction = isPortal ? portalQuery.data : adminQuery.data;
  const extractionStatus = extraction?.status ?? "PENDING";
  const resultJson = extraction?.resultJson as OcrExtractionResult | null | undefined;
  const isProcessing = extractionStatus === "PROCESSING" || extractionStatus === "PENDING";
  const isComplete = extractionStatus === "EXTRACTED" || extractionStatus === "PARTIAL";

  // Form state
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [currency, setCurrency] = useState("PLN");
  const [subtotalGrosze, setSubtotalGrosze] = useState("");
  const [vatAmountGrosze, setVatAmountGrosze] = useState("");
  const [totalGrosze, setTotalGrosze] = useState("");
  const [sellerTaxId, setSellerTaxId] = useState("");
  const [sellerName, setSellerName] = useState("");
  const [buyerTaxId, setBuyerTaxId] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [sellerBankAccount, setSellerBankAccount] = useState("");
  const [lineItems, setLineItems] = useState<LineItemFormData[]>([]);
  const [hasPopulated, setHasPopulated] = useState(false);

  // Cascade animation
  const visibleFields = useCascadeAnimation(isComplete && hasPopulated);

  // Pre-fill from extraction result
  useEffect(() => {
    if (!resultJson || hasPopulated) return;
    if (resultJson.status !== "EXTRACTED" && resultJson.status !== "PARTIAL") return;

    const fields = resultJson.fields;

    setInvoiceNumber(getFieldValue(fields, "invoiceNumber"));
    setIssueDate(getFieldValue(fields, "issueDate"));
    setDueDate(getFieldValue(fields, "dueDate"));
    setCurrency(getFieldValue(fields, "currency") || "PLN");
    setSubtotalGrosze(formatGrosze(getNumericFieldGrosze(fields, "totalNet")));
    setVatAmountGrosze(formatGrosze(getNumericFieldGrosze(fields, "totalTax")));
    setTotalGrosze(formatGrosze(getNumericFieldGrosze(fields, "totalGross")));
    setSellerTaxId(getFieldValue(fields, "sellerNip"));
    setSellerName(getFieldValue(fields, "sellerName"));
    setBuyerTaxId(getFieldValue(fields, "buyerNip"));
    setBuyerName(getFieldValue(fields, "buyerName"));
    setSellerBankAccount(getFieldValue(fields, "bankAccount"));
    setLineItems(mapLineItems(resultJson.lineItems));
    setHasPopulated(true);

    toast.success("Invoice data extracted -- please review before saving");
  }, [resultJson, hasPopulated]);

  // Computed field counts
  const fieldCount = resultJson
    ? Object.values(resultJson.fields).filter((f) => f.value != null).length
    : 0;
  const totalFields = resultJson
    ? Object.keys(resultJson.fields).length
    : 0;

  // Build accept data
  const handleAccept = useCallback(() => {
    onAccept({
      invoiceNumber,
      issueDate,
      dueDate,
      currency,
      subtotalGrosze: parseGrosze(subtotalGrosze),
      vatAmountGrosze: parseGrosze(vatAmountGrosze),
      totalGrosze: parseGrosze(totalGrosze),
      sellerTaxId,
      sellerName,
      buyerTaxId,
      buyerName,
      sellerBankAccount,
      lineItems,
    });
  }, [
    invoiceNumber, issueDate, dueDate, currency,
    subtotalGrosze, vatAmountGrosze, totalGrosze,
    sellerTaxId, sellerName, buyerTaxId, buyerName,
    sellerBankAccount, lineItems, onAccept,
  ]);

  // Field wrapper with cascade animation
  const fieldStyle = (key: string) => ({
    opacity: visibleFields.has(key) ? 1 : 0,
    transition: "opacity 200ms ease-in-out",
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Extraction Status Bar */}
      <ExtractionStatusBar
        status={extractionStatus as "PENDING" | "PROCESSING" | "EXTRACTED" | "PARTIAL" | "FAILED"}
        fieldCount={fieldCount}
        totalFields={totalFields}
        errorMessage={resultJson?.errorMessage}
        onRetry={onRetrigger}
      />

      {/* Split Panel */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:gap-8">
        {/* Left Panel: PDF Viewer */}
        <div className="max-h-[300px] overflow-auto md:max-h-none">
          <PdfViewer url={pdfUrl} className="sticky top-20 min-h-[240px] md:min-h-[400px]" />
        </div>

        {/* Right Panel: Form */}
        <Card className="relative bg-background">
          {isProcessing && <OcrProcessingOverlay />}

          {!isProcessing && (
            <CardContent className="flex flex-col gap-6 p-6">
              {/* Section 1: Invoice Header */}
              <div>
                <h3 className="mb-4 text-xl font-semibold">Review Extracted Data</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div style={fieldStyle("invoiceNumber")}>
                    <ConfidenceFieldWrapper
                      confidence={getFieldConfidence(resultJson?.fields, "invoiceNumber")}
                      label="Invoice Number"
                    >
                      <Input
                        value={invoiceNumber}
                        onChange={(e) => setInvoiceNumber(e.target.value)}
                        placeholder="FV/2026/001"
                      />
                    </ConfidenceFieldWrapper>
                  </div>
                  <div style={fieldStyle("issueDate")}>
                    <ConfidenceFieldWrapper
                      confidence={getFieldConfidence(resultJson?.fields, "issueDate")}
                      label="Issue Date"
                    >
                      <Input
                        type="date"
                        value={issueDate}
                        onChange={(e) => setIssueDate(e.target.value)}
                      />
                    </ConfidenceFieldWrapper>
                  </div>
                  <div style={fieldStyle("dueDate")}>
                    <ConfidenceFieldWrapper
                      confidence={getFieldConfidence(resultJson?.fields, "dueDate")}
                      label="Due Date"
                    >
                      <Input
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                      />
                    </ConfidenceFieldWrapper>
                  </div>
                  <div style={fieldStyle("currency")}>
                    <ConfidenceFieldWrapper
                      confidence={getFieldConfidence(resultJson?.fields, "currency")}
                      label="Currency"
                    >
                      <Select value={currency} onValueChange={(val) => { if (val) setCurrency(val); }}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                        <SelectContent>
                          {CURRENCIES.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </ConfidenceFieldWrapper>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Section 2: Parties */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div style={fieldStyle("sellerTaxId")}>
                  <ConfidenceFieldWrapper
                    confidence={getFieldConfidence(resultJson?.fields, "sellerNip")}
                    label="Seller NIP"
                  >
                    <div className="flex items-center gap-2">
                      <Input
                        value={sellerTaxId}
                        onChange={(e) => setSellerTaxId(e.target.value)}
                        placeholder="0000000000"
                      />
                      <NipValidationBadge nip={sellerTaxId} />
                    </div>
                  </ConfidenceFieldWrapper>
                </div>
                <div style={fieldStyle("buyerTaxId")}>
                  <ConfidenceFieldWrapper
                    confidence={getFieldConfidence(resultJson?.fields, "buyerNip")}
                    label="Buyer NIP"
                  >
                    <div className="flex items-center gap-2">
                      <Input
                        value={buyerTaxId}
                        onChange={(e) => setBuyerTaxId(e.target.value)}
                        placeholder="0000000000"
                      />
                      <NipValidationBadge nip={buyerTaxId} />
                    </div>
                  </ConfidenceFieldWrapper>
                </div>
                <div style={fieldStyle("sellerName")}>
                  <ConfidenceFieldWrapper
                    confidence={getFieldConfidence(resultJson?.fields, "sellerName")}
                    label="Seller Name"
                  >
                    <Input
                      value={sellerName}
                      onChange={(e) => setSellerName(e.target.value)}
                      placeholder="Company name"
                    />
                  </ConfidenceFieldWrapper>
                </div>
                <div style={fieldStyle("buyerName")}>
                  <ConfidenceFieldWrapper
                    confidence={getFieldConfidence(resultJson?.fields, "buyerName")}
                    label="Buyer Name"
                  >
                    <Input
                      value={buyerName}
                      onChange={(e) => setBuyerName(e.target.value)}
                      placeholder="Company name"
                    />
                  </ConfidenceFieldWrapper>
                </div>
              </div>

              <Separator />

              {/* Section 3: Amounts */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div style={fieldStyle("subtotalGrosze")}>
                  <ConfidenceFieldWrapper
                    confidence={getFieldConfidence(resultJson?.fields, "totalNet")}
                    label="Net Amount"
                  >
                    <Input
                      type="number"
                      step="0.01"
                      value={subtotalGrosze}
                      onChange={(e) => setSubtotalGrosze(e.target.value)}
                      placeholder="0.00"
                    />
                  </ConfidenceFieldWrapper>
                </div>
                <div style={fieldStyle("vatAmountGrosze")}>
                  <ConfidenceFieldWrapper
                    confidence={getFieldConfidence(resultJson?.fields, "totalTax")}
                    label="VAT Amount"
                  >
                    <Input
                      type="number"
                      step="0.01"
                      value={vatAmountGrosze}
                      onChange={(e) => setVatAmountGrosze(e.target.value)}
                      placeholder="0.00"
                    />
                  </ConfidenceFieldWrapper>
                </div>
                <div style={fieldStyle("totalGrosze")}>
                  <ConfidenceFieldWrapper
                    confidence={getFieldConfidence(resultJson?.fields, "totalGross")}
                    label="Total Gross"
                  >
                    <Input
                      type="number"
                      step="0.01"
                      value={totalGrosze}
                      onChange={(e) => setTotalGrosze(e.target.value)}
                      placeholder="0.00"
                    />
                  </ConfidenceFieldWrapper>
                </div>
              </div>

              <Separator />

              {/* Section 4: Bank Account */}
              <div style={fieldStyle("sellerBankAccount")}>
                <ConfidenceFieldWrapper
                  confidence={getFieldConfidence(resultJson?.fields, "bankAccount")}
                  label="Seller Bank Account"
                >
                  <Input
                    value={sellerBankAccount}
                    onChange={(e) => setSellerBankAccount(e.target.value)}
                    placeholder="PL00 0000 0000 0000 0000 0000 0000"
                  />
                </ConfidenceFieldWrapper>
              </div>

              <Separator />

              {/* Section 5: Line Items */}
              <LineItemsTable
                items={lineItems}
                onChange={setLineItems}
              />

              <Separator />

              {/* Section 6: Actions */}
              <div className="sticky bottom-0 flex flex-col gap-3 border-t bg-background pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-2">
                  <AlertDialog>
                    <AlertDialogTrigger render={<Button type="button" variant="outline" />}>
                      Discard Extraction
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Discard Extraction</AlertDialogTitle>
                        <AlertDialogDescription>
                          Discard extracted data and start with an empty form?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Keep Data</AlertDialogCancel>
                        <AlertDialogAction onClick={onDiscard}>
                          Discard
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  <AlertDialog>
                    <AlertDialogTrigger render={<Button type="button" variant="ghost" />}>
                      Re-run OCR
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Re-run OCR</AlertDialogTitle>
                        <AlertDialogDescription>
                          Re-running OCR will replace the current extracted data. Continue?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={onRetrigger}>
                          Re-run
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>

                <Button type="button" onClick={handleAccept}>
                  Accept &amp; Save
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
