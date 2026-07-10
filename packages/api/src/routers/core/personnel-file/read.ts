import type { Jurisdiction, PersonnelFileSection } from '@contractor-ops/compliance-policy';
import {
  getPersonnelRetentionRules,
  mapCountryCodeToJurisdiction,
} from '@contractor-ops/compliance-policy';
import { getPersonnelRetentionCutoff } from '@contractor-ops/db';
import { z } from 'zod';
import { router } from '../../../init';
import { requirePermission } from '../../../middleware/rbac';
import { assertWorkforceEnabled } from '../../../middleware/require-workforce-flag';
import { tenantProcedure } from '../../../middleware/tenant';
import {
  hasSectionPermission,
  PERSONNEL_FILE_SECTIONS,
  sectionToShortCode,
} from './section-access';

// ---------------------------------------------------------------------------
// Personnel-file read surface. getFile returns each of the four sections with a
// lock status decided at the permission layer: a section the caller may not read
// comes back { status: 'locked' } carrying its retention posture but NO document
// payload (and no count), so the response never reveals that documents exist in
// a section the caller cannot access. Only unlocked sections have their rows read
// into the `documents` array — we never fetch every section and then filter.
//
// Retention is surfaced per section from the shared resolver: a
// DOCUMENT_DATE-anchored section resolves a representative document date from its
// own rows (the latest of documentDate ?? the underlying Document.createdAt) so
// the displayed cutoff matches the per-document erasure math. Locked sections
// still resolve their representative date server-side to keep the retention
// posture accurate, but never return the documents themselves.
// ---------------------------------------------------------------------------

const getFileInput = z.object({ workerId: z.string() }).strict();

type SectionRow = {
  id: string;
  documentId: string;
  section: PersonnelFileSection | null;
  documentDate: Date | null;
  classificationMethod: string;
  createdAt: Date;
  document: { createdAt: Date } | null;
};

const sectionRowSelect = {
  id: true,
  documentId: true,
  section: true,
  documentDate: true,
  classificationMethod: true,
  createdAt: true,
  document: { select: { createdAt: true } },
} as const;

type PersonnelFileRow = {
  id: string;
  workerId: string;
  countryCode?: string | null;
  hireDate?: Date | null;
  terminatedAt?: Date | null;
};

type RetentionPosture = {
  retainUntil: Date | null;
  citation: string | null;
  indefinite: boolean;
};

/**
 * Latest effective document date across a section's rows — documentDate when set,
 * otherwise the underlying Document.createdAt. Null only when the section has no
 * documents. Taking the latest keeps a DOCUMENT_DATE-anchored window the most
 * conservative (a still-live document holds the whole section).
 */
function representativeDocumentDate(rows: SectionRow[]): Date | null {
  let latest: Date | null = null;
  for (const row of rows) {
    const effective = row.documentDate ?? row.document?.createdAt ?? null;
    if (effective && (latest === null || effective.getTime() > latest.getTime())) {
      latest = effective;
    }
  }
  return latest;
}

/** Resolve a section's retention posture from the shared cutoff resolver. */
function sectionRetention(
  jurisdiction: Jurisdiction | null,
  section: PersonnelFileSection,
  file: PersonnelFileRow,
  sectionDocumentDate: Date | null,
  now: Date,
): RetentionPosture {
  const rules = jurisdiction
    ? getPersonnelRetentionRules(jurisdiction, section, file.hireDate ?? null)
    : [];
  const result = getPersonnelRetentionCutoff(rules, {
    hireDate: file.hireDate ?? null,
    terminationDate: file.terminatedAt ?? null,
    documentDate: sectionDocumentDate,
    now,
  });
  return {
    retainUntil: result.retainUntil,
    citation: result.citation,
    // Retained indefinitely while the employee is active (no termination anchor
    // has started the clock) and no finite cutoff resolved.
    indefinite: result.retainUntil === null && file.terminatedAt == null,
  };
}

function toDocumentView(row: SectionRow) {
  return {
    id: row.id,
    documentId: row.documentId,
    section: row.section,
    documentDate: row.documentDate,
    classificationMethod: row.classificationMethod,
    createdAt: row.createdAt,
  };
}

