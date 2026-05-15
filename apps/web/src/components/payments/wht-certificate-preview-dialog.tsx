'use client';

import { Download, Eye } from 'lucide-react';
import { useLocale } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatMinorUnits } from '@/lib/format-currency';

interface WhtCertificatePreviewProps {
  open: boolean;
  onClose: () => void;
  certificate: {
    certificateNumber: string;
    orgName: string;
    contractorName: string;
    contractorTaxId?: string | null;
    contractorCountry: string;
    paymentDate: string;
    currency: string;
    grossAmountMinor: number;
    whtRate: number;
    whtAmountMinor: number;
    netAmountMinor: number;
    treatyApplied: boolean;
    treatyReference?: string | null;
  } | null;
  onDownload?: () => void;
}

export function WhtCertificatePreviewDialog({
  open,
  onClose,
  certificate,
  onDownload,
}: WhtCertificatePreviewProps) {
  const locale = useLocale();
  if (!certificate) return null;

  return (
    // biome-ignore lint/nursery/noJsxPropsBind: dialog/popover state handler */}
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>WHT Certificate Preview</DialogTitle>
        </DialogHeader>

        <div className="rounded-lg border bg-card p-6">
          {/* Certificate preview content */}
          <div className="mb-6 text-center">
            <h2 className="text-lg font-semibold uppercase tracking-wider">
              Withholding Tax Certificate
            </h2>
            <p className="mt-1 font-mono text-sm text-muted-foreground">
              Certificate No: {certificate.certificateNumber}
            </p>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted-foreground">Organization</span>
              <span className="font-medium">{certificate.orgName}</span>
              <span className="text-muted-foreground">Contractor</span>
              <span className="font-medium">{certificate.contractorName}</span>
              {!!certificate.contractorTaxId && (
                <>
                  <span className="text-muted-foreground">Tax ID</span>
                  <span className="font-medium">{certificate.contractorTaxId}</span>
                </>
              )}
              <span className="text-muted-foreground">Payment Date</span>
              <span className="font-medium">{certificate.paymentDate}</span>
            </div>

            <hr className="border-border" />

            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted-foreground">Gross Amount</span>
              <span className="font-mono font-semibold">
                {certificate.currency}{' '}
                {formatMinorUnits(certificate.grossAmountMinor, certificate.currency, locale)}
              </span>
              <span className="text-muted-foreground">WHT Rate</span>
              <span className="font-semibold">{certificate.whtRate}%</span>
              <span className="text-muted-foreground">WHT Amount</span>
              <span className="font-mono font-semibold">
                {certificate.currency}{' '}
                {formatMinorUnits(certificate.whtAmountMinor, certificate.currency, locale)}
              </span>
              <span className="text-muted-foreground">Net Paid</span>
              <span className="font-mono font-semibold">
                {certificate.currency}{' '}
                {formatMinorUnits(certificate.netAmountMinor, certificate.currency, locale)}
              </span>
            </div>

            {!!certificate.treatyApplied && !!certificate.treatyReference && (
              <p className="text-xs italic text-muted-foreground">
                Treaty: {certificate.treatyReference}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={onDownload}>
            <Download className="me-2 h-4 w-4" />
            Download PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
