// Phase 56 · Plan 07 — Legal tRPC router.
//
// Surfaces server-side actions for the /legal/privacy pages.
//
// generatePrivacyNoticePdf used to render the React-PDF tree inline; under
// burst this allocated ~30-150 MB per request and OOM'd the pod (P2-F ·
// F-SCALE-02). The mutation now enqueues an async export — the consumer
// at `/exports/_process` renders + uploads + emails a download link.
//
// Security contract (ASVS V4 Access Control, Phase 56 D-09):
//   - Input schema is `z.object({}).optional()` — the router NEVER accepts a
//     user-supplied `jurisdiction` field. Zod strips extra properties by
//     default; the exporter resolves jurisdiction from the org row, so a
//     tampered QStash payload still cannot leak a different jurisdiction's
//     content into the PDF.

import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { router } from '../../init';
import { tenantProcedure } from '../../middleware/tenant';
import { requestExport } from '../../services/exports/index';

export const legalRouter = router({
  /**
   * Enqueue an async render of the jurisdiction-appropriate GDPR privacy
   * notice PDF. IDOR-safe by construction — the exporter resolves
   * jurisdiction from the org row, not from caller input.
   *
   * Returns `{ exportId, status: 'PENDING' }` immediately. The user will
   * receive an email with a download link, or can poll the in-app
   * "your exports" panel.
   */
  generatePrivacyNoticePdf: tenantProcedure
    .input(z.object({}).optional())
    .mutation(async ({ ctx }) => {
      if (!ctx.session?.user?.id) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }

      const result = await requestExport({
        organizationId: ctx.organizationId,
        requestedByUserId: ctx.session.user.id,
        type: 'gdpr-privacy-notice',
        params: {},
      });

      return result;
    }),
});
