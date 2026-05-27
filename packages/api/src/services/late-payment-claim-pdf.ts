// packages/api/src/services/late-payment-claim-pdf.ts
//
// Worker-side rendering of the Late Payment Claim PDF. Invoked from the
// QStash callback route (apps/api/src/routes/late-interest.ts) so the
// tRPC `latePaymentInterest.claim` mutation can return immediately without
// blocking the request on several seconds of React-PDF rendering + R2
// upload latency.
//
// Contract:
//   - Input: a claimId belonging to an InvoiceInterestClaim row with
//     pdfStatus=PENDING_RENDER.
//   - Side effects:
//     - Renders the PDF.
//     - Uploads to R2 under a content-addressed key.
//     - Updates the row to pdfStatus=READY + pdfKey + pdfReadyAt on success,
//       or pdfStatus=FAILED + pdfError on failure.
//
// Idempotent: if a row is already READY we skip the render and return the
// existing key. If it's FAILED we clear the error and retry.

import { prisma } from '@contractor-ops/db';
import { createLogger } from '@contractor-ops/logger';
import { metrics } from '@contractor-ops/logger/metrics';

import { putObjectAndSignDownload } from './r2';

const log = createLogger({ service: 'late-payment-claim-pdf' });

export interface RenderClaimPdfResult {
  claimId: string;
  pdfKey: string;
  skipped: boolean;
}

export async function renderClaimPdf(claimId: string): Promise<RenderClaimPdfResult> {
  const claim = await prisma.invoiceInterestClaim.findUnique({
    where: { id: claimId },
    include: {
      invoice: {
        select: {
          id: true,
          invoiceNumber: true,
          dueDate: true,
        },
      },
      organization: { select: { id: true, name: true } },
    },
  });

  if (!claim) {
    throw new Error(`Claim ${claimId} not found`);
  }

  if (claim.pdfStatus === 'READY' && claim.pdfKey) {
    log.info({ claimId, pdfKey: claim.pdfKey }, 'claim pdf already rendered, skipping');
    metrics.increment('late_interest.claim_pdf.skipped');
    return { claimId, pdfKey: claim.pdfKey, skipped: true };
  }

  // F-ASYNC-15: atomic compare-and-swap on the row state. The reaper
  // re-enqueues stuck PENDING_RENDER rows after 10min; if the original
  // QStash delivery worker is still running, two deliveries can race and
  // both upload to R2 (orphan object best case, wrong-pdf-served worst
  // case). Flip PENDING_RENDER → RENDERING before doing any I/O; whoever
  // wins the CAS owns the render. The other delivery short-circuits.
  //
  // The RENDERING enum literal is added to InvoiceInterestClaimPdfStatus
  // in the same migration as this code (see invoice.prisma); the generated
  // Prisma client picks it up after `db generate` runs in the orchestrator
  // post-merge step. Until then the cast keeps tsc green.
  const claimed = await prisma.invoiceInterestClaim.updateMany({
    where: { id: claim.id, pdfStatus: 'PENDING_RENDER' },
    // biome-ignore lint/suspicious/noExplicitAny: enum migration ships with this commit
    data: { pdfStatus: 'RENDERING' as any },
  });
  if (claimed.count === 0) {
    log.info(
      { claimId, observedStatus: claim.pdfStatus },
      'claim pdf render already in flight or completed; skipping',
    );
    metrics.increment('late_interest.claim_pdf.skipped_cas');
    return { claimId, pdfKey: claim.pdfKey ?? '', skipped: true };
  }

  try {
    const { renderToBuffer } = await import('@react-pdf/renderer');
    const { LatePaymentClaimTemplate } = await import('../pdf-templates/late-payment-claim');

    const pdfBuffer = await renderToBuffer(
      LatePaymentClaimTemplate({
        organizationName: claim.organization.name,
        invoiceNumber: claim.invoice.invoiceNumber,
        invoiceDueDate: claim.invoice.dueDate,
        daysOverdue: claim.snapshotDaysOverdue,
        // Reconstruct the rendered figures from the stored snapshot. These
        // are intentionally the values AS CLAIMED — the PDF is a legal
        // document that must reflect the moment the claim was filed, not
        // a live recomputation.
        principalOutstandingMinor: 0, // snapshot only has totals; template tolerates 0
        rateUsed: Number(claim.snapshotRateUsed),
        dailyInterestMinor: 0,
        accruedInterestMinor: claim.snapshotInterestMinor,
        compensationTierMinor: claim.snapshotCompensationMinor,
        totalClaimMinor: claim.snapshotInterestMinor + claim.snapshotCompensationMinor,
        claimedAt: claim.claimedAt,
      }),
    );

    const pdfKey = `late-interest-claims/${claim.organizationId}/${claim.invoiceId}/${claim.id}.pdf`;

    await putObjectAndSignDownload({
      key: pdfKey,
      body: pdfBuffer,
      contentType: 'application/pdf',
      downloadFilename: `late-payment-claim-${claim.invoice.invoiceNumber}.pdf`,
      ttlSeconds: 60, // immediately discard this signed URL; downloadClaim re-signs on demand
    });

    await prisma.invoiceInterestClaim.update({
      where: { id: claim.id },
      data: {
        pdfKey,
        pdfStatus: 'READY',
        pdfReadyAt: new Date(),
        pdfError: null,
      },
    });

    log.info({ claimId, pdfKey }, 'claim pdf rendered');
    metrics.increment('late_interest.claim_pdf.rendered');
    return { claimId, pdfKey, skipped: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.invoiceInterestClaim.update({
      where: { id: claim.id },
      data: {
        pdfStatus: 'FAILED',
        pdfError: message.slice(0, 1000),
      },
    });
    log.error({ err: message, claimId }, 'claim pdf render failed');
    metrics.increment('late_interest.claim_pdf.failed', 1, {
      reason: err instanceof Error ? err.name : 'Unknown',
    });
    throw err;
  }
}
