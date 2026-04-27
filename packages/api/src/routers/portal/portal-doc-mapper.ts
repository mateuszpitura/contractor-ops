import type { Prisma } from '@contractor-ops/db';
import { createRegionalPresignedDownloadUrl } from '../../services/regional-storage.js';

/**
 * Shared Prisma include shape for DocumentLink rows surfaced to the portal.
 *
 * Selected once so the contractor-portal procedures (`getContract`,
 * `listDocuments`) reuse a single Prisma generic instantiation rather than
 * declaring identical inline `include`s in each handler.
 */
export const portalDocLinkInclude = {
  document: {
    select: {
      id: true,
      originalFileName: true,
      mimeType: true,
      fileSizeBytes: true,
      documentType: true,
      createdAt: true,
      storageKey: true,
    },
  },
} as const satisfies Prisma.DocumentLinkInclude;

export type PortalDocLinkRow = Prisma.DocumentLinkGetPayload<{
  include: typeof portalDocLinkInclude;
}>;

/**
 * Reshapes a Prisma `DocumentLink` row (with the `portalDocLinkInclude` shape)
 * into the public portal document descriptor and signs a regional download URL.
 * `storageKey` is intentionally not surfaced — clients receive only the URL.
 */
export async function mapPortalDocLink(link: PortalDocLinkRow) {
  const downloadUrl = await createRegionalPresignedDownloadUrl(link.document.storageKey);
  return {
    id: link.document.id,
    name: link.document.originalFileName,
    type: link.document.documentType,
    mimeType: link.document.mimeType,
    sizeBytes: Number(link.document.fileSizeBytes),
    addedAt: link.document.createdAt,
    downloadUrl,
  };
}
