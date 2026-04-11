"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Loader2 } from "lucide-react";
import { trpc } from "@/trpc/init";
import { toast } from "sonner";
import { formatMinorUnits } from "@/lib/format-currency";

interface WhtSummaryCardProps {
  paymentRunId: string;
  items: Array<{
    id: string;
    amountMinor: number;
    grossAmountMinor?: number | null;
    whtAmountMinor?: number | null;
    whtRate?: number | null;
    whtTreatyApplied?: boolean | null;
    currency: string;
  }>;
}

export function WhtSummaryCard({ paymentRunId, items }: WhtSummaryCardProps) {
  const whtItems = items.filter((i) => i.whtAmountMinor && i.whtAmountMinor > 0);

  const generateMutation = trpc.tax.generateWhtCertificate.useMutation({
    onSuccess: (data) => {
      toast.success(`Certificate ${data.certificateNumber} generated`);
    },
    onError: (err) => {
      toast.error(
        err.message ||
          "Certificate generation failed. Check that all payment details are complete and try again.",
      );
    },
  });

  if (whtItems.length === 0) return null;

  const currency = whtItems[0]?.currency ?? "SAR";
  const totalGross = whtItems.reduce(
    (sum, i) => sum + (i.grossAmountMinor ?? i.amountMinor),
    0,
  );
  const totalWht = whtItems.reduce((sum, i) => sum + (i.whtAmountMinor ?? 0), 0);
  const totalNet = totalGross - totalWht;
  const treatyCount = whtItems.filter((i) => i.whtTreatyApplied).length;

  function handleGenerateAll() {
    for (const item of whtItems) {
      generateMutation.mutate({ paymentRunItemId: item.id });
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
        <div className="grid grid-cols-3 gap-8">
          <div>
            <p className="text-sm text-muted-foreground">Gross Total</p>
            <p className="font-mono text-xl font-semibold">
              {currency} {formatMinorUnits(totalGross, currency)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">WHT Withheld</p>
            <p className="font-mono text-xl font-semibold">
              {currency} {formatMinorUnits(totalWht, currency)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Net Payable</p>
            <p className="font-mono text-xl font-semibold">
              {currency} {formatMinorUnits(totalNet, currency)}
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
          <span>
            Items with WHT: {whtItems.length} of {items.length}
          </span>
          {treatyCount > 0 && (
            <Badge variant="outline">Treaty rates applied: {treatyCount}</Badge>
          )}
        </div>

        <Button
          onClick={handleGenerateAll}
          disabled={generateMutation.isPending}
          className="mt-6"
        >
          {generateMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <FileText className="mr-2 h-4 w-4" />
          )}
          Generate Certificates
        </Button>
      </CardContent>
    </Card>
  );
}
