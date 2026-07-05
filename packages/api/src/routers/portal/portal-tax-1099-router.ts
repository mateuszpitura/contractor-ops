import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import * as E from '../../errors';
import { router } from '../../init';
import { portalProcedure } from '../../middleware/portal-auth';
import { assertUsExpansionEnabled } from '../../middleware/require-us-expansion-flag';
import { writeAuditLog } from '../../services/audit-writer';
import { form1099NecArchiveKey, renderAndArchiveCopyB } from '../../services/form-1099-nec-pdf';
import { signExistingDownload } from '../../services/r2';

// ---------------------------------------------------------------------------
// Portal Form 1099-NEC electronic-delivery consent + Copy-B download.
//
// The recipient self-serves: every procedure is scoped to the portal-session
// `ctx.contractorId` + `ctx.organizationId` — a client-supplied recipient id is
// never trusted (IDOR guard). The IRS Pub 1179 §4.6 electronic-delivery consent
// is affirmative and audited: the consent timestamp, IP, and actor identity are
// 100% server-derived (the client input carries none of them). Copy B is
// furnished electronically ONLY when a live consent is on record — otherwise the
// recipient is told a paper copy will be mailed and no PDF is offered. The full
// TIN never reaches the recipient: the Copy-B PDF renders the last-4 mask only.
//
// The whole surface is gated behind `module.us-expansion` (the portal router is
// a flat merge that cannot be conditionally spread, so this per-request guard is
// the load-bearing gate).
// ---------------------------------------------------------------------------

const CONSENT_GRANTED = 'form1099.edelivery.consent.granted';
const CONSENT_WITHDRAWN = 'form1099.edelivery.consent.withdrawn';

/** Server-side client-IP derivation from trusted-proxy headers (never client body). */
function deriveClientIp(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? headers.get('x-real-ip') ?? 'unknown'
  );
}

/**
 * The recipient's current electronic-delivery consent state, derived from the
 * append-only audit ledger: the latest grant/withdraw event wins. No dedicated
 * consent row is mutated — consent is an audited, reversible fact.
 */
async function readConsentState(
  db: {
    auditLog: {
      findFirst: (args: {
        where: {
          organizationId: string;
          resourceType: 'CONTRACTOR';
          resourceId: string;
          action: { in: string[] };
        };
        orderBy: { createdAt: 'desc' };
        select: { action: true; createdAt: true };
      }) => Promise<{ action: string; createdAt: Date } | null>;
    };
  },
  organizationId: string,
  contractorId: string,
): Promise<{ consented: boolean; consentedAt: Date | null }> {
  const latest = await db.auditLog.findFirst({
    where: {
      organizationId,
      resourceType: 'CONTRACTOR',
      resourceId: contractorId,
      action: { in: [CONSENT_GRANTED, CONSENT_WITHDRAWN] },
    },
    orderBy: { createdAt: 'desc' },
    select: { action: true, createdAt: true },
  });
  if (!latest || latest.action !== CONSENT_GRANTED) {
    return { consented: false, consentedAt: null };
  }
  return { consented: true, consentedAt: latest.createdAt };
}

export const portalTax1099Router = router({
  /** The recipient's current electronic-delivery consent state. */
  getEdeliveryConsent: portalProcedure.query(async ({ ctx }) => {
    assertUsExpansionEnabled(ctx.organizationId, ctx.region);
    return readConsentState(ctx.db, ctx.organizationId, ctx.contractorId);
  }),

  /**
   * Record an affirmative IRS electronic-delivery consent. The consent
   * timestamp, IP, and actor identity are server-derived — the client input
   * carries none of them (it cannot forge the attestation).
   */
  recordEdeliveryConsent: portalProcedure.input(z.object({}).strict()).mutation(async ({ ctx }) => {
    assertUsExpansionEnabled(ctx.organizationId, ctx.region);

    const ip = deriveClientIp(ctx.headers);
    await writeAuditLog({
      organizationId: ctx.organizationId,
      actorType: 'CONTRACTOR',
      actorId: ctx.contractorId,
      action: CONSENT_GRANTED,
      resourceType: 'CONTRACTOR',
      resourceId: ctx.contractorId,
      ipAddress: ip,
      metadata: { standard: 'IRS Pub 1179 §4.6' },
    });

    return readConsentState(ctx.db, ctx.organizationId, ctx.contractorId);
  }),

  /** Withdraw electronic-delivery consent — a paper copy is mailed thereafter. */
  withdrawConsent: portalProcedure.input(z.object({}).strict()).mutation(async ({ ctx }) => {
    assertUsExpansionEnabled(ctx.organizationId, ctx.region);

    const ip = deriveClientIp(ctx.headers);
    await writeAuditLog({
      organizationId: ctx.organizationId,
      actorType: 'CONTRACTOR',
      actorId: ctx.contractorId,
      action: CONSENT_WITHDRAWN,
      resourceType: 'CONTRACTOR',
      resourceId: ctx.contractorId,
      ipAddress: ip,
      metadata: { standard: 'IRS Pub 1179 §4.6' },
    });

    return readConsentState(ctx.db, ctx.organizationId, ctx.contractorId);
  }),

  /**
   * Download the recipient's own Copy-B PDF for a tax year — furnished ONLY when
   * a live electronic-delivery consent is on record. Without consent, no PDF is
   * offered and the recipient is told a paper copy will be mailed. The PDF
   * renders the recipient TIN last-4 only.
   */
  downloadCopyB: portalProcedure
    .input(z.object({ taxYear: z.number().int().min(2020).max(2100) }).strict())
    .mutation(async ({ ctx, input }) => {
      assertUsExpansionEnabled(ctx.organizationId, ctx.region);

      const consent = await readConsentState(ctx.db, ctx.organizationId, ctx.contractorId);
      if (!consent.consented) {
        return { consented: false as const, paperCopy: true as const };
      }

      const form = await ctx.db.form1099Nec.findFirst({
        where: {
          organizationId: ctx.organizationId,
          recipientId: ctx.contractorId,
          taxYear: input.taxYear,
          status: 'ACTIVE',
        },
        select: { id: true },
      });
      if (!form) {
        throw new TRPCError({ code: 'NOT_FOUND', message: E.FORM_1099_NOT_FOUND });
      }

      await renderAndArchiveCopyB(ctx.db, form.id);
      const key = form1099NecArchiveKey(ctx.organizationId, form.id);
      const { signedUrl, expiresInSeconds } = await signExistingDownload(
        key,
        300,
        `1099-nec-${input.taxYear}.pdf`,
      );

      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorType: 'CONTRACTOR',
        actorId: ctx.contractorId,
        action: 'form1099.copyb.downloaded',
        resourceType: 'CONTRACTOR',
        resourceId: ctx.contractorId,
        ipAddress: deriveClientIp(ctx.headers),
        metadata: { taxYear: input.taxYear, formId: form.id },
      });

      return { consented: true as const, signedUrl, expiresInSeconds };
    }),
});
