/**
 * Buffer-only renderers for the classification SDS / DRV defense bundle
 * PDFs (P2-F · F-SCALE-02).
 *
 * Why a separate module
 * ---------------------
 * The original `classificationDocument.generateSds` /
 * `generateDrvDefenseBundle` mutations rendered the React-PDF tree, uploaded
 * to R2, AND signed the URL inline — all on the request path. The new async
 * export framework uploads the bytes itself (via `streamObjectUpload`), so
 * these helpers only need to:
 *
 *   1. Load the assessment + related rows (with the same preconditions
 *      enforced by the original mutations).
 *   2. Render the React-PDF tree to a `Buffer`.
 *   3. Optionally upsert / link a `ClassificationDocument` row so the user
 *      gets the same listByEngagement view.
 *
 * The QStash consumer then writes the buffer to R2 at the canonical export
 * path; the PDF Content-Disposition is included so the download route can
 * stream it back without further mangling.
 */

import { createHash } from 'node:crypto';

import { prisma } from '@contractor-ops/db';
import { createLogger } from '@contractor-ops/logger';

import {
  RENDERER_SLUG as DRV_RENDERER_SLUG,
  TEMPLATE_VERSION as DRV_TEMPLATE_VERSION,
  DRVDefenseBundleDocument,
} from '../pdf-templates/drv-defense-bundle';
import {
  IR35SDSDocument,
  RENDERER_SLUG as SDS_RENDERER_SLUG,
  TEMPLATE_VERSION as SDS_TEMPLATE_VERSION,
} from '../pdf-templates/ir35-sds';
import { buildClassificationDocumentKey } from './classification-document-keys';
import { deleteObject } from './r2';

const log = createLogger({ service: 'classification-document-render' });

// Keep in lock-step with @react-pdf/renderer in the api package.json.
// The pdf-templates also bake this in for byte-level reproducibility.
const REACT_PDF_VERSION = '3.4.5' as const;

