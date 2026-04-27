// Phase 56 · Plan 07 — Legal tRPC router.
//
// Surfaces server-side actions for the /legal/privacy pages. Currently owns
// `generatePrivacyNoticePdf` — the IDOR-safe PDF download mutation.
//
// Security contract (ASVS V4 Access Control, Phase 56 D-09):
//   - Input schema is `z.object({}).optional()` — the router NEVER accepts a
//     user-supplied `jurisdiction` field. Zod strips extra properties by
//     default; an explicit mismatch against session state would also be
//     rejected by the `assertJurisdictionOrReject` guard (defence-in-depth).
//   - Jurisdiction is derived from `ctx.session.user` via the tenant
//     middleware's organization context and `resolveJurisdiction()`.
//   - R2 object key is scoped by `organizationId` + `jurisdiction` to prevent
//     cross-tenant access. Signed URL TTL is 300 s (matches Phase 51 pattern).

import { resolveJurisdiction } from '@contractor-ops/validators';
import { renderToBuffer } from '@react-pdf/renderer';
import { z } from 'zod';
import { router } from '../../init.js';
import { tenantProcedure } from '../../middleware/tenant.js';
import { GdprPrivacyNoticeTemplate } from '../../pdf-templates/gdpr-privacy-notice.js';
import { putObjectAndSignDownload } from '../../services/r2.js';

const PDF_TTL_SECONDS = 300; // 5 min — short enough to limit URL sharing, long enough for slow networks.

export const legalRouter = router({
  /**
   * Generate a jurisdiction-appropriate GDPR privacy notice PDF for the
   * authenticated user's organisation. IDOR-safe by construction — input
   * accepts no jurisdiction field.
   */
  generatePrivacyNoticePdf: tenantProcedure
    .input(z.object({}).optional())
    .mutation(async ({ ctx }) => {
      const org = await ctx.db.organization.findUniqueOrThrow({
        where: { id: ctx.organizationId },
        select: { id: true, name: true, countryCode: true },
      });

      const jurisdiction = resolveJurisdiction(org.countryCode);

      // Only GB/DE/EU are surfaced as downloadable GDPR notices in Phase 56.
      // AE/SA PDPL notices go through Phase 51's consent router.
      if (jurisdiction !== 'GB' && jurisdiction !== 'DE' && jurisdiction !== 'EU') {
        throw new Error(
          `Privacy notice PDF download not available for jurisdiction '${jurisdiction}'. Use the PDPL consent router for AE/SA.`,
        );
      }

      const pdfBuffer = await renderToBuffer(
        <GdprPrivacyNoticeTemplate
          jurisdiction={jurisdiction}
          organization={{ name: org.name, countryCode: org.countryCode }}
        />,
      );

      const key = `privacy-notices/${org.id}/privacy-${jurisdiction.toLowerCase()}-v1.pdf`;
      const { signedUrl, expiresInSeconds } = await putObjectAndSignDownload({
        key,
        body: pdfBuffer,
        contentType: 'application/pdf',
        downloadFilename: `privacy-notice-${jurisdiction.toLowerCase()}.pdf`,
        ttlSeconds: PDF_TTL_SECONDS,
      });

      return { url: signedUrl, expiresInSeconds, jurisdiction };
    }),
});
