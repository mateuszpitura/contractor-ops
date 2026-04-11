import { prisma } from "@contractor-ops/db";
import {
  listProfiles,
  computeKsefComplianceStatus,
} from "@contractor-ops/einvoice";
import { router } from "../init.js";
import { tenantProcedure } from "../middleware/tenant.js";
import { requirePermission } from "../middleware/rbac.js";

// ---------------------------------------------------------------------------
// E-Invoicing Router
// ---------------------------------------------------------------------------

export const einvoiceRouter = router({
  /**
   * Get compliance statuses for all registered e-invoicing profiles.
   * Returns per-profile compliance state (active, degraded, error, etc.)
   * for the current organization.
   */
  complianceStatuses: tenantProcedure
    .use(requirePermission({ settings: ["read"] }))
    .query(async ({ ctx }) => {
      const profiles = listProfiles();
      const statuses = [];

      for (const profile of profiles) {
        if (profile.profileId === "ksef") {
          // Fetch KSeF connection data from DB
          const connection =
            await prisma.integrationConnection.findFirst({
              where: {
                organizationId: ctx.organizationId,
                provider: "KSEF",
              },
              select: {
                status: true,
                configJson: true,
                lastSyncAt: true,
                lastSuccessAt: true,
                lastErrorAt: true,
                lastErrorMessage: true,
                connectedAt: true,
              },
            });

          let recentSyncStatuses: string[] = [];
          if (connection) {
            const recentSyncs =
              await prisma.integrationSyncLog.findMany({
                where: {
                  organizationId: ctx.organizationId,
                  integrationConnection: {
                    provider: "KSEF",
                  },
                },
                orderBy: { startedAt: "desc" },
                take: 10,
                select: { status: true },
              });
            recentSyncStatuses = recentSyncs.map((s) => s.status);
          }

          statuses.push(
            computeKsefComplianceStatus(
              connection
                ? {
                    ...connection,
                    configJson: (connection.configJson as Record<
                      string,
                      unknown
                    >) ?? {},
                    recentSyncStatuses,
                  }
                : null,
            ),
          );
        } else {
          // Generic: delegate to profile
          statuses.push(
            await profile.getComplianceStatus(ctx.organizationId),
          );
        }
      }

      return { statuses };
    }),
});
