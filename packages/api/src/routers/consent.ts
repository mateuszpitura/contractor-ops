/**
 * Consent router — PDPL consent management and privacy notice APIs.
 *
 * Per D-01/D-02: Exposes per-purpose consent grant/revoke, privacy notice
 * retrieval, and admin consent audit endpoints. User-facing endpoints scope
 * to authenticated user. Admin endpoints require settings:read permission.
 */

import { prisma } from "@contractor-ops/db";
import {
  bulkGrantConsentSchema,
  consentPurposeEnum,
  consentQuerySchema,
  grantConsentSchema,
} from "@contractor-ops/validators";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router } from "../init.js";
import { requirePermission } from "../middleware/rbac.js";
import { sensitiveActionProcedure } from "../middleware/sensitive.js";
import { tenantProcedure } from "../middleware/tenant.js";
import {
  bulkGrantConsent,
  getConsentHistory,
  getCurrentConsent,
  grantConsent,
  hasRequiredConsents,
  revokeConsent,
} from "../services/consent-record.js";
import {
  detectCrossBorderTransfer,
  generateDPA,
  generateSCC,
} from "../services/legal-document-generation.js";
import { getPrivacyNotice } from "../services/privacy-notice.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractClientInfo(headers: Headers): {
  ipAddress: string | null;
  userAgent: string | null;
} {
  return {
    ipAddress:
      headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? headers.get("x-real-ip") ?? null,
    userAgent: headers.get("user-agent") ?? null,
  };
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const consentRouter = router({
  /**
   * Get privacy notice for current org's jurisdiction.
   * Returns null if org has no countryCode or is not in a PDPL jurisdiction.
   */
  getPrivacyNotice: tenantProcedure.query(async ({ ctx }) => {
    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: ctx.organizationId },
      select: { countryCode: true },
    });
    if (!org.countryCode) return null;
    return getPrivacyNotice(ctx.organizationId, org.countryCode);
  }),

  /**
   * Get current consent state for the authenticated user.
   * Returns a map of purpose -> { granted, version, lastUpdated }.
   */
  getCurrentConsent: tenantProcedure.query(async ({ ctx }) => {
    const consentMap = await getCurrentConsent(ctx.organizationId, ctx.user.id);
    // Convert Map to plain object for serialization
    return Object.fromEntries(consentMap);
  }),

  /**
   * Get consent history for the authenticated user, optionally filtered by purpose.
   */
  getConsentHistory: tenantProcedure.input(consentQuerySchema).query(async ({ ctx, input }) => {
    return getConsentHistory(ctx.organizationId, ctx.user.id, input.purpose);
  }),

  /**
   * Check if the authenticated user has granted all required consents.
   */
  hasRequiredConsents: tenantProcedure.query(async ({ ctx }) => {
    return hasRequiredConsents(ctx.organizationId, ctx.user.id);
  }),

  /**
   * Grant or revoke consent for a single purpose.
   * Sensitive action: requires re-authentication if session > 5 minutes old.
   */
  grant: sensitiveActionProcedure.input(grantConsentSchema).mutation(async ({ ctx, input }) => {
    const { ipAddress, userAgent } = extractClientInfo(ctx.headers);

    if (input.granted) {
      return grantConsent(ctx.organizationId, ctx.user.id, input.purpose, ipAddress, userAgent);
    } else {
      return revokeConsent(ctx.organizationId, ctx.user.id, input.purpose, ipAddress, userAgent);
    }
  }),

  /**
   * Bulk grant consents — used during onboarding to accept multiple purposes.
   * Sensitive action: requires re-authentication if session > 5 minutes old.
   */
  bulkGrant: sensitiveActionProcedure
    .input(bulkGrantConsentSchema)
    .mutation(async ({ ctx, input }) => {
      const { ipAddress, userAgent } = extractClientInfo(ctx.headers);

      return bulkGrantConsent(
        ctx.organizationId,
        ctx.user.id,
        input.consents,
        ipAddress,
        userAgent,
      );
    }),

  /**
   * Admin: get consent state for any user in the org.
   * Requires settings:read permission.
   */
  adminGetUserConsent: tenantProcedure
    .use(requirePermission({ settings: ["read"] }))
    .input(z.object({ userId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const consentMap = await getCurrentConsent(ctx.organizationId, input.userId);
      return Object.fromEntries(consentMap);
    }),

  /**
   * Admin: get consent history for any user in the org.
   * Requires settings:read permission.
   */
  adminGetUserConsentHistory: tenantProcedure
    .use(requirePermission({ settings: ["read"] }))
    .input(
      z.object({
        userId: z.string().min(1),
        purpose: consentPurposeEnum.optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return getConsentHistory(ctx.organizationId, input.userId, input.purpose);
    }),

  /**
   * Download Data Processing Agreement for current org.
   * Returns HTML content for client-side rendering/download.
   */
  downloadDPA: tenantProcedure
    .use(requirePermission({ settings: ["read"] }))
    .mutation(async ({ ctx }) => {
      const result = await generateDPA(ctx.organizationId);
      if (!result) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "DPA not available for this jurisdiction",
        });
      }
      return result;
    }),

  /**
   * Download Standard Contractual Clauses for cross-border transfers.
   * Returns null-equivalent error if no cross-border transfer detected.
   */
  downloadSCC: tenantProcedure
    .use(requirePermission({ settings: ["read"] }))
    .mutation(async ({ ctx }) => {
      const result = await generateSCC(ctx.organizationId);
      if (!result) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No cross-border transfer detected — SCC not required for your jurisdiction",
        });
      }
      return result;
    }),

  /**
   * Get cross-border transfer status for the current org.
   */
  getCrossBorderStatus: tenantProcedure.query(async ({ ctx }) => {
    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: ctx.organizationId },
      select: { countryCode: true },
    });
    if (!org.countryCode) {
      return { detected: false, orgRegion: null, hostingRegion: null };
    }
    const result = detectCrossBorderTransfer(org.countryCode);
    return {
      detected: result.isCrossBorder,
      orgRegion: result.orgRegion,
      hostingRegion: result.hostingRegion,
    };
  }),
});
