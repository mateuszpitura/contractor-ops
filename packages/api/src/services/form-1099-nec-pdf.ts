// Recipient Copy-B PDF render + archive for Form 1099-NEC.
//
// Renders the substitute Copy B (Pub 1179 §4.6) from the stored immutable
// Form1099Nec snapshot ("values as filed", never a live recompute) and archives
// the PDF to the US R2 tax-archive bucket under `1099-nec/<orgId>/<id>.pdf`.
// react-pdf is imported lazily so it stays out of cold paths (mirrors
// late-payment-claim-pdf).
//
// Renders Copy B ONLY — the IRS Copy A goes via the IRIS XML e-file, never a
// rendered PDF.
//
// The render is guarded against double-execution: a compare-and-swap on the row
// claims the archive slot (pdfArchiveKey still null) before any I/O, so a
// retried worker short-circuits instead of re-rendering and re-uploading.

import type { Prisma } from '@contractor-ops/db';
import { createLogger } from '@contractor-ops/logger';

import { putObjectAndSignDownload } from './r2';

const log = createLogger({ service: 'form-1099-nec-pdf' });

/** The fields of an immutable Form1099Nec snapshot the Copy-B template needs. */
export interface Form1099NecRenderSnapshot {
  taxYear: number;
  payerName: string;
  recipientName: string;
  /** Recipient TIN last-4 ONLY — a full SSN/TIN is never present in the snapshot. */
  recipientTinLast4: string;
  box1AmountMinor: number;
  box4BackupWithholdingMinor: number;
  currency: string;
}

/**
 * Render the recipient Copy-B PDF from a snapshot to a Buffer. react-pdf and the
 * template are imported lazily so neither loads on cold paths that never render.
 */
export async function renderForm1099NecCopyB(snapshot: Form1099NecRenderSnapshot): Promise<Buffer> {
  const { renderToBuffer } = await import('@react-pdf/renderer');
  const { Form1099NecCopyBDocument } = await import('../pdf-templates/form-1099-nec-copy-b');

  return renderToBuffer(
    Form1099NecCopyBDocument({
      taxYear: snapshot.taxYear,
      payerName: snapshot.payerName,
      recipientName: snapshot.recipientName,
      recipientTinLast4: snapshot.recipientTinLast4,
      box1AmountMinor: snapshot.box1AmountMinor,
      box4BackupWithholdingMinor: snapshot.box4BackupWithholdingMinor,
      currency: snapshot.currency,
    }),
  );
}

/** R2 archive key for a recipient Copy-B PDF, scoped by organizationId (ASVS V4). */
export function form1099NecArchiveKey(organizationId: string, formId: string): string {
  return `1099-nec/${organizationId}/${formId}.pdf`;
}

/**
 * Minimal Prisma surface used by `renderAndArchiveCopyB`. Kept structural so a
 * `$transaction` tx, the tenant client, or a test double satisfy it. The CAS
 * guard claims the archive slot via `updateMany ... where pdfArchiveKey: null`.
 */
export interface Form1099NecArchiveClient {
  form1099Nec: {
    findUnique: (args: { where: { id: string } }) => Promise<{
      id: string;
      organizationId: string;
      pdfArchiveKey: string | null;
      snapshotJson: Prisma.JsonValue;
    } | null>;
    updateMany: (args: {
      where: Prisma.Form1099NecWhereInput;
      data: Prisma.Form1099NecUpdateManyMutationInput;
    }) => Promise<{ count: number }>;
  };
}

export interface RenderAndArchiveResult {
  formId: string;
  pdfArchiveKey: string;
  /** True when a prior render already archived this row — no re-render occurred. */
  skipped: boolean;
}

/**
 * Render the Copy-B PDF for a filed Form1099Nec row from its immutable snapshot
 * and archive it to the US R2 tax bucket. A compare-and-swap (`pdfArchiveKey`
 * still null) claims the render so a retried worker short-circuits instead of
 * re-uploading.
 */
export async function renderAndArchiveCopyB(
  db: Form1099NecArchiveClient,
  formId: string,
): Promise<RenderAndArchiveResult> {
  const row = await db.form1099Nec.findUnique({ where: { id: formId } });
  if (!row) {
    throw new Error(`renderAndArchiveCopyB: Form1099Nec ${formId} not found`);
  }

  if (row.pdfArchiveKey) {
    log.info(
      { formId, pdfArchiveKey: row.pdfArchiveKey },
      '1099-NEC copy-b already archived; skipping',
    );
    return { formId, pdfArchiveKey: row.pdfArchiveKey, skipped: true };
  }

  const pdfArchiveKey = form1099NecArchiveKey(row.organizationId, row.id);

  // CAS: claim the archive slot while it is still unset. Whoever wins owns the
  // render; a concurrent retry sees count 0 and short-circuits.
  const claimed = await db.form1099Nec.updateMany({
    where: { id: row.id, pdfArchiveKey: null },
    data: { pdfArchiveKey },
  });
  if (claimed.count === 0) {
    log.info({ formId }, '1099-NEC copy-b render already claimed; skipping');
    return { formId, pdfArchiveKey, skipped: true };
  }

  const snapshot = row.snapshotJson as unknown as Form1099NecRenderSnapshot;
  const pdfBuffer = await renderForm1099NecCopyB(snapshot);

  await putObjectAndSignDownload({
    key: pdfArchiveKey,
    body: pdfBuffer,
    contentType: 'application/pdf',
    downloadFilename: `1099-nec-${snapshot.taxYear}.pdf`,
    // Immediately discard this signed URL; a download endpoint re-signs on demand.
    ttlSeconds: 60,
  });

  log.info({ formId, pdfArchiveKey }, '1099-NEC copy-b rendered and archived');
  return { formId, pdfArchiveKey, skipped: false };
}
