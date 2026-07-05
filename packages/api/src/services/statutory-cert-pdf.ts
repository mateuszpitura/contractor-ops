// Statutory termination-certificate PDF render + archive.
//
// Mirrors form-1099-nec-pdf: renders a DRAFT cert from the stored immutable
// snapshot ("values as of generation", never a live recompute), then archives
// the PDF to the org-scoped R2 key `emp-cert/<orgId>/<id>.pdf`. react-pdf and the
// per-cert template are imported lazily so they stay out of cold paths.
//
// PII boundary: the snapshot carries `*Last4` identifiers only. A recursive strip
// defensively drops any full national-ID key (pesel/ssn/nino/steuerId/iqama/
// emiratesId) a caller leaks so a full identifier can never reach the PDF.
//
// The render is guarded against double-execution: a compare-and-swap on the row
// claims the archive slot (pdfArchiveKey still null) before any I/O, so a retried
// worker short-circuits instead of re-rendering and re-uploading.

import type { Prisma } from '@contractor-ops/db';
import { createLogger } from '@contractor-ops/logger';

import type { CertRenderSnapshot } from '../pdf-templates/statutory-cert-shell';
import { putObjectAndSignDownload } from './r2';

const log = createLogger({ service: 'statutory-cert-pdf' });

export type { CertRenderSnapshot };

/** Full national-ID keys never permitted in a cert snapshot — only `*Last4` survives. */
const FORBIDDEN_CERT_KEYS = new Set([
  'pesel',
  'peselencrypted',
  'ssn',
  'ssnencrypted',
  'nino',
  'ninoencrypted',
  'steuerid',
  'steueridnr',
  'iqama',
  'iqamaencrypted',
  'emiratesid',
  'emiratesidencrypted',
]);

/** Recursively drop any full national-ID key, keeping the `*Last4` reference. */
export function sanitizeCertSnapshot<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(sanitizeCertSnapshot) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_CERT_KEYS.has(key.toLowerCase())) continue;
      out[key] = sanitizeCertSnapshot(val);
    }
    return out as unknown as T;
  }
  return value;
}

/** R2 archive key for a statutory cert PDF, scoped by organizationId (ASVS V4). */
export function statutoryCertArchiveKey(organizationId: string, certId: string): string {
  return `emp-cert/${organizationId}/${certId}.pdf`;
}

// biome-ignore lint/suspicious/noExplicitAny: react-pdf DocumentProps element is structurally opaque here.
type CertComponent = (props: { snapshot: CertRenderSnapshot }) => any;

async function resolveTemplate(certType: string): Promise<CertComponent> {
  switch (certType) {
    case 'SWIADECTWO_PRACY':
      return (await import('../pdf-templates/swiadectwo-pracy')).SwiadectwoPracyDocument;
    case 'PIT_11':
      return (await import('../pdf-templates/pit-11')).Pit11Document;
    case 'ARBEITSZEUGNIS_SIMPLE':
      return (await import('../pdf-templates/arbeitszeugnis-simple')).ArbeitszeugnisSimpleDocument;
    case 'LOHNSTEUERBESCHEINIGUNG':
      return (await import('../pdf-templates/lohnsteuerbescheinigung'))
        .LohnsteuerbescheinigungDocument;
    case 'P45':
      return (await import('../pdf-templates/p45')).P45Document;
    case 'W2':
      return (await import('../pdf-templates/w2')).W2Document;
    default:
      throw new Error(`statutory-cert-pdf: unsupported certType ${certType}`);
  }
}

/**
 * Render a DRAFT cert PDF from an immutable snapshot to a Buffer. The snapshot is
 * sanitized (no full national ID survives); react-pdf and the template are lazily
 * imported so neither loads on cold paths that never render.
 */
export async function renderStatutoryCert(snapshot: CertRenderSnapshot): Promise<Buffer> {
  const safe = sanitizeCertSnapshot(snapshot);
  const { renderToBuffer } = await import('@react-pdf/renderer');
  const Component = await resolveTemplate(safe.certType);
  return renderToBuffer(Component({ snapshot: safe }));
}

/**
 * Minimal Prisma surface used by `renderAndArchiveStatutoryCert`. Kept structural
 * so a `$transaction` tx, the tenant client, or a test double satisfy it. The CAS
 * guard claims the archive slot via `updateMany ... where pdfArchiveKey: null`.
 */
export interface StatutoryCertArchiveClient {
  statutoryCertificate: {
    findUnique: (args: { where: { id: string } }) => Promise<{
      id: string;
      organizationId: string;
      certType: string;
      jurisdiction: string;
      pdfArchiveKey: string | null;
      snapshotJson: Prisma.JsonValue;
    } | null>;
    updateMany: (args: {
      where: Prisma.StatutoryCertificateWhereInput;
      data: Prisma.StatutoryCertificateUpdateManyMutationInput;
    }) => Promise<{ count: number }>;
  };
}

export interface RenderAndArchiveCertResult {
  certId: string;
  pdfArchiveKey: string;
  /** True when a prior render already archived this row — no re-render occurred. */
  skipped: boolean;
}

/**
 * Render the DRAFT cert PDF for a StatutoryCertificate row from its immutable
 * snapshot and archive it to the org-scoped R2 key. A compare-and-swap
 * (`pdfArchiveKey` still null) claims the render so a retried worker
 * short-circuits instead of re-uploading.
 */
export async function renderAndArchiveStatutoryCert(
  db: StatutoryCertArchiveClient,
  certId: string,
): Promise<RenderAndArchiveCertResult> {
  const row = await db.statutoryCertificate.findUnique({ where: { id: certId } });
  if (!row) {
    throw new Error(`renderAndArchiveStatutoryCert: StatutoryCertificate ${certId} not found`);
  }

  if (row.pdfArchiveKey) {
    log.info(
      { certId, pdfArchiveKey: row.pdfArchiveKey },
      'statutory cert already archived; skipping',
    );
    return { certId, pdfArchiveKey: row.pdfArchiveKey, skipped: true };
  }

  const pdfArchiveKey = statutoryCertArchiveKey(row.organizationId, row.id);

  // CAS: claim the archive slot while it is still unset. Whoever wins owns the
  // render; a concurrent retry sees count 0 and short-circuits.
  const claimed = await db.statutoryCertificate.updateMany({
    where: { id: row.id, pdfArchiveKey: null },
    data: { pdfArchiveKey },
  });
  if (claimed.count === 0) {
    log.info({ certId }, 'statutory cert render already claimed; skipping');
    return { certId, pdfArchiveKey, skipped: true };
  }

  const snapshot = row.snapshotJson as unknown as CertRenderSnapshot;
  const pdfBuffer = await renderStatutoryCert(snapshot);

  await putObjectAndSignDownload({
    key: pdfArchiveKey,
    body: pdfBuffer,
    contentType: 'application/pdf',
    downloadFilename: `${row.certType.toLowerCase()}.pdf`,
    // Immediately discard this signed URL; a download endpoint re-signs on demand.
    ttlSeconds: 60,
  });

  log.info({ certId, pdfArchiveKey }, 'statutory cert rendered and archived');
  return { certId, pdfArchiveKey, skipped: false };
}