function sanitizeFilename(s: string): string {
  return s.replace(/[/\\?%*:|"<>]/g, '-').slice(0, 80);
}

export interface RenderSdsParams {
  organizationId: string;
  classificationAssessmentId: string;
  /**
   * If supplied, the renderer reuses the existing ClassificationDocument
   * row instead of inserting a new one (the byte content is content-
   * addressed by sha256, so a re-render is byte-identical to the original
   * provided the underlying assessment hasn't changed).
   */
  classificationDocumentId?: string;
  requestedByUserId: string | null;
}

export interface RenderResult {
  buffer: Buffer;
  contentDisposition: string;
  documentId: string;
  /** The Content-Addressed R2 key the renderer would have used inline. */
  contentAddressedKey: string;
  sha256Hash: string;
}

/**
 * Render an IR35 SDS PDF to a Buffer + persist (or refresh) the
 * `ClassificationDocument` row. Mirrors the preconditions the original
 * tRPC mutation enforced — keeps the legal contract intact.
 */
export async function renderSdsPdfBuffer(params: RenderSdsParams): Promise<RenderResult> {
  const assessment = await prisma.classificationAssessment.findFirstOrThrow({
    where: {
      id: params.classificationAssessmentId,
      organizationId: params.organizationId,
    },
    include: {
      contractorAssignment: {
        include: { contractor: true, organization: true },
      },
    },
  });

  if (assessment.status !== 'completed' || assessment.questionsSnapshot === null) {
    throw new Error(
      'Assessment must be completed with a captured questions snapshot before generating an SDS.',
    );
  }
  const outcome = assessment.outcome as { kind?: string } | null;
  if (!outcome || outcome.kind !== 'IR35') {
    throw new Error('generateSds only applies to IR35 (GB) classification assessments.');
  }

  // Phase 64 D-22 — SdsApproval gate (LEGAL-05). Maintained for consistency
  // with the original synchronous mutation; if approval is missing we surface
  // a structured error so the export row records SDS_NOT_APPROVED.
  const sdsApproval = await prisma.sdsApproval.findUnique({
    where: { assessmentId: params.classificationAssessmentId },
    select: { id: true },
  });
  if (!sdsApproval) {
    throw new Error('SDS_NOT_APPROVED');
  }

  const renderedAt = assessment.completedAt ?? new Date(0);
  const engagement = assessment.contractorAssignment;
  const contractor = engagement.contractor;
  const organization = engagement.organization;

  const { renderToBuffer } = await import('@react-pdf/renderer');
  const buffer = await renderToBuffer(
    IR35SDSDocument({
      assessment: assessment as unknown as Parameters<typeof IR35SDSDocument>[0]['assessment'],
      engagement: {
        id: engagement.id,
        displayName: contractor.displayName,
        activeFrom: engagement.activeFrom,
        activeTo: engagement.activeTo,
      },
      contractor: { id: contractor.id, displayName: contractor.displayName },
      organization: {
        id: organization.id,
        name: organization.name,
        countryCode: organization.countryCode,
      },
      renderedAt,
    }),
  );

  const sha256Hash = createHash('sha256').update(buffer).digest('hex');
  const key = buildClassificationDocumentKey({
    organizationId: params.organizationId,
    classificationAssessmentId: assessment.id,
    kind: 'SDS',
    ruleSetVersion: assessment.ruleSetVersion,
    sha256: sha256Hash,
  });
  const rendererVersion = `@react-pdf/renderer@${REACT_PDF_VERSION}+${SDS_RENDERER_SLUG}@${SDS_TEMPLATE_VERSION}`;

  const downloadFilename = sanitizeFilename(`SDS-${contractor.displayName}-${engagement.id}.pdf`);

  let documentId = params.classificationDocumentId;
  if (!documentId) {
    try {
      const row = await prisma.classificationDocument.create({
        data: {
          organizationId: params.organizationId,
          classificationAssessmentId: assessment.id,
          kind: 'SDS',
          pdfKey: key,
          sha256Hash,
          byteSize: buffer.byteLength,
          rendererVersion,
          ruleSetVersion: assessment.ruleSetVersion,
          generatedByUserId: params.requestedByUserId ?? '',
        },
      });
      documentId = row.id;
    } catch (err) {
      // Best-effort cleanup of the (yet-to-be-uploaded) R2 key — the export
      // consumer hasn't uploaded yet but if a partial upload sneaks in we
      // don't want orphans.
      // safe-swallow: pre-existing — see goals/production-hardening/ phase B.7.b
      await deleteObject(key).catch(() => undefined);
      log.error(
        { err: err instanceof Error ? err.message : String(err), assessmentId: assessment.id },
        'classificationDocument insert failed during async render',
      );
      throw err;
    }
  }

  return {
    buffer,
    contentDisposition: `attachment; filename="${downloadFilename}"`,
    documentId,
    contentAddressedKey: key,
    sha256Hash,
  };
}

export type RenderDrvParams = RenderSdsParams;

/**
 * Render the DRV defense bundle PDF + persist row. Same shape as
 * {@link renderSdsPdfBuffer}; the orchestration differences live in the
 * data-loading step (cross-references + prior assessments + signed
 * attestation gate).
 */
export async function renderDrvDefenseBundlePdfBuffer(
  params: RenderDrvParams,
): Promise<RenderResult> {
  const assessment = await prisma.classificationAssessment.findFirstOrThrow({
    where: {
      id: params.classificationAssessmentId,
      organizationId: params.organizationId,
    },
    include: {
      contractorAssignment: { include: { contractor: true, organization: true } },
    },
  });

  if (assessment.status !== 'completed' || assessment.questionsSnapshot === null) {
    throw new Error(
      'Assessment must be completed with a captured questions snapshot before generating a DRV defense bundle.',
    );
  }
  const outcome = assessment.outcome as { kind?: string } | null;
  if (!outcome || outcome.kind !== 'SCHEINSELBSTANDIGKEIT') {
    throw new Error(
      'generateDrvDefenseBundle only applies to Scheinselbständigkeit (DE) classification assessments.',
    );
  }

  const priorAssessments = await prisma.classificationAssessment.findMany({
    where: {
      contractorAssignmentId: assessment.contractorAssignmentId,
      status: 'completed',
      countryCode: 'DE',
      id: { not: assessment.id },
    },
    orderBy: { completedAt: 'desc' },
  });

  const attestation = await prisma.ir35OtherClientAttestation.findUnique({
    where: { contractorAssignmentId: assessment.contractorAssignmentId },
  });
  if (!attestation?.signedAt) {
    throw new Error(
      'Signed other-client attestation is required before generating a DRV defense bundle.',
    );
  }

  const crossReference = await prisma.contractorAssignment.findMany({
    where: {
      contractorId: assessment.contractorAssignment.contractorId,
      organizationId: params.organizationId,
      id: { not: assessment.contractorAssignmentId },
    },
    orderBy: { activeFrom: 'desc' },
    select: {
      id: true,
      activeFrom: true,
      activeTo: true,
      status: true,
      organization: { select: { name: true } },
      project: { select: { name: true } },
    },
  });

  const renderedAt = assessment.completedAt ?? new Date(0);
  const engagement = assessment.contractorAssignment;
  const contractor = engagement.contractor;
  const organization = engagement.organization;

  const { renderToBuffer } = await import('@react-pdf/renderer');
  const buffer = await renderToBuffer(
    DRVDefenseBundleDocument({
      assessment: assessment as unknown as Parameters<
        typeof DRVDefenseBundleDocument
      >[0]['assessment'],
      priorAssessments: priorAssessments as unknown as Parameters<
        typeof DRVDefenseBundleDocument
      >[0]['priorAssessments'],
      engagement: {
        id: engagement.id,
        displayName: contractor.displayName,
        activeFrom: engagement.activeFrom,
        activeTo: engagement.activeTo,
      },
      contractor: { id: contractor.id, displayName: contractor.displayName },
      organization: {
        id: organization.id,
        name: organization.name,
        countryCode: organization.countryCode,
      },
      attestation: {
        statementText: attestation.statementText,
        signedName: attestation.signedName,
        signedAt: attestation.signedAt,
      },
      crossReference: crossReference.map(row => ({
        id: row.id,
        activeFrom: row.activeFrom,
        activeTo: row.activeTo,
        status: row.status,
        organization: row.organization,
        project: row.project,
      })),
      renderedAt,
    }),
  );

  const sha256Hash = createHash('sha256').update(buffer).digest('hex');
  const key = buildClassificationDocumentKey({
    organizationId: params.organizationId,
    classificationAssessmentId: assessment.id,
    kind: 'DRV_DEFENSE_BUNDLE',
    ruleSetVersion: assessment.ruleSetVersion,
    sha256: sha256Hash,
  });
  const rendererVersion = `@react-pdf/renderer@${REACT_PDF_VERSION}+${DRV_RENDERER_SLUG}@${DRV_TEMPLATE_VERSION}`;

  const downloadFilename = sanitizeFilename(
    `DRV-Defense-${contractor.displayName}-${engagement.id}.pdf`,
  );

  let documentId = params.classificationDocumentId;
  if (!documentId) {
    try {
      const row = await prisma.classificationDocument.create({
        data: {
          organizationId: params.organizationId,
          classificationAssessmentId: assessment.id,
          kind: 'DRV_DEFENSE_BUNDLE',
          pdfKey: key,
          sha256Hash,
          byteSize: buffer.byteLength,
          rendererVersion,
          ruleSetVersion: assessment.ruleSetVersion,
          generatedByUserId: params.requestedByUserId ?? '',
        },
      });
      documentId = row.id;
    } catch (err) {
      // safe-swallow: pre-existing — see goals/production-hardening/ phase B.7.b
      await deleteObject(key).catch(() => undefined);
      log.error(
        { err: err instanceof Error ? err.message : String(err), assessmentId: assessment.id },
        'DRV defense bundle insert failed during async render',
      );
      throw err;
    }
  }

  return {
    buffer,
    contentDisposition: `attachment; filename="${downloadFilename}"`,
    documentId,
    contentAddressedKey: key,
    sha256Hash,
  };
}
