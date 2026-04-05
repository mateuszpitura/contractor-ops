import { randomUUID } from "node:crypto";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { prisma } from "@contractor-ops/db";
import { returnRequestCreateSchema } from "@contractor-ops/validators";
import { router } from "../init.js";
import {
  portalProcedure,
  portalPublicProcedure,
} from "../middleware/portal-auth.js";
import {
  createMagicLinkToken,
  verifyMagicLinkToken,
  findContractorsByEmail,
  sendPortalMagicLink,
} from "../services/portal-magic-link.js";
import {
  createPortalSession,
  deletePortalSession,
} from "../services/portal-session.js";
import {
  createPresignedDownloadUrl,
  createPresignedUploadUrl,
  generateStorageKey,
} from "../services/r2.js";
import { createChangeRequest } from "../services/portal-change-request.js";
import { encryptBankAccount } from "../services/bank-account-crypto.js";
import { InPostClient } from "../services/courier/inpost-client.js";
import type { InPostClientConfig } from "../services/courier/inpost-client.js";
import { dispatch } from "../services/notification-service.js";
import * as E from "../errors.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Strips Prisma class prototype from query results, producing plain
 * JSON-serializable objects so that inferred tRPC router types do NOT
 * reference the generated Prisma client module (avoids TS2742).
 */
function plain<T>(data: T): T {
  return JSON.parse(JSON.stringify(data)) as T;
}

/**
 * Extract the portal_session cookie value from request headers.
 * Used by logout to identify the session to delete.
 */
function extractPortalToken(headers: Headers): string | null {
  const cookieHeader = headers.get("cookie");
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split("; ");
  for (const cookie of cookies) {
    if (cookie.startsWith("portal_session=")) {
      return cookie.slice("portal_session=".length);
    }
  }
  return null;
}

/**
 * Derive base URL from request headers for magic link emails.
 */
function deriveBaseUrl(headers: Headers): string {
  const origin = headers.get("origin");
  if (origin) return origin;

  const forwardedHost = headers.get("x-forwarded-host");
  const proto = headers.get("x-forwarded-proto") ?? "https";
  if (forwardedHost) return `${proto}://${forwardedHost}`;

  const host = headers.get("host");
  if (host) return `${proto}://${host}`;

  return "https://localhost:3000";
}

// ---------------------------------------------------------------------------
// Activity log types
// ---------------------------------------------------------------------------

export interface ActivityEntry {
  timestamp: Date;
  event: string;
  detail?: string | null;
}

// ---------------------------------------------------------------------------
// Portal router
// ---------------------------------------------------------------------------

