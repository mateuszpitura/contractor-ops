import type { Jurisdiction } from '@contractor-ops/compliance-policy';
import {
  getPersonnelRetentionRules,
  mapCountryCodeToJurisdiction,
} from '@contractor-ops/compliance-policy';
import type { PersonnelRetentionResult } from '@contractor-ops/db';
import { getPersonnelRetentionCutoff } from '@contractor-ops/db';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { PERSONNEL_FILE_NOT_FOUND } from '../../../errors';
import { router } from '../../../init';
import { requirePermission } from '../../../middleware/rbac';
import { assertWorkforceEnabled } from '../../../middleware/require-workforce-flag';
import { tenantProcedure } from '../../../middleware/tenant';
import type { AuditWriterClient } from '../../../services/audit-writer';
import { writeAuditLog } from '../../../services/audit-writer';
import { PERSONNEL_FILE_SECTIONS, sectionToShortCode } from './section-access';

// ---------------------------------------------------------------------------
// Personnel-file right-to-erasure (RODO art. 17 / GDPR).
//
// A per-employee erasure request is a compliance artifact and must be legally
// honest. Erasure is honored ONLY past each section's statutory retention
// window. A section still inside its window is RETAINED and returned with its
// statutory citation and the date the hold lifts; a section past its window (or
// carrying no statutory hold at all) is ERASED — its documents soft-deleted so
// the data-purge cron finalises the removal after the tenant-wide window.
//
// The response NEVER claims full erasure while any section is under a hold:
// fullErasureClaimed is the plain fact `retained.length === 0`. When any hold is
// active the mutation writes an audit row so the retention-blocked attempt is
// never repudiable — mirroring the org-grain statutory-hold audit on the GDPR
// erasure path, lifted here to per-employee + per-section + per-jurisdiction.
// ---------------------------------------------------------------------------

const requestErasureInput = z.object({ workerId: z.string() }).strict();

type PersonnelFileRow = {
  id: string;
  workerId: string;
  countryCode?: string | null;
  hireDate?: Date | null;
  terminatedAt?: Date | null;
};

type SectionDocRow = {
  id: string;
  documentDate: Date | null;
  document: { createdAt: Date } | null;
};

type SectionDisposition = {
  section: string;
  disposition: 'erased' | 'retained';
  citation?: string;
  retainUntil?: Date;
};

/** Minimal context surface the retained-under-statute audit needs. */
type ErasureAuditContext = {
  organizationId: string;
  headers: Headers;
  user?: { id?: string | null; name?: string | null; email?: string | null } | null;
};

const sectionDocSelect = {
  id: true,
  documentDate: true,
  document: { select: { createdAt: true } },
} as const;

/**
 * Latest effective document date across a section's rows — documentDate when set,
 * otherwise the underlying Document.createdAt. Null only when the section has no
 * documents. Taking the latest keeps a DOCUMENT_DATE-anchored window (e.g. DE
 * accident records) the most conservative: the newest still-live document holds
 * the whole section until it clears its own window.
 */
function representativeDocumentDate(rows: SectionDocRow[]): Date | null {
  let latest: Date | null = null;
  for (const row of rows) {
    const effective = row.documentDate ?? row.document?.createdAt ?? null;
    if (effective && (latest === null || effective.getTime() > latest.getTime())) {
      latest = effective;
    }
  }
  return latest;
}

/**
 * Map a section's resolved retention cutoff to its erasure disposition. Erasable
 * (past window or no hold) → erased. Otherwise retained, carrying the statutory
 * citation and — when the window is finite — the date the hold lifts.
 */
function toDisposition(shortCode: string, cutoff: PersonnelRetentionResult): SectionDisposition {
  if (cutoff.erasable) {
    return { section: shortCode, disposition: 'erased' };
  }
  const citation = cutoff.citation ?? 'Statutory retention hold';
  return cutoff.retainUntil
    ? { section: shortCode, disposition: 'retained', citation, retainUntil: cutoff.retainUntil }
    : { section: shortCode, disposition: 'retained', citation };
}

