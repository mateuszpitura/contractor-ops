import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@contractor-ops/ui/components/shadcn/collapsible';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@contractor-ops/ui/components/shadcn/dialog';
import { ChevronDown, Copy, FileCode, Loader2, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type { useZatcaSubmissionDetail } from './hooks/use-zatca-submission-detail.js';
import type { ZatcaBadgeStatus } from './zatca-status-badge.js';
import { ZatcaStatusBadge } from './zatca-status-badge.js';

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

export type ZatcaSubmissionDetailViewProps = {
  submission: ZatcaSubmission;
  invoiceId: string;
  qrCodeBase64?: string;
} & ReturnType<typeof useZatcaSubmissionDetail>;

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function truncateHash(hash?: string | null, length = 8): string {
  if (!hash) return 'N/A';
  return hash.length > length ? `${hash.slice(0, length)}...` : hash;
}

function copyToClipboard(text: string, successMsg: string, errorMsg: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success(successMsg),
    () => toast.error(errorMsg),
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
export function ZatcaSubmissionDetailView({
  submission,
  qrCodeBase64,
  resubmit,
  isResubmitPending,
  t,
}: ZatcaSubmissionDetailViewProps) {
  const [open, setOpen] = useState(false);

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
  const typeLabel = isB2B ? t('typeB2B') : t('typeB2C');

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-lg border bg-card">
        <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors">
          <span>{t('title')}</span>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </CollapsibleTrigger>

        <CollapsibleContent className="border-t px-4 py-4">
          <div className="space-y-4">
            {/* Core fields */}
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              <dt className="text-muted-foreground">{t('uuid')}</dt>
              <dd className="flex items-center gap-1.5">
                <span className="font-mono text-xs break-all">{submission.zatcaUuid}</span>
                <button
                  type="button"
                  // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                  onClick={() =>
                    copyToClipboard(
                      submission.zatcaUuid,
                      t('toast.copySuccess', { label: t('uuid') }),
                      t('toast.copyError'),
                    )
                  }
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                  aria-label={t('copyUuid')}>
                  <Copy className="h-3 w-3" />
                </button>
              </dd>

              <dt className="text-muted-foreground">{t('icv')}</dt>
              <dd className="font-mono text-xs">{submission.icv}</dd>

              <dt className="text-muted-foreground">{t('status')}</dt>
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

              <dt className="text-muted-foreground">{t('type')}</dt>
              <dd className="text-sm">{typeLabel}</dd>
            </dl>

            {/* Hash Chain */}
            {!!(submission.previousHash || submission.invoiceHash) && (
              <div className="space-y-2">
                <p className="text-sm font-medium">{t('hashChain')}</p>
                <div className="space-y-1 text-sm">
                  {!!submission.previousHash && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{t('previousHash')}</span>
                      <span className="font-mono text-xs hidden md:inline">
                        {submission.previousHash}
                      </span>
                      <span className="font-mono text-xs md:hidden">
                        {truncateHash(submission.previousHash)}
                      </span>
                      <button
                        type="button"
                        // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                        onClick={() =>
                          copyToClipboard(
                            submission.previousHash ?? '',
                            t('toast.copySuccess', { label: t('previousHash') }),
                            t('toast.copyError'),
                          )
                        }
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                        aria-label={t('copyPreviousHash')}>
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                  {!!submission.invoiceHash && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{t('invoiceHash')}</span>
                      <span className="font-mono text-xs hidden md:inline">
                        {submission.invoiceHash}
                      </span>
                      <span className="font-mono text-xs md:hidden">
                        {truncateHash(submission.invoiceHash)}
                      </span>
                      <button
                        type="button"
                        // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                        onClick={() =>
                          copyToClipboard(
                            submission.invoiceHash ?? '',
                            t('toast.copySuccess', { label: t('invoiceHash') }),
                            t('toast.copyError'),
                          )
                        }
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                        aria-label={t('copyInvoiceHash')}>
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
                  <img
                    src={`data:image/png;base64,${qrCodeBase64}`}
                    alt={t('qrCodeAlt')}
                    width={64}
                    height={64}
                    className="rounded border"
                  />
                </div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p>{t('qrCodeContains')}</p>
                  <ul className="list-inside list-disc">
                    <li>{t('qrSellerName')}</li>
                    <li>{t('qrVatNumber')}</li>
                    <li>{t('qrInvoiceTotal')}</li>
                    <li>{t('qrVatAmount')}</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Rejection reason */}
            {!!isRejected && !!submission.rejectionReason && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                <p className="font-medium text-destructive">{t('rejectionReason')}</p>
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
                      {t('viewSignedXml')}
                    </Button>
                  }
                />
                <DialogContent className="max-h-[80vh] max-w-3xl overflow-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <FileCode className="size-4" />
                      {t('signedXmlDialogTitle', { uuid: submission.zatcaUuid })}
                    </DialogTitle>
                  </DialogHeader>
                  <pre className="overflow-x-auto rounded-lg bg-muted/30 p-4 font-mono text-xs">
                    {responseData?.signedXml
                      ? String(responseData.signedXml)
                      : t('signedXmlNotAvailable')}
                  </pre>
                </DialogContent>
              </Dialog>

              {/* Resubmit — only for REJECTED */}
              {isRejected && (
                <Button
                  variant="outline"
                  size="sm"
                  // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                  onClick={resubmit}
                  disabled={isResubmitPending}>
                  {isResubmitPending ? (
                    <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <RefreshCw className="me-1.5 h-3.5 w-3.5" />
                  )}
                  {t('resubmit')}
                </Button>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
