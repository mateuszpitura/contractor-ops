// Recipient-copy PDF render + archive for Form 1042-S.
//
// Renders the substitute recipient copy (Pub 1179) from the stored immutable
// Form1042S snapshot ("values as filed", never a live recompute) and archives
// the PDF to the US R2 tax-archive bucket under `1042-s/<orgId>/<id>.pdf`.
// react-pdf is imported lazily so it stays out of cold paths (mirrors
// form-1099-nec-pdf).
//
// Renders the recipient copy ONLY — the IRS copy goes via the IRIS XML e-file
// (Pub 1187), never a rendered PDF.
//
// The recipient copy is archived regardless of furnishing consent: the consent
// gate is on *furnishing* the copy to the recipient (handled in the portal UI),
// not on generating and archiving the record. So generation does not check
// consent.
//
// The render is guarded against double-execution: a compare-and-swap on the row
// claims the archive slot (pdfArchiveKey still null) before any upload, so a
// retried worker short-circuits instead of re-rendering and re-uploading.

import type { Prisma } from '@contractor-ops/db';
import { createLogger } from '@contractor-ops/logger';

import { putObjectAndSignDownload } from './r2';

const log = createLogger({ service: 'form-1042s-pdf' });

/** The fields of an immutable Form1042S snapshot the recipient template needs. */
export interface Form1042SRenderSnapshot {
  taxYear: number;
  payerName: string;
  recipientName: string;
  /** Recipient FTIN last-4 ONLY — a full foreign TIN is never present in the snapshot. */
  recipientFtinLast4: string;
  box1IncomeCode: string;
  box2GrossIncomeMinor: number;
  box3bChap3RateBp: number;
  box7FederalTaxWithheldMinor: number;
  box3aChap3ExemptionCode?: string | null;
  recipientChap3StatusCode?: string | null;
  recipientChap4StatusCode?: string | null;
  recipientLobCode?: string | null;
  treatyArticle?: string | null;
  currency: string;
}

/**
 * Render the recipient-copy PDF from a snapshot to a Buffer. react-pdf and the
 * template are imported lazily so neither loads on cold paths that never render.
 */
export async function renderForm1042SRecipientCopy(
  snapshot: Form1042SRenderSnapshot,
): Promise<Buffer> {
  const { renderToBuffer } = await import('@react-pdf/renderer');
  const { Form1042SRecipientCopyDocument } = await import(
    '../pdf-templates/form-1042s-recipient-copy'
  );

  return renderToBuffer(
    Form1042SRecipientCopyDocument({
      taxYear: snapshot.taxYear,
      payerName: snapshot.payerName,
      recipientName: snapshot.recipientName,
      recipientFtinLast4: snapshot.recipientFtinLast4,
      box1IncomeCode: snapshot.box1IncomeCode,
      box2GrossIncomeMinor: snapshot.box2GrossIncomeMinor,
      box3bChap3RateBp: snapshot.box3bChap3RateBp,
      box7FederalTaxWithheldMinor: snapshot.box7FederalTaxWithheldMinor,
      box3aChap3ExemptionCode: snapshot.box3aChap3ExemptionCode ?? null,
      recipientChap3StatusCode: snapshot.recipientChap3StatusCode ?? null,
      recipientChap4StatusCode: snapshot.recipientChap4StatusCode ?? null,
      recipientLobCode: snapshot.recipientLobCode ?? null,
      treatyArticle: snapshot.treatyArticle ?? null,
      currency: snapshot.currency,
    }),
  );
}

/** R2 archive key for a recipient-copy PDF, scoped by organizationId (ASVS V4). */
export function form1042sArchiveKey(organizationId: string, formId: string): string {
  return `1042-s/${organizationId}/${formId}.pdf`;
}

/**
 * Minimal Prisma surface used by `renderAndArchiveRecipientCopy`. Kept structural
 * so a `$transaction` tx, the tenant client, or a test double satisfy it. The CAS
 * guard claims the archive slot via `updateMany ... where pdfArchiveKey: null`.
 */
export interface Form1042SArchiveClient {
  form1042S: {
    findUnique: (args: { where: { id: string } }) => Promise<{
      id: string;
      organizationId: string;
      pdfArchiveKey: string | null;
      snapshotJson: Prisma.JsonValue;
    } | null>;
    updateMany: (args: {
      where: Prisma.Form1042SWhereInput;
      data: Prisma.Form1042SUpdateManyMutationInput;
    }) => Promise<{ count: number }>;
  };
}

export interface RenderAndArchive1042SResult {
  formId: string;
  pdfArchiveKey: string;
  /** True when a prior render already archived this row — no re-render occurred. */
  skipped: boolean;
}

/**
 * Render the recipient-copy PDF for a filed Form1042S row from its immutable
 * snapshot and archive it to the US R2 tax bucket. A compare-and-swap
 * (`pdfArchiveKey` still null) claims the render so a retried worker
 * short-circuits instead of re-uploading.
 */
export async function renderAndArchiveRecipientCopy(
  db: Form1042SArchiveClient,
  formId: string,
): Promise<RenderAndArchive1042SResult> {
  const row = await db.form1042S.findUnique({ where: { id: formId } });
  if (!row) {
    throw new Error(`renderAndArchiveRecipientCopy: Form1042S ${formId} not found`);
  }

  if (row.pdfArchiveKey) {
    log.info(
      { formId, pdfArchiveKey: row.pdfArchiveKey },
      '1042-S recipient copy already archived; skipping',
    );
    return { formId, pdfArchiveKey: row.pdfArchiveKey, skipped: true };
  }

  const pdfArchiveKey = form1042sArchiveKey(row.organizationId, row.id);

  // CAS: claim the archive slot while it is still unset. Whoever wins owns the
  // render; a concurrent retry sees count 0 and short-circuits.
  const claimed = await db.form1042S.updateMany({
    where: { id: row.id, pdfArchiveKey: null },
    data: { pdfArchiveKey },
  });
  if (claimed.count === 0) {
    log.info({ formId }, '1042-S recipient copy render already claimed; skipping');
    return { formId, pdfArchiveKey, skipped: true };
  }

  const snapshot = row.snapshotJson as unknown as Form1042SRenderSnapshot;
  const pdfBuffer = await renderForm1042SRecipientCopy(snapshot);

  await putObjectAndSignDownload({
    key: pdfArchiveKey,
    body: pdfBuffer,
    contentType: 'application/pdf',
    downloadFilename: `1042-s-${snapshot.taxYear}.pdf`,
    // Immediately discard this signed URL; a download endpoint re-signs on demand.
    ttlSeconds: 60,
  });

  log.info({ formId, pdfArchiveKey }, '1042-S recipient copy rendered and archived');
  return { formId, pdfArchiveKey, skipped: false };
}