type FileSectionView =
  | { id: string; status: 'locked'; retention: RetentionPosture }
  | {
      id: string;
      status: 'unlocked';
      documents: ReturnType<typeof toDocumentView>[];
      retention: RetentionPosture;
    };

export const readRouter = router({
  /**
   * Read a worker's personnel file. Cross-org reads resolve to `null` (the tenant
   * client scopes by the session's organizationId; a client-supplied org is never
   * trusted). Each section is gated per the caller's role — locked sections carry
   * their retention posture only, unlocked sections also carry their documents.
   */
  getFile: tenantProcedure
    .use(requirePermission({ employee: ['read'] }))
    .input(getFileInput)
    .query(async ({ ctx, input }) => {
      assertWorkforceEnabled(ctx.organizationId, ctx.region);

      const file = (await ctx.db.personnelFile.findFirst({
        where: {
          workerId: input.workerId,
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
      })) as PersonnelFileRow | null;

      if (!file) return null;

      const jurisdiction = file.countryCode ? mapCountryCodeToJurisdiction(file.countryCode) : null;
      const now = new Date();

      const sections: FileSectionView[] = [];
      for (const section of PERSONNEL_FILE_SECTIONS) {
        const id = sectionToShortCode[section];
        const unlocked = hasSectionPermission(ctx, section);

        const rows = (await ctx.db.personnelFileDocument.findMany({
          where: {
            personnelFileId: file.id,
            section,
            organizationId: ctx.organizationId,
            deletedAt: null,
          },
          orderBy: [{ documentDate: 'desc' }],
          select: sectionRowSelect,
        })) as SectionRow[];

        const retention = sectionRetention(
          jurisdiction,
          section,
          file,
          representativeDocumentDate(rows),
          now,
        );

        if (unlocked) {
          sections.push({
            id,
            status: 'unlocked' as const,
            documents: rows.map(toDocumentView),
            retention,
          });
        } else {
          // No documents/count for a locked section — presence itself is sensitive.
          sections.push({ id, status: 'locked' as const, retention });
        }
      }

      return {
        workerId: file.workerId,
        jurisdiction,
        employmentActive: file.terminatedAt == null,
        terminatedAt: file.terminatedAt ?? null,
        sections,
      };
    }),

  /**
   * Page-level retention panel: every section's retention posture WITHOUT any
   * document payload, regardless of the caller's per-section grants. Retention
   * dates are non-sensitive statutory windows; a locked section's representative
   * document date is resolved server-side so a DOCUMENT_DATE-anchored window stays
   * accurate without leaking that documents exist.
   */
  getRetentionSummary: tenantProcedure
    .use(requirePermission({ employee: ['read'] }))
    .input(getFileInput)
    .query(async ({ ctx, input }) => {
      assertWorkforceEnabled(ctx.organizationId, ctx.region);

      const file = (await ctx.db.personnelFile.findFirst({
        where: {
          workerId: input.workerId,
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
      })) as PersonnelFileRow | null;

      if (!file) return null;

      const jurisdiction = file.countryCode ? mapCountryCodeToJurisdiction(file.countryCode) : null;
      const now = new Date();

      const sections: { id: string; retention: RetentionPosture }[] = [];
      for (const section of PERSONNEL_FILE_SECTIONS) {
        const rows = (await ctx.db.personnelFileDocument.findMany({
          where: {
            personnelFileId: file.id,
            section,
            organizationId: ctx.organizationId,
            deletedAt: null,
          },
          orderBy: [{ documentDate: 'desc' }],
          select: sectionRowSelect,
        })) as SectionRow[];

        sections.push({
          id: sectionToShortCode[section],
          retention: sectionRetention(
            jurisdiction,
            section,
            file,
            representativeDocumentDate(rows),
            now,
          ),
        });
      }

      return {
        workerId: file.workerId,
        jurisdiction,
        employmentActive: file.terminatedAt == null,
        sections,
      };
    }),
});