/**
 * Audit a retention-blocked erasure with the per-section citations, in the same
 * transaction as the soft-deletes so the audit row and the mutation commit or
 * roll back together. Written only when at least one section is held.
 */
async function auditRetainedUnderStatute(
  tx: AuditWriterClient,
  ctx: ErasureAuditContext,
  workerId: string,
  retainedUnderStatute: Record<string, string>,
): Promise<void> {
  await writeAuditLog({
    tx,
    organizationId: ctx.organizationId,
    action: 'personnel_file.erasure_retained_under_statute',
    actorType: 'USER',
    actorId: ctx.user?.id ?? null,
    actorName: ctx.user?.name ?? ctx.user?.email ?? null,
    resourceType: 'USER',
    resourceId: workerId,
    resourceName: 'Personnel File Erasure — Statutory Retention Hold',
    metadata: { retainedUnderStatute },
    ipAddress: ctx.headers.get('x-forwarded-for')?.split(',')[0] ?? null,
    userAgent: ctx.headers.get('user-agent') ?? null,
  });
}

export const erasureRouter = router({
  /**
   * Request erasure of a worker's personnel file. Each of the four sections is
   * resolved against its per-jurisdiction statutory window: past the window the
   * section is erased (its documents soft-deleted), inside the window it is
   * retained and returned with its citation + retainUntil. `fullErasureClaimed`
   * is true only when nothing is retained. Cross-org / missing workers resolve to
   * NOT_FOUND (tenant-scoped lookup, no existence oracle); requires employee:delete.
   */
  requestErasure: tenantProcedure
    .use(requirePermission({ employee: ['delete'] }))
    .input(requestErasureInput)
    .mutation(async ({ ctx, input }) => {
      assertWorkforceEnabled(ctx.organizationId, ctx.region);

      const file = (await ctx.db.personnelFile.findFirst({
        where: {
          workerId: input.workerId,
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
      })) as PersonnelFileRow | null;

      if (!file) {
        throw new TRPCError({ code: 'NOT_FOUND', message: PERSONNEL_FILE_NOT_FOUND });
      }

      const jurisdiction: Jurisdiction | null = file.countryCode
        ? mapCountryCodeToJurisdiction(file.countryCode)
        : null;
      const now = new Date();

      const { sections, retainedUnderStatute } = await ctx.db.$transaction(async tx => {
        const dispositions: SectionDisposition[] = [];
        const retained: Record<string, string> = {};

        for (const section of PERSONNEL_FILE_SECTIONS) {
          const rules = jurisdiction ? getPersonnelRetentionRules(jurisdiction, section) : [];

          const sectionWhere = {
            personnelFileId: file.id,
            section,
            organizationId: ctx.organizationId,
            deletedAt: null,
          };

          const rows = (await tx.personnelFileDocument.findMany({
            where: sectionWhere,
            select: sectionDocSelect,
          })) as SectionDocRow[];

          const cutoff = getPersonnelRetentionCutoff(rules, {
            hireDate: file.hireDate ?? null,
            terminationDate: file.terminatedAt ?? null,
            documentDate: representativeDocumentDate(rows),
            now,
          });

          const disposition = toDisposition(sectionToShortCode[section], cutoff);

          if (disposition.disposition === 'erased') {
            // Past its window (or no statutory hold): soft-delete the section's
            // documents. The windowed hard purge stays the data-purge cron's job.
            await tx.personnelFileDocument.updateMany({
              where: sectionWhere,
              data: { deletedAt: now },
            });
          } else if (disposition.citation) {
            retained[disposition.section] = disposition.citation;
          }

          dispositions.push(disposition);
        }

        if (Object.keys(retained).length > 0) {
          await auditRetainedUnderStatute(tx, ctx, file.workerId, retained);
        }

        return { sections: dispositions, retainedUnderStatute: retained };
      });

      // fullErasureClaimed is the plain fact that nothing is retained — it is true
      // only when zero sections are held. This is the load-bearing honesty
      // guarantee: the response never claims full erasure while a hold is active.
      return {
        workerId: file.workerId,
        fullErasureClaimed: Object.keys(retainedUnderStatute).length === 0,
        sections,
      };
    }),
});
