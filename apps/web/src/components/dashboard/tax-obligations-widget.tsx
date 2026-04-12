'use client';

import { AlertCircle, Check, Clock } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { trpc } from '@/trpc/init';

function formatMoney(minor: number): string {
  const major = minor / 100;
  return major.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function TaxObligationsWidget() {
  const summaryQuery = trpc.tax.taxSummary.useQuery();

  if (summaryQuery.isLoading || !summaryQuery.data) {
    return null;
  }

  const data = summaryQuery.data;

  return (
    <Card className="p-6">
      <CardHeader className="p-0 pb-4">
        <CardTitle className="text-base font-semibold">Tax Obligations</CardTitle>
      </CardHeader>
      <CardContent className="p-0 space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-medium">VAT This Period</p>
          <div className="space-y-1 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Collected:</span>
              <span className="flex items-center gap-2">
                <span className="font-mono">{formatMoney(data.vatCollectedMinor)}</span>
                <Badge
                  variant="outline"
                  className="border-green-500/20 bg-green-500/5 text-green-600 text-xs">
                  <Check className="me-1 h-3 w-3" /> Filed
                </Badge>
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Owed:</span>
              <span className="flex items-center gap-2">
                <span className="font-mono">{formatMoney(data.vatOwedMinor)}</span>
                <Badge
                  variant="outline"
                  className="border-amber-500/20 bg-amber-500/5 text-amber-600 text-xs">
                  <Clock className="me-1 h-3 w-3" /> Pending
                </Badge>
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Net:</span>
              <span className="font-mono font-medium">{formatMoney(data.vatNetMinor)}</span>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">WHT This Period</p>
          <div className="space-y-1 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Withheld:</span>
              <span className="flex items-center gap-2">
                <span className="font-mono">{formatMoney(data.whtWithheldMinor)}</span>
                <Badge
                  variant="outline"
                  className="border-green-500/20 bg-green-500/5 text-green-600 text-xs">
                  <Check className="me-1 h-3 w-3" /> {data.whtCertCount} certs
                </Badge>
              </span>
            </div>
            {data.whtPendingMinor > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Pending:</span>
                <span className="flex items-center gap-2">
                  <span className="font-mono">{formatMoney(data.whtPendingMinor)}</span>
                  <Badge
                    variant="outline"
                    className="border-amber-500/20 bg-amber-500/5 text-amber-600 text-xs">
                    <AlertCircle className="me-1 h-3 w-3" /> {data.whtPendingCount} items
                  </Badge>
                </span>
              </div>
            )}
          </div>
        </div>

        <Link
          href="/settings/compliance"
          className="mt-2 inline-block text-sm text-primary hover:underline">
          View Details &rarr;
        </Link>
      </CardContent>
    </Card>
  );
}