export const portalRouter = router({
  // =========================================================================
  // AUTH ENDPOINTS (public -- no session required)
  // =========================================================================

  /**
   * Request a magic link email for portal login.
   * ALWAYS returns { success: true } regardless of whether the email
   * matches a contractor -- prevents email enumeration (D-16 / Pitfall 2).
   */
  requestMagicLink: portalPublicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ ctx, input }) => {
      const email = input.email.toLowerCase().trim();
      const contractors = await findContractorsByEmail(email);

      if (contractors.length > 0) {
        const { token } = await createMagicLinkToken(email);
        const baseUrl = deriveBaseUrl(ctx.headers);
        await sendPortalMagicLink({ email, token, baseUrl });
      }

      return { success: true as const };
    }),

  /**
   * Verify a magic link token and either create a session (single org)
   * or return org picker data (multi-org).
   */
  verifyMagicLink: portalPublicProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const result = await verifyMagicLinkToken(input.token);

      if (!result) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: E.PORTAL_INVALID_LINK,
        });
      }

      const contractors = await findContractorsByEmail(result.email);

      if (contractors.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // Single org -- auto-create session
      if (contractors.length === 1) {
        const c = contractors[0]!;
        const ipAddress =
          ctx.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined;
        const userAgent = ctx.headers.get("user-agent") ?? undefined;

        const session = await createPortalSession({
          contractorId: c.id,
          organizationId: c.organizationId,
          email: result.email,
          ipAddress,
          userAgent,
        });

        return plain({
          session: { rawToken: session.rawToken, expiresAt: session.expiresAt },
          orgs: null,
          needsOrgPicker: false as const,
        });
      }

      // Multi-org -- create a short-lived verification nonce so selectOrg
      // can prove the email was actually verified (prevents IDOR).
      const { token: verificationNonce } = await createMagicLinkToken(result.email);

      return plain({
        session: null,
        orgs: contractors.map((c) => ({
          contractorId: c.id,
          organizationId: c.organizationId,
          orgName: c.organization.name,
          orgLogo: c.organization.logo,
        })),
        needsOrgPicker: true as const,
        email: result.email,
        verificationNonce,
      });
    }),

  /**
   * Select an organization for multi-org contractors after verification.
   */
  selectOrg: portalPublicProcedure
    .input(
      z.object({
        verificationNonce: z.string().min(1, "Verification token required"),
        contractorId: z.string(),
        organizationId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the nonce to prove email was verified via magic link.
      // This prevents IDOR — the client can't just guess email + IDs.
      const verification = await verifyMagicLinkToken(input.verificationNonce);

      if (!verification) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: E.PORTAL_INVALID_VERIFICATION,
        });
      }

      const email = verification.email.toLowerCase().trim();

      // Verify contractor exists and matches the verified email
      const contractor = await prisma.contractor.findFirst({
        where: {
          id: input.contractorId,
          organizationId: input.organizationId,
          email,
          status: "ACTIVE",
          deletedAt: null,
        },
      });

      if (!contractor) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: E.CONTRACTOR_NOT_FOUND,
        });
      }

      const ipAddress =
        ctx.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined;
      const userAgent = ctx.headers.get("user-agent") ?? undefined;

      const session = await createPortalSession({
        contractorId: input.contractorId,
        organizationId: input.organizationId,
        email,
        ipAddress,
        userAgent,
      });

      return plain({ rawToken: session.rawToken, expiresAt: session.expiresAt });
    }),

  /**
   * Logout -- delete the current portal session.
   */
  logout: portalProcedure.mutation(async ({ ctx }) => {
    const rawToken = extractPortalToken(ctx.headers);
    if (rawToken) {
      await deletePortalSession(rawToken);
    }
    return { success: true as const };
  }),

  // =========================================================================
  // READ ENDPOINTS (authenticated -- double-scoped: org via tenantStore + contractorId)
  // =========================================================================

  /**
   * Dashboard overview: active contracts, pending invoices, recent payments,
   * upcoming deadline, recent activity.
   */
  overview: portalProcedure.query(async ({ ctx }) => {
    const contractorId = ctx.contractorId;

    // Active contracts count
    const activeContracts = await prisma.contract.count({
      where: {
        contractorId,
        status: { in: ["ACTIVE", "EXPIRING"] },
      },
    });

    // Pending invoices count
    const pendingInvoices = await prisma.invoice.count({
      where: {
        contractorId,
        status: { in: ["RECEIVED", "UNDER_REVIEW", "APPROVAL_PENDING"] },
        deletedAt: null,
      },
    });

    // Recent payments (last 90 days)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const recentPaidInvoices = await prisma.invoice.findMany({
      where: {
        contractorId,
        paymentStatus: "PAID",
        paidAt: { gte: ninetyDaysAgo },
        deletedAt: null,
      },
      select: { totalGrosze: true, currency: true },
    });

    const recentPaymentsGrosze = recentPaidInvoices.reduce(
      (sum, inv) => sum + inv.totalGrosze,
      0,
    );
    const recentPaymentsCurrency =
      recentPaidInvoices[0]?.currency ?? "PLN";

    // Upcoming deadline: earliest due date from unpaid invoices or earliest end date from expiring contracts
    const nextUnpaidInvoice = await prisma.invoice.findFirst({
      where: {
        contractorId,
        paymentStatus: { not: "PAID" },
        deletedAt: null,
      },
      orderBy: { dueDate: "asc" },
      select: { dueDate: true },
    });

    const nextExpiringContract = await prisma.contract.findFirst({
      where: {
        contractorId,
        status: "EXPIRING",
        endDate: { not: null },
      },
      orderBy: { endDate: "asc" },
      select: { endDate: true },
    });

    let upcomingDeadline: Date | null = null;
    const candidates: Date[] = [];
    if (nextUnpaidInvoice?.dueDate) candidates.push(nextUnpaidInvoice.dueDate);
    if (nextExpiringContract?.endDate)
      candidates.push(nextExpiringContract.endDate);
    if (candidates.length > 0) {
      upcomingDeadline = candidates.sort(
        (a, b) => a.getTime() - b.getTime(),
      )[0]!;
    }

    // Recent activity: last 5 invoices with their status-derived events
    const recentInvoices = await prisma.invoice.findMany({
      where: { contractorId, deletedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: {
        id: true,
        invoiceNumber: true,
        receivedAt: true,
        reviewedAt: true,
        approvedAt: true,
        paidAt: true,
        rejectedAt: true,
        rejectionReason: true,
      },
    });

    const recentActivity: ActivityEntry[] = [];
    for (const inv of recentInvoices) {
      // Pick the most recent event for each invoice
      const events: { ts: Date; event: string; detail?: string | null }[] = [];
      if (inv.paidAt)
        events.push({ ts: inv.paidAt, event: `Invoice ${inv.invoiceNumber} - Payment completed` });
      if (inv.rejectedAt)
        events.push({
          ts: inv.rejectedAt,
          event: `Invoice ${inv.invoiceNumber} - Invoice rejected`,
          detail: inv.rejectionReason,
        });
      if (inv.approvedAt)
        events.push({ ts: inv.approvedAt, event: `Invoice ${inv.invoiceNumber} - Invoice approved` });
      if (inv.reviewedAt)
        events.push({ ts: inv.reviewedAt, event: `Invoice ${inv.invoiceNumber} - Under review` });
      if (inv.receivedAt)
        events.push({
          ts: inv.receivedAt,
          event: `Invoice ${inv.invoiceNumber} - Invoice submitted`,
        });

      // Take the most recent event per invoice
      if (events.length > 0) {
        events.sort((a, b) => b.ts.getTime() - a.ts.getTime());
        const latest = events[0]!;
        recentActivity.push({
          timestamp: latest.ts,
          event: latest.event,
          detail: latest.detail,
        });
      }
    }

    return plain({
      activeContracts,
      pendingInvoices,
      recentPaymentsGrosze,
      recentPaymentsCurrency,
      upcomingDeadline,
      recentActivity,
    });
  }),

  /**
   * List contractor's contracts (ACTIVE, EXPIRING, EXPIRED only).
   * Excludes internal fields per D-11 / Pitfall 3.
   */
  listContracts: portalProcedure.query(async ({ ctx }) => {
    const contracts = await prisma.contract.findMany({
      where: {
        contractorId: ctx.contractorId,
        status: { in: ["ACTIVE", "EXPIRING", "EXPIRED"] },
      },
      select: {
        id: true,
        contractNumber: true,
        title: true,
        type: true,
        status: true,
        startDate: true,
        endDate: true,
        currency: true,
        billingModel: true,
        rateType: true,
        rateValueGrosze: true,
      },
      orderBy: { startDate: "desc" },
    });

    return plain(contracts);
  }),

  /**
   * Get contract detail with attached documents and download URLs.
   * Excludes internal fields. Generates presigned download URLs for documents.
   */
  getContract: portalProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const contract = await prisma.contract.findFirst({
        where: { id: input.id, contractorId: ctx.contractorId },
        select: {
          id: true,
          contractNumber: true,
          title: true,
          type: true,
          status: true,
          startDate: true,
          endDate: true,
          currency: true,
          billingModel: true,
          rateType: true,
          rateValueGrosze: true,
          paymentTermsDays: true,
          autoRenewal: true,
          noticePeriodDays: true,
          ratePeriods: {
            select: {
              rateType: true,
              rateValueGrosze: true,
              currency: true,
              validFrom: true,
              validTo: true,
            },
          },
        },
      });

      if (!contract) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // Fetch attached documents via DocumentLink
      const docLinks = await prisma.documentLink.findMany({
        where: { entityType: "CONTRACT", entityId: input.id },
        include: {
          document: {
            select: {
              id: true,
              originalFileName: true,
              mimeType: true,
              fileSizeBytes: true,
              documentType: true,
              storageKey: true,
            },
          },
        },
      });

      const documents = await Promise.all(
        docLinks.map(async (link) => {
          const downloadUrl = await createPresignedDownloadUrl(
            link.document.storageKey,
          );
          return {
            id: link.document.id,
            name: link.document.originalFileName,
            type: link.document.documentType,
            mimeType: link.document.mimeType,
            sizeBytes: Number(link.document.fileSizeBytes),
            downloadUrl,
          };
        }),
      );

      return plain({ ...contract, documents });
    }),

  /**
   * List contractor's invoices with status info.
   */
  listInvoices: portalProcedure.query(async ({ ctx }) => {
    const invoices = await prisma.invoice.findMany({
      where: { contractorId: ctx.contractorId, deletedAt: null },
      select: {
        id: true,
        invoiceNumber: true,
        contractId: true,
        totalGrosze: true,
        currency: true,
        issueDate: true,
        receivedAt: true,
        status: true,
        matchStatus: true,
        approvalStatus: true,
        paymentStatus: true,
        paidAt: true,
        contract: { select: { title: true } },
      },
      orderBy: { receivedAt: "desc" },
    });

    return plain(invoices);
  }),

  /**
   * Get invoice detail with timeline, attached files, and payment info.
   * Excludes internal data (batch IDs, reviewer names, cost centers) per D-11/D-12.
   */
  getInvoice: portalProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const invoice = await prisma.invoice.findFirst({
        where: { id: input.id, contractorId: ctx.contractorId, deletedAt: null },
        select: {
          id: true,
          invoiceNumber: true,
          issueDate: true,
          dueDate: true,
          subtotalGrosze: true,
          totalGrosze: true,
          currency: true,
          status: true,
          approvalStatus: true,
          paymentStatus: true,
          receivedAt: true,
          reviewedAt: true,
          approvedAt: true,
          paidAt: true,
          rejectedAt: true,
          rejectionReason: true,
          contract: { select: { id: true, title: true } },
          files: {
            include: {
              document: {
                select: { id: true, originalFileName: true, storageKey: true },
              },
            },
          },
        },
      });

      if (!invoice) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // Generate download URLs for attached files
      const files = await Promise.all(
        invoice.files.map(async (f) => {
          const downloadUrl = await createPresignedDownloadUrl(
            f.document.storageKey,
          );
          return {
            id: f.document.id,
            name: f.document.originalFileName,
            downloadUrl,
          };
        }),
      );

      // Payment info (date + amount only, no batch IDs per D-12)
      const paymentItem = await prisma.paymentRunItem.findFirst({
        where: {
          invoiceId: input.id,
          contractorId: ctx.contractorId,
          status: "PAID",
        },
        select: {
          markedPaidAt: true,
          amountGrosze: true,
          currency: true,
        },
      });

      const payment = paymentItem
        ? {
            paidAt: paymentItem.markedPaidAt,
            amountGrosze: paymentItem.amountGrosze,
            currency: paymentItem.currency,
          }
        : null;

      // Build activity log from timestamps (contractor-visible events only)
      const activityLog: ActivityEntry[] = [];

      if (invoice.receivedAt) {
        activityLog.push({
          timestamp: invoice.receivedAt,
          event: "Invoice submitted",
        });
      }
      if (invoice.reviewedAt) {
        activityLog.push({
          timestamp: invoice.reviewedAt,
          event: "Under review",
        });
      }
      if (invoice.approvedAt) {
        activityLog.push({
          timestamp: invoice.approvedAt,
          event: "Invoice approved",
        });
      }
      if (invoice.rejectedAt) {
        activityLog.push({
          timestamp: invoice.rejectedAt,
          event: "Invoice rejected",
          detail: invoice.rejectionReason,
        });
      }
      if (invoice.paidAt) {
        activityLog.push({
          timestamp: invoice.paidAt,
          event: "Payment completed",
        });
      }

      // Sort chronologically
      activityLog.sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
      );

      // Exclude internal data from response
      const {
        files: _files,
        receivedAt: _receivedAt,
        reviewedAt: _reviewedAt,
        approvedAt: _approvedAt,
        paidAt: _paidAt,
        rejectedAt: _rejectedAt,
        rejectionReason: _rejectionReason,
        ...invoiceData
      } = invoice;

      return plain({
        ...invoiceData,
        files,
        payment,
        activityLog,
      });
    }),

  /**
   * List documents linked to this contractor and their contracts.
   * Generates presigned download URLs. Excludes storageKey.
   */
  listDocuments: portalProcedure.query(async ({ ctx }) => {
    // Documents linked directly to the contractor
    const contractorDocLinks = await prisma.documentLink.findMany({
      where: {
        entityType: "CONTRACTOR",
        entityId: ctx.contractorId,
      },
      include: {
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
      },
    });

    // Documents linked to contractor's contracts
    const contractIds = await prisma.contract.findMany({
      where: { contractorId: ctx.contractorId },
      select: { id: true },
    });
    const contractIdList = contractIds.map((c) => c.id);

    const contractDocLinks =
      contractIdList.length > 0
        ? await prisma.documentLink.findMany({
            where: {
              entityType: "CONTRACT",
              entityId: { in: contractIdList },
            },
            include: {
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
            },
          })
        : [];

    // Deduplicate by document ID
    const seenIds = new Set<string>();
    const allLinks = [...contractorDocLinks, ...contractDocLinks];

    const documents = await Promise.all(
      allLinks
        .filter((link) => {
          if (seenIds.has(link.document.id)) return false;
          seenIds.add(link.document.id);
          return true;
        })
        .map(async (link) => {
          const downloadUrl = await createPresignedDownloadUrl(
            link.document.storageKey,
          );
          return {
            id: link.document.id,
            name: link.document.originalFileName,
            type: link.document.documentType,
            mimeType: link.document.mimeType,
            sizeBytes: Number(link.document.fileSizeBytes),
            addedAt: link.document.createdAt,
            downloadUrl,
          };
        }),
    );

    return plain(documents);
  }),

  /**
   * List completed payments for this contractor.
   * Returns only paidAt + amount + currency + invoiceNumber (no batch IDs per D-12).
   */
  listPayments: portalProcedure.query(async ({ ctx }) => {
    const items = await prisma.paymentRunItem.findMany({
      where: {
        contractorId: ctx.contractorId,
        status: "PAID",
      },
      select: {
        id: true,
        invoiceId: true,
        amountGrosze: true,
        currency: true,
        markedPaidAt: true,
        invoice: { select: { invoiceNumber: true } },
      },
      orderBy: { markedPaidAt: "desc" },
    });

    return plain(
      items.map((item) => ({
        id: item.id,
        invoiceNumber: item.invoice.invoiceNumber,
        amountGrosze: item.amountGrosze,
        currency: item.currency,
        paidAt: item.markedPaidAt,
      })),
    );
  }),

  // =========================================================================
  // WRITE ENDPOINTS (authenticated)
  // =========================================================================

  /**
   * Get a presigned upload URL for invoice PDF upload.
   * Only PDF files are accepted.
   */
  getUploadUrl: portalProcedure
    .input(
      z.object({
        filename: z.string(),
        contentType: z
          .string()
          .refine((ct) => ct === "application/pdf", "Only PDF files"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const docId = randomUUID();
      const key = generateStorageKey(ctx.organizationId, docId, input.filename);
      const uploadUrl = await createPresignedUploadUrl(key, input.contentType);

      return { uploadUrl, documentId: docId, storageKey: key };
    }),

  /**
   * Submit an invoice through the portal.
   * Creates invoice with source PORTAL and status RECEIVED.
   * Verifies contract belongs to this contractor and is ACTIVE.
   */
  submitInvoice: portalProcedure
    .input(
      z.object({
        contractId: z.string(),
        invoiceNumber: z.string().min(1).max(100),
        issueDate: z.date(),
        dueDate: z.date(),
        netAmountGrosze: z.number().int().positive(),
        grossAmountGrosze: z.number().int().positive(),
        documentId: z.string(),
        storageKey: z.string(),
        originalFileName: z.string(),
        fileSizeBytes: z.number().int().positive(),
        checksumSha256: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify contract belongs to this contractor and is ACTIVE
      const contract = await prisma.contract.findFirst({
        where: {
          id: input.contractId,
          contractorId: ctx.contractorId,
          status: "ACTIVE",
        },
      });

      if (!contract) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: E.PORTAL_CONTRACT_NOT_FOUND,
        });
      }

      // Create document record for the uploaded PDF
      await prisma.document.create({
        data: {
          id: input.documentId,
          organizationId: ctx.organizationId,
          storageKey: input.storageKey,
          originalFileName: input.originalFileName,
          mimeType: "application/pdf",
          fileSizeBytes: input.fileSizeBytes,
          documentType: "INVOICE",
          source: "USER_UPLOAD",
          checksumSha256: input.checksumSha256 ?? "",
        },
      });

      // Create invoice with PORTAL source
      const invoice = await prisma.invoice.create({
        data: {
          organizationId: ctx.organizationId,
          contractorId: ctx.contractorId,
          contractId: input.contractId,
          invoiceNumber: input.invoiceNumber,
          source: "PORTAL",
          issueDate: input.issueDate,
          dueDate: input.dueDate,
          subtotalGrosze: input.netAmountGrosze,
          totalGrosze: input.grossAmountGrosze,
          amountToPayGrosze: input.grossAmountGrosze,
          currency: contract.currency,
          status: "RECEIVED",
          matchStatus: "UNMATCHED",
          approvalStatus: "NOT_STARTED",
          paymentStatus: "NOT_READY",
          submittedByEmail: ctx.portalSession.email,
        },
      });

      // Link document to invoice
      await prisma.invoiceFile.create({
        data: {
          organizationId: ctx.organizationId,
          invoiceId: invoice.id,
          documentId: input.documentId,
          role: "SOURCE_ORIGINAL",
        },
      });

      return plain({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
      });
    }),

  /**
   * Get active contracts for invoice form dropdown.
   */
  getActiveContracts: portalProcedure.query(async ({ ctx }) => {
    const contracts = await prisma.contract.findMany({
      where: { contractorId: ctx.contractorId, status: "ACTIVE" },
      select: {
        id: true,
        title: true,
        currency: true,
        rateValueGrosze: true,
        rateType: true,
        billingModel: true,
      },
    });

    return plain(contracts);
  }),

  /**
   * Get current session info for portal layout (contractor + org info).
   */
  getSession: portalProcedure.query(async ({ ctx }) => {
    // Fetch organization separately since validatePortalSession only includes contractor
    const org = await prisma.organization.findUnique({
      where: { id: ctx.organizationId },
      select: { id: true, name: true, logo: true },
    });

    return plain({
      contractor: {
        id: ctx.contractor.id,
        displayName: ctx.contractor.displayName,
        email: ctx.portalSession.email,
      },
      organization: {
        id: ctx.organizationId,
        name: org?.name ?? "",
        logo: org?.logo ?? null,
      },
    });
  }),

  // =========================================================================
  // SELF-SERVICE ENDPOINTS (authenticated)
  // =========================================================================

  /**
   * Get contractor profile with contact info, billing profile (masked),
   * and any pending change request.
   * SECURITY: Never exposes bankAccountEncrypted.
   */
  getProfile: portalProcedure.query(async ({ ctx }) => {
    const contractor = await prisma.contractor.findUnique({
      where: { id: ctx.contractorId },
      select: {
        id: true,
        displayName: true,
        email: true,
        phone: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        postalCode: true,
        countryCode: true,
        taxId: true,
      },
    });

    if (!contractor) {
      throw new TRPCError({ code: "NOT_FOUND" });
    }

    // Get default billing profile — NEVER select bankAccountEncrypted
    const billingProfile = await prisma.contractorBillingProfile.findFirst({
      where: {
        contractorId: ctx.contractorId,
        organizationId: ctx.organizationId,
        isDefault: true,
      },
      select: {
        id: true,
        bankAccountMasked: true,
        bankName: true,
        swiftBic: true,
        taxId: true,
      },
    });

    // Check for pending change request
    const pendingChangeRequest =
      await prisma.contractorChangeRequest.findFirst({
        where: {
          contractorId: ctx.contractorId,
          organizationId: ctx.organizationId,
          status: "PENDING",
        },
        select: {
          id: true,
          requestedChanges: true,
          createdAt: true,
        },
      });

    return plain({
      ...contractor,
      billingProfile,
      pendingChangeRequest,
    });
  }),

  /**
   * Update contractor contact info (takes effect immediately per D-01).
   * Contact fields only — financial fields require approval workflow.
   */
  updateContactInfo: portalProcedure
    .input(
      z.object({
        displayName: z.string().min(1).max(200),
        phone: z.string().max(50).optional().nullable(),
        addressLine1: z.string().max(200).optional().nullable(),
        addressLine2: z.string().max(200).optional().nullable(),
        city: z.string().max(100).optional().nullable(),
        postalCode: z.string().max(20).optional().nullable(),
        countryCode: z.string().length(2).optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const updated = await prisma.contractor.update({
        where: { id: ctx.contractorId },
        data: {
          displayName: input.displayName,
          phone: input.phone,
          addressLine1: input.addressLine1,
          addressLine2: input.addressLine2,
          city: input.city,
          postalCode: input.postalCode,
          countryCode: input.countryCode ?? undefined,
        },
        select: {
          id: true,
          displayName: true,
          phone: true,
          addressLine1: true,
          addressLine2: true,
          city: true,
          postalCode: true,
          countryCode: true,
        },
      });

      return plain(updated);
    }),

  /**
   * Submit a financial change request (bank account, SWIFT, tax ID).
   * Creates a pending ContractorChangeRequest — requires admin approval per D-01.
   */
  submitFinancialChangeRequest: portalProcedure
    .input(
      z.object({
        bankAccountNumber: z.string().optional(),
        bankName: z.string().optional(),
        swiftBic: z.string().max(11).optional(),
        taxId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Read current billing profile values for previousValues snapshot
      const currentProfile =
        await prisma.contractorBillingProfile.findFirst({
          where: {
            contractorId: ctx.contractorId,
            organizationId: ctx.organizationId,
            isDefault: true,
          },
          select: {
            bankAccountMasked: true,
            bankName: true,
            swiftBic: true,
            taxId: true,
          },
        });

      const previousValues: Record<string, unknown> = {
        bankAccountMasked: currentProfile?.bankAccountMasked ?? null,
        bankName: currentProfile?.bankName ?? null,
        swiftBic: currentProfile?.swiftBic ?? null,
        taxId: currentProfile?.taxId ?? null,
      };

      // Build requested changes — encrypt bank account for storage
      const requestedChanges: Record<string, unknown> = {};

      if (input.bankAccountNumber !== undefined) {
        const cleaned = input.bankAccountNumber.replace(/\s/g, "");
        requestedChanges.bankAccountEncrypted = encryptBankAccount(cleaned);
        requestedChanges.bankAccountMasked = `****${cleaned.slice(-4)}`;
      }
      if (input.bankName !== undefined) {
        requestedChanges.bankName = input.bankName;
      }
      if (input.swiftBic !== undefined) {
        requestedChanges.swiftBic = input.swiftBic;
      }
      if (input.taxId !== undefined) {
        requestedChanges.taxId = input.taxId;
      }

      if (Object.keys(requestedChanges).length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: E.PORTAL_NO_CHANGES,
        });
      }

      const changeRequest = await createChangeRequest(
        ctx.contractorId,
        ctx.organizationId,
        requestedChanges,
        previousValues,
      );

      return plain({
        id: changeRequest.id,
        status: changeRequest.status,
        createdAt: changeRequest.createdAt,
      });
    }),

  /**
   * Get notification preferences for all 5 categories.
   * Returns defaults (emailEnabled: true) for any missing categories per D-06.
   */
  getNotificationPreferences: portalProcedure.query(async ({ ctx }) => {
    const CATEGORIES = [
      "INVOICE_UPDATES",
      "PAYMENT_CONFIRMATIONS",
      "CONTRACT_CHANGES",
      "DOCUMENT_UPLOADS",
      "SECURITY_ALERTS",
    ] as const;

    const existing =
      await prisma.contractorNotificationPreference.findMany({
        where: {
          contractorId: ctx.contractorId,
          organizationId: ctx.organizationId,
        },
        select: {
          category: true,
          emailEnabled: true,
        },
      });

    const existingMap = new Map(
      existing.map((p) => [p.category, p.emailEnabled]),
    );

    // Return all 5 categories, defaulting to true for missing rows
    const preferences = CATEGORIES.map((category) => ({
      category,
      emailEnabled: existingMap.get(category) ?? true,
    }));

    return plain(preferences);
  }),

  /**
   * Update a single notification preference category.
   * SECURITY_ALERTS cannot be disabled per D-07.
   */
  updateNotificationPreference: portalProcedure
    .input(
      z.object({
        category: z.enum([
          "INVOICE_UPDATES",
          "PAYMENT_CONFIRMATIONS",
          "CONTRACT_CHANGES",
          "DOCUMENT_UPLOADS",
          "SECURITY_ALERTS",
        ]),
        emailEnabled: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Security alerts cannot be disabled
      if (input.category === "SECURITY_ALERTS" && !input.emailEnabled) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: E.PORTAL_SECURITY_ALERTS_LOCKED,
        });
      }

      const preference =
        await prisma.contractorNotificationPreference.upsert({
          where: {
            contractorId_category: {
              contractorId: ctx.contractorId,
              category: input.category,
            },
          },
          create: {
            contractorId: ctx.contractorId,
            organizationId: ctx.organizationId,
            category: input.category,
            emailEnabled: input.emailEnabled,
          },
          update: {
            emailEnabled: input.emailEnabled,
          },
          select: {
            category: true,
            emailEnabled: true,
          },
        });

      return plain(preference);
    }),

  // =========================================================================
  // EQUIPMENT ENDPOINTS (authenticated)
  // =========================================================================

  /**
   * List equipment assigned to the authenticated contractor.
   * Returns active assignments with equipment details and latest shipment.
   */
  listEquipment: portalProcedure.query(async ({ ctx }) => {
    const assignments = await prisma.equipmentAssignment.findMany({
      where: {
        contractorId: ctx.contractorId,
        organizationId: ctx.organizationId,
        unassignedAt: null,
      },
      include: {
        equipment: {
          include: {
            shipments: {
              orderBy: { createdAt: "desc" as const },
              take: 1,
              select: {
                id: true,
                direction: true,
                carrier: true,
                trackingNumber: true,
                currentStatus: true,
                expectedDeliveryAt: true,
              },
            },
          },
        },
      },
    });

    const items = assignments.map((a) => ({
      assignmentId: a.id,
      assignedAt: a.assignedAt,
      equipment: {
        id: a.equipment.id,
        name: a.equipment.name,
        serialNumber: a.equipment.serialNumber,
        type: a.equipment.type,
        status: a.equipment.status,
      },
      latestShipment: a.equipment.shipments[0] ?? null,
    }));

    return plain(items);
  }),

  /**
   * Get the most recent active return request for the authenticated contractor.
   * Returns null if no active return exists.
   */
  getReturnStatus: portalProcedure.query(async ({ ctx }) => {
    const returnRequest = await prisma.returnRequest.findFirst({
      where: {
        contractorId: ctx.contractorId,
        organizationId: ctx.organizationId,
        status: {
          notIn: ["CANCELLED", "REJECTED"],
        },
      },
      orderBy: { createdAt: "desc" },
      include: {
        shipment: {
          select: {
            id: true,
            trackingNumber: true,
            currentStatus: true,
            carrier: true,
            labelUrl: true,
          },
        },
      },
    });

    return returnRequest ? plain(returnRequest) : null;
  }),

  /**
   * Request a return of all assigned equipment.
   * Creates a ReturnRequest with PENDING_APPROVAL status (D-09: admin must approve).
   */
  requestReturn: portalProcedure
    .input(returnRequestCreateSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify contractor has assigned equipment
      const assignments = await prisma.equipmentAssignment.findMany({
        where: {
          contractorId: ctx.contractorId,
          organizationId: ctx.organizationId,
          unassignedAt: null,
        },
        include: {
          equipment: { select: { id: true, name: true, status: true } },
        },
      });

      if (assignments.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "NO_EQUIPMENT_ASSIGNED",
        });
      }

      // Verify no existing active return request
      const existingReturn = await prisma.returnRequest.findFirst({
        where: {
          contractorId: ctx.contractorId,
          organizationId: ctx.organizationId,
          status: {
            in: ["PENDING_APPROVAL", "APPROVED", "SHIPMENT_CREATED"],
          },
        },
      });

      if (existingReturn) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "RETURN_ALREADY_PENDING",
        });
      }

      const result = await prisma.$transaction(async (tx) => {
        // Create return request
        const returnRequest = await tx.returnRequest.create({
          data: {
            organizationId: ctx.organizationId,
            contractorId: ctx.contractorId,
            status: "PENDING_APPROVAL",
            targetPointId: input.targetPointId,
            targetPointName: input.targetPointName,
            targetPointAddress: input.targetPointAddress,
          },
        });

        // Update all assigned equipment to RETURN_REQUESTED
        const equipmentIds = assignments.map((a) => a.equipment.id);
        await tx.equipment.updateMany({
          where: {
            id: { in: equipmentIds },
            organizationId: ctx.organizationId,
          },
          data: { status: "RETURN_REQUESTED" },
        });

        // Audit log
        await tx.auditLog.create({
          data: {
            organizationId: ctx.organizationId,
            actorType: "CONTRACTOR",
            actorId: ctx.contractorId,
            actorName: ctx.contractor?.email ?? "contractor",
            action: "returnRequest.create",
            resourceType: "RETURN_REQUEST",
            resourceId: returnRequest.id,
            newValuesJson: {
              targetPointId: input.targetPointId,
              targetPointName: input.targetPointName,
              equipmentCount: equipmentIds.length,
            },
          },
        });

        return returnRequest;
      });

      // Fire-and-forget: notify admins about pending return request
      void dispatch({
        organizationId: ctx.organizationId,
        type: "EQUIPMENT_RETURN_REQUESTED",
        recipientUserIds: [],
        title: "New equipment return request",
        body: `Contractor ${ctx.contractor?.email ?? "unknown"} requested equipment return`,
        entityType: "RETURN_REQUEST",
        entityId: result.id,
        metadata: {
          contractorId: ctx.contractorId,
          targetPoint: input.targetPointName,
        },
      }).catch((err) =>
        console.error("[portal] Failed to dispatch return request notification:", err),
      );

      return plain(result);
    }),

  /**
   * Cancel a pending return request.
   * Only allowed when status is PENDING_APPROVAL.
   */
  cancelReturn: portalProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const returnRequest = await prisma.returnRequest.findFirst({
        where: {
          id: input.id,
          contractorId: ctx.contractorId,
          organizationId: ctx.organizationId,
        },
      });

      if (!returnRequest) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "RETURN_REQUEST_NOT_FOUND",
        });
      }

      if (returnRequest.status !== "PENDING_APPROVAL") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "RETURN_CANNOT_CANCEL",
        });
      }

      const result = await prisma.$transaction(async (tx) => {
        const updated = await tx.returnRequest.update({
          where: { id: input.id },
          data: { status: "CANCELLED" },
        });

        // Revert equipment statuses from RETURN_REQUESTED back to ASSIGNED
        await tx.equipment.updateMany({
          where: {
            organizationId: ctx.organizationId,
            status: "RETURN_REQUESTED",
            assignments: {
              some: {
                contractorId: ctx.contractorId,
                unassignedAt: null,
              },
            },
          },
          data: { status: "ASSIGNED" },
        });

        // Audit log
        await tx.auditLog.create({
          data: {
            organizationId: ctx.organizationId,
            actorType: "CONTRACTOR",
            actorId: ctx.contractorId,
            actorName: ctx.contractor?.email ?? "contractor",
            action: "returnRequest.cancel",
            resourceType: "RETURN_REQUEST",
            resourceId: input.id,
            newValuesJson: { status: "CANCELLED" },
          },
        });

        return updated;
      });

      return plain(result);
    }),

  /**
   * Get the return shipping label for an approved return request.
   * Only available when status is SHIPMENT_CREATED and shipment exists.
   */
  getReturnLabel: portalProcedure
    .input(z.object({ returnRequestId: z.string() }))
    .query(async ({ ctx, input }) => {
      const returnRequest = await prisma.returnRequest.findFirst({
        where: {
          id: input.returnRequestId,
          contractorId: ctx.contractorId,
          organizationId: ctx.organizationId,
        },
      });

      if (!returnRequest) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "RETURN_REQUEST_NOT_FOUND",
        });
      }

      if (returnRequest.status !== "SHIPMENT_CREATED" || !returnRequest.shipmentId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "RETURN_LABEL_NOT_AVAILABLE",
        });
      }

      const shipment = await prisma.shipment.findFirst({
        where: {
          id: returnRequest.shipmentId,
          organizationId: ctx.organizationId,
        },
      });

      if (!shipment || shipment.carrier !== "InPost" || !shipment.externalId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "SHIPMENT_NO_INPOST_LABEL",
        });
      }

      const courierConfig = await prisma.courierConfig.findUnique({
        where: {
          organizationId_carrier: {
            organizationId: ctx.organizationId,
            carrier: "inpost",
          },
        },
      });

      if (!courierConfig) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "COURIER_CONFIG_NOT_FOUND",
        });
      }

      const configJson = courierConfig.configJson as unknown as InPostClientConfig;
      const client = new InPostClient(configJson);

      const labelBuffer = await client.getLabel(shipment.externalId, "pdf");

      return {
        data: labelBuffer.toString("base64"),
        contentType: "application/pdf",
        filename: `return-label-${shipment.trackingNumber ?? shipment.externalId}.pdf`,
      };
    }),
});
