'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Copy, FileCode, Loader2, RefreshCw } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { ZatcaBadgeStatus } from './zatca-status-badge';
import { ZatcaStatusBadge } from './zatca-status-badge';
import { zatcaTrpc } from './zatca-trpc';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ZatcaSubmission {
  id: string;
  icv: number;
  zatcaUuid: string;
  zatcaStatus: string;
  zatcaResponse?: unknown;
  submittedAt?: string | null;
  clearedAt?: string | null;
  reportedAt?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
  invoiceHash?: string;
  previousHash?: string;
}

interface ZatcaSubmissionDetailProps {
  submission: ZatcaSubmission;
  invoiceId: string;
  /** QR code data as base64 string, if available */
  qrCodeBase64?: string;
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function truncateHash(hash?: string | null, length = 8): string {
  if (!hash) return 'N/A';
  return hash.length > length ? `${hash.slice(0, length)}...` : hash;
}

function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success(`${label} copied to clipboard`),
    () => toast.error('Failed to copy'),
  );
}

// ---------------------------------------------------------------------------
// Submission Detail — Collapsible panel
// ---------------------------------------------------------------------------

/**
 * ZATCA Submission Detail panel for invoice detail view.
 * Per UI-SPEC Section 3:
 * - Collapsible Card with UUID, ICV, status, type, hashes (font-mono text-xs)
 * - QR code 64x64px with decoded fields beside it
 * - "View Signed XML" dialog
 * - "Resubmit" button only for REJECTED status
 */
export function ZatcaSubmissionDetail({
  submission,
  invoiceId,
  qrCodeBase64,
}: ZatcaSubmissionDetailProps) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const resubmitMutation = useMutation({
    ...zatcaTrpc.resubmit.mutationOptions(),
    onSuccess: () => {
      toast.success('Invoice queued for ZATCA resubmission');
      queryClient.invalidateQueries({
        queryKey: zatcaTrpc.getStatus.queryKey(),
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to resubmit');
    },
  });

  const statusDate =
    submission.clearedAt ??
    submission.reportedAt ??
    submission.rejectedAt ??
    submission.submittedAt;

  const isRejected = submission.zatcaStatus === 'REJECTED';

  // Determine invoice type label
  const responseData = submission.zatcaResponse as Record<string, unknown> | undefined;
  const invoiceType = responseData?.invoiceType as string | undefined;
  const isB2B = invoiceType === 'standard' || submission.zatcaStatus === 'CLEARED';
  const typeLabel = isB2B
    ? 'Standard Tax Invoice (B2B clearance)'
    : 'Simplified Tax Invoice (B2C reporting)';

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-lg border bg-card">
        <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors">
          <span>ZATCA Submission Details</span>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </CollapsibleTrigger>

        <CollapsibleContent className="border-t px-4 py-4">
          <div className="space-y-4">
            {/* Core fields */}
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              <dt className="text-muted-foreground">UUID</dt>
              <dd className="flex items-center gap-1.5">
                <span className="font-mono text-xs break-all">{submission.zatcaUuid}</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(submission.zatcaUuid, 'UUID')}
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                  aria-label="Copy UUID">
                  <Copy className="h-3 w-3" />
                </button>
              </dd>

              <dt className="text-muted-foreground">ICV</dt>
              <dd className="font-mono text-xs">{submission.icv}</dd>

              <dt className="text-muted-foreground">Status</dt>
              <dd className="flex items-center gap-2">
                <ZatcaStatusBadge
                  status={submission.zatcaStatus as ZatcaBadgeStatus}
                  date={statusDate ? new Date(statusDate).toLocaleDateString() : undefined}
                />
                {!!statusDate && (
                  <span className="text-xs text-muted-foreground">
                    {new Date(statusDate).toLocaleDateString()}
                  </span>
                )}
              </dd>

              <dt className="text-muted-foreground">Type</dt>
              <dd className="text-sm">{typeLabel}</dd>
            </dl>

            {/* Hash Chain */}
            {!!(submission.previousHash || submission.invoiceHash) && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Hash Chain</p>
                <div className="space-y-1 text-sm">
                  {!!submission.previousHash && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Previous Hash:</span>
                      <span className="font-mono text-xs hidden md:inline">
                        {submission.previousHash}
                      </span>
                      <span className="font-mono text-xs md:hidden">
                        {truncateHash(submission.previousHash)}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard(submission.previousHash ?? '', 'Previous hash')
                        }
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                        aria-label="Copy previous hash">
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                  {!!submission.invoiceHash && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Invoice Hash:</span>
                      <span className="font-mono text-xs hidden md:inline">
                        {submission.invoiceHash}
                      </span>
                      <span className="font-mono text-xs md:hidden">
                        {truncateHash(submission.invoiceHash)}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard(submission.invoiceHash ?? '', 'Invoice hash')
                        }
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                        aria-label="Copy invoice hash">
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* QR Code */}
            {!!qrCodeBase64 && (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <div className="shrink-0">
                  <Image
                    src={`data:image/png;base64,${qrCodeBase64}`}
                    alt="ZATCA QR code containing seller name, VAT number, invoice total, and VAT amount"
                    width={64}
                    height={64}
                    className="rounded border"
                    unoptimized
                  />
                </div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p>QR code contains:</p>
                  <ul className="list-inside list-disc">
                    <li>Seller name</li>
                    <li>VAT number</li>
                    <li>Invoice total (with VAT)</li>
                    <li>VAT amount</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Rejection reason */}
            {!!isRejected && !!submission.rejectionReason && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                <p className="font-medium text-destructive">Rejection Reason</p>
                <p className="mt-1 text-destructive/80">{submission.rejectionReason}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              {/* View Signed XML */}
              <Dialog>
                <DialogTrigger
                  render={
                    <Button variant="outline" size="sm">
                      <FileCode className="me-1.5 h-3.5 w-3.5" />
                      View Signed XML
                    </Button>
                  }
                />
                <DialogContent className="max-h-[80vh] max-w-3xl overflow-auto">
                  <DialogHeader>
                    <DialogTitle>Signed XML — Invoice {submission.zatcaUuid}</DialogTitle>
                  </DialogHeader>
                  <pre className="overflow-x-auto rounded-lg bg-muted/30 p-4 font-mono text-xs">
                    {responseData?.signedXml
                      ? String(responseData.signedXml)
                      : 'Signed XML not available. The XML is generated during submission processing.'}
                  </pre>
                </DialogContent>
              </Dialog>

              {/* Resubmit — only for REJECTED */}
              {isRejected && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    (resubmitMutation.mutate as unknown as (input: { invoiceId: string }) => void)({
                      invoiceId,
                    })
                  }
                  disabled={resubmitMutation.isPending}>
                  {resubmitMutation.isPending ? (
                    <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <RefreshCw className="me-1.5 h-3.5 w-3.5" />
                  )}
                  Resubmit to ZATCA
                </Button>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
