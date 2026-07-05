// Employee self-service akta ("akta osobowe") read surface.
//
// The self-view is a distinct trust boundary from the staff section gate: a
// portal employee has no staff role, so the entitled sections are the fixed
// PERSONNEL_FILE_SELF_VIEW_SECTIONS allowlist (section C — pay/national-PII —
// deliberately excluded). The allowlist is applied IN the document `where`
// clause, so an excluded section's document rows are never read into a
// response — the section is decided before the rows are fetched, not
// fetched-then-hidden. Every query is scoped to the SESSION worker's own
// personnel file (ctx.workerId); no client-supplied workerId or section is
// ever trusted.

import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import * as E from '../../errors';
import { portalEmployeeProcedure } from '../../middleware/portal-auth';
import { createRegionalPresignedDownloadUrl } from '../../services/regional-storage';
import { PERSONNEL_FILE_SELF_VIEW_SECTIONS } from './portal-self-view-sections';

// Self-scoped reads take no client-named subject. An explicit `.strict()` empty
// shape makes a smuggled `workerId`/`section` a hard rejection rather than a
// silently-ignored field.
const noSubjectInput = z.object({}).strict().optional();

const aktaDocumentInput = z.object({ documentId: z.string().min(1) }).strict();

interface AktaDocumentView {
  id: string;
  documentId: string;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  uploadedAt: Date | null;
}

interface AktaSectionView {
  section: (typeof PERSONNEL_FILE_SELF_VIEW_SECTIONS)[number];
  documents: AktaDocumentView[];
}

export const portalEmployeeAktaProcedures = {
  /**
   * The caller's OWN personnel file, grouped into the self-viewable sections
   * only. Section C (pay/PII) is excluded by the allowlist applied in the
   * document `where`, so its rows never load. Documents are returned as
   * download-safe metadata (no storageKey); the presigned URL is minted lazily
   * by `getMyAktaDocumentUrl` so the list stays cheap and unsigned.
   */
  getMyAkta: portalEmployeeProcedure.input(noSubjectInput).query(async ({ ctx }) => {
    const file = await ctx.db.personnelFile.findFirst({
      where: {
        workerId: ctx.workerId,
        organizationId: ctx.organizationId,
        deletedAt: null,
      },
      select: { id: true },
    });

    const rows = file
      ? await ctx.db.personnelFileDocument.findMany({
          where: {
            personnelFileId: file.id,
            organizationId: ctx.organizationId,
            // The allowlist is applied in the query — an excluded section's
            // document rows are never read into the response.
            section: { in: [...PERSONNEL_FILE_SELF_VIEW_SECTIONS] },
            deletedAt: null,
          },
          orderBy: [{ documentDate: 'desc' }],
          select: {
            id: true,
            documentId: true,
            section: true,
            documentDate: true,
            createdAt: true,
            document: {
              select: {
                originalFileName: true,
                mimeType: true,
                fileSizeBytes: true,
                createdAt: true,
              },
            },
          },
        })
      : [];

    const sections: AktaSectionView[] = PERSONNEL_FILE_SELF_VIEW_SECTIONS.map(section => ({
      section,
      documents: rows
        .filter(row => row.section === section)
        .map(row => ({
          id: row.id,
          documentId: row.documentId,
          fileName: row.document?.originalFileName ?? null,
          mimeType: row.document?.mimeType ?? null,
          sizeBytes:
            row.document?.fileSizeBytes == null ? null : Number(row.document.fileSizeBytes),
          uploadedAt: row.documentDate ?? row.document?.createdAt ?? row.createdAt ?? null,
        })),
    }));

    return { sections };
  }),

  /**
   * Mint a short-lived download URL for a single akta document. The requested
   * documentId is re-checked against the caller's OWN file AND the self-view
   * allowlist before signing, so a documentId for an excluded section (or
   * another worker's file) is never signed — the ownership + section fence is
   * enforced again at download time, not only at list time.
   */
  getMyAktaDocumentUrl: portalEmployeeProcedure
    .input(aktaDocumentInput)
    .query(async ({ ctx, input }) => {
      const file = await ctx.db.personnelFile.findFirst({
        where: {
          workerId: ctx.workerId,
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!file) {
        throw new TRPCError({ code: 'NOT_FOUND', message: E.PERSONNEL_FILE_DOCUMENT_NOT_FOUND });
      }

      const entry = await ctx.db.personnelFileDocument.findFirst({
        where: {
          documentId: input.documentId,
          personnelFileId: file.id,
          organizationId: ctx.organizationId,
          section: { in: [...PERSONNEL_FILE_SELF_VIEW_SECTIONS] },
          deletedAt: null,
        },
        select: { document: { select: { storageKey: true } } },
      });
      if (!entry?.document?.storageKey) {
        throw new TRPCError({ code: 'NOT_FOUND', message: E.PERSONNEL_FILE_DOCUMENT_NOT_FOUND });
      }

      const downloadUrl = await createRegionalPresignedDownloadUrl(entry.document.storageKey);
      return { downloadUrl };
    }),

  /**
   * Pay-stub availability. v7.0 ships no payslip surface — pay stubs are
   * computed and owned by the external payroll system (the payroll integration
   * is export-only), so this returns a truthful unavailable read model for a
   * real empty state. A future payslip surface flips `available` true and adds
   * a list; it never fabricates a stub.
   */
  getPayStubAvailability: portalEmployeeProcedure.query(() => {
    return { available: false as const, reason: 'EXTERNAL_PAYROLL' as const };
  }),
};
