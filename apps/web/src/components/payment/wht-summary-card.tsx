"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Loader2 } from "lucide-react";
import { api } from "@/trpc/react";
import { toast } from "sonner";

interface WhtItem {
  id: string;
  amountMinor: number;
  whtAmountMinor: number | null;
  whtRate: number | null;
  whtTreatyApplied: boolean | null;
  whtCertificateId?: string | null;
  currency: string;
}

interface WhtSummaryCardProps {
  paymentRunId: string;
  items: WhtItem[];
  totalItems: number;
}

function formatMoney(minor: number, currency: string): string {
  const major = minor / 100;
  return `${currency} ${major.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function WhtSummaryCard({ paymentRunId, items, totalItems }: WhtSummaryCardProps) {
  const whtItems = items.filter((i) => i.whtAmountMinor && i.whtAmountMinor > 0);

  if (whtItems.length === 0) return null;

  const currency = whtItems[0]?.currency ?? "SAR";
  const grossTotal = whtItems.reduce((sum, i) => sum + i.amountMinor, 0);
  const whtTotal = whtItems.reduce((sum, i) => sum + (i.whtAmountMinor ?? 0), 0);
  const netTotal = grossTotal - whtTotal;
  const treatyCount = whtItems.filter((i) => i.whtTreatyApplied).length;
  const uncertified = whtItems.filter((i) => !i.whtCertificateId).length;

  const bulkGenerate = api.tax.generateWhtCertificate.useMutation({
    onSuccess: () => {
      toast.success("WHT certificate generated");
    },
    onError: (err) => {
      toast.error(err.message || "Certificate generation failed. Check that all payment details are complete and try again.");
    },
  });

  function handleGenerateAll() {
    for (const item of whtItems.filter((i) => !i.whtCertificateId)) {
      bulkGenerate.mutate({ paymentRunItemId: item.id });
    }
  }

  return (
    <Card className="p-6">
      <CardHeader className="p-0 pb-4">
        <CardTitle className="text-base font-semibold">
          Withholding Tax Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          <div>
            <p className="text-sm text-muted-foreground">Gross Total</p>
            <p className="font-mono text-xl font-semibold">{formatMoney(grossTotal, currency)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">WHT Withheld</p>
            <p className="font-mono text-xl font-semibold">{formatMoney(whtTotal, currency)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Net Payable</p>
            <p className="font-mono text-xl font-semibold">{formatMoney(netTotal, currency)}</p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
          <span>Items with WHT: {whtItems.length} of {totalItems}</span>
          {treatyCount > 0 && (
            <Badge variant="secondary">Treaty rates applied: {treatyCount}</Badge>
          )}
        </div>

        {uncertified > 0 && (
          <div className="mt-6">
            <Button onClick={handleGenerateAll} disabled={bulkGenerate.isPending}>
              {bulkGenerate.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating...</>
              ) : (
                <><FileText className="mr-2 h-4 w-4" />Generate Certificates ({uncertified})</>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
