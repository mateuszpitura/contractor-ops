import { prisma } from "@contractor-ops/db";
import {
  KsefApiClient,
  parseFa3Xml,
  mapKsefToInvoiceFields,
  decryptCredentials,
} from "@contractor-ops/integrations";
import { ksefConnectionConfigSchema } from "@contractor-ops/validators";
import {
  computeDuplicateCheckHash,
  runAutoMatch,
} from "./invoice-matching.js";
import {
  checkCrossSourceDuplicate,
  linkDuplicateInvoices,
} from "./ksef-duplicate-detection.js";
import { dispatch } from "./notification-service.js";

// ---------------------------------------------------------------------------
// KSeF Sync Orchestrator
// ---------------------------------------------------------------------------

/**
 * Processes a full KSeF sync cycle for an organization.
 *
 * Flow:
 * 1. Create sync log (STARTED)
 * 2. Decrypt credentials and parse config
 * 3. Authenticate with KSeF
 * 4. Query invoices by date range
 * 5. For each invoice: download XML, parse, create record, check duplicates, auto-match
 * 6. Update connection status
 * 7. Dispatch batch notification
 *
 * Uses IntegrationSyncLog for audit trail and IntegrationConnection for status tracking.
 */
export async function processKsefSync(params: {
  organizationId: string;
  connectionId: string;
}): Promise<{
  invoicesCreated: number;
  duplicatesFound: number;
  errors: string[];
}> {
  let invoicesCreated = 0;
  let duplicatesFound = 0;
  const errors: string[] = [];
  let client: KsefApiClient | null = null;

  // Create sync log
  const syncLog = await prisma.integrationSyncLog.create({
    data: {
      organizationId: params.organizationId,
      integrationConnectionId: params.connectionId,
      direction: "INBOUND",
      syncType: "ksef_invoice_fetch",
      status: "STARTED",
      startedAt: new Date(),
    },
  });

  try {
    // -----------------------------------------------------------------------
    // Step 1: Load connection and decrypt credentials
    // -----------------------------------------------------------------------

    const connection =
      await prisma.integrationConnection.findUniqueOrThrow({
        where: { id: params.connectionId },
      });

    if (connection.organizationId !== params.organizationId) {
      throw new Error(
        "Connection does not belong to the specified organization",
      );
    }

    const credentials = decryptCredentials(
      connection.credentialsRef,
      "ksef",
    );
    const config = ksefConnectionConfigSchema.parse(connection.configJson);

    // -----------------------------------------------------------------------
    // Step 2: Get organization NIP (per D-03)
    // -----------------------------------------------------------------------

    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: params.organizationId },
    });
    const settingsJson =
      (org.settingsJson as Record<string, unknown> | null) ?? {};
    const nip = settingsJson.taxId as string | undefined;

    if (!nip) {
      throw new Error(
        "Organization NIP not configured. Set it in Organization Settings.",
      );
    }

    // -----------------------------------------------------------------------
    // Step 3: Authenticate with KSeF
    // -----------------------------------------------------------------------

    client = new KsefApiClient(config.environment ?? "prod");

    if (config.authMethod === "certificate") {
      await client.authenticateWithCertificate(
        credentials.extra?.certificateBase64 as string,
        credentials.extra?.certificatePassword as string | undefined,
        nip,
      );
    } else {
      await client.authenticate(credentials.accessToken, nip);
    }

    // -----------------------------------------------------------------------
    // Step 4: Determine date range (last sync or 90 days for first sync)
    // -----------------------------------------------------------------------

    const dateFrom = connection.lastSuccessAt
      ? connection.lastSuccessAt.toISOString().split("T")[0]!
      : new Date(Date.now() - 90 * 24 * 3600 * 1000)
          .toISOString()
          .split("T")[0]!;
    const dateTo = new Date().toISOString().split("T")[0]!;

    // -----------------------------------------------------------------------
    // Step 5: Query invoices from KSeF
    // -----------------------------------------------------------------------

    const result = await client.queryInvoices(nip, dateFrom, dateTo);

    // -----------------------------------------------------------------------
    // Step 6: Process each invoice
    // -----------------------------------------------------------------------

    for (const metadata of result.invoiceMetadataList) {
      try {
        // Check if already fetched (by KSeF reference number)
        const alreadyExists = await prisma.invoice.findFirst({
          where: {
            organizationId: params.organizationId,
            externalInvoiceId: metadata.ksefReferenceNumber,
            source: "KSEF",
            deletedAt: null,
          },
          select: { id: true },
        });

        if (alreadyExists) {
          continue; // Skip already-fetched invoices
        }

        // Download XML
        const xml = await client.downloadInvoiceXml(
          metadata.ksefReferenceNumber,
        );

        // Parse FA(3) XML
        const parsed = parseFa3Xml(xml, metadata.ksefReferenceNumber);

        // Map to Invoice fields
        const { invoice: fields, lines } = mapKsefToInvoiceFields(parsed);

        // Compute duplicate check hash
        const hash = computeDuplicateCheckHash(
          fields.invoiceNumber,
          fields.sellerTaxId!,
          fields.totalGrosze,
        );

        // Check cross-source duplicate (per D-11)
        const dup = await checkCrossSourceDuplicate(
          prisma,
          params.organizationId,
          fields.invoiceNumber,
          fields.sellerTaxId!,
        );

        // Create Invoice record
        // dueDate is required by Prisma — fall back to issueDate + 14 days
        const dueDate =
          fields.dueDate ?? new Date(fields.issueDate.getTime() + 14 * 24 * 3600 * 1000);

        const invoice = await prisma.invoice.create({
          data: {
            ...fields,
            dueDate,
            organizationId: params.organizationId,
            duplicateCheckHash: hash,
            status: "RECEIVED",
            matchStatus: "UNMATCHED",
            approvalStatus: "NOT_STARTED",
            paymentStatus: "NOT_READY",
            lines: {
              create: lines.map((l) => ({
                ...l,
                organizationId: params.organizationId,
              })),
            },
          },
        });

        invoicesCreated++;

        // Link duplicates bidirectionally (per D-12)
        if (dup.isDuplicate && dup.existingInvoiceId) {
          await linkDuplicateInvoices(
            prisma,
            invoice.id,
            dup.existingInvoiceId,
          );
          duplicatesFound++;
        }

        // Run auto-match (per D-08)
        await runAutoMatch(prisma, params.organizationId, {
          id: invoice.id,
          sellerTaxId: fields.sellerTaxId,
          totalGrosze: fields.totalGrosze,
          currency: fields.currency,
          duplicateCheckHash: hash,
        });
      } catch (error) {
        const msg =
          error instanceof Error ? error.message : String(error);
        errors.push(
          `Failed to process invoice ${metadata.ksefReferenceNumber}: ${msg}`,
        );
      }
    }

    // -----------------------------------------------------------------------
    // Step 7: Update connection status
    // -----------------------------------------------------------------------

    const newStatus =
      errors.length > 0 && invoicesCreated === 0 ? "ERROR" : "CONNECTED";

    await prisma.integrationConnection.update({
      where: { id: params.connectionId },
      data: {
        lastSyncAt: new Date(),
        lastSuccessAt: new Date(),
        status: newStatus,
        ...(errors.length > 0
          ? {
              lastErrorAt: new Date(),
              lastErrorMessage: errors.join("; ").slice(0, 1000),
            }
          : {}),
      },
    });

    // -----------------------------------------------------------------------
    // Step 8: Update sync log
    // -----------------------------------------------------------------------

    await prisma.integrationSyncLog.update({
      where: { id: syncLog.id },
      data: {
        status: "SUCCESS",
        completedAt: new Date(),
        responsePayloadJson: {
          invoicesCreated,
          duplicatesFound,
          errors,
        },
      },
    });

    // -----------------------------------------------------------------------
    // Step 9: Dispatch batch notification (per D-10)
    // -----------------------------------------------------------------------

    if (invoicesCreated > 0) {
      // Find admin/finance users in the organization to notify
      const members = await prisma.member.findMany({
        where: {
          organizationId: params.organizationId,
          role: { in: ["owner", "admin", "finance_manager"] },
        },
        select: { userId: true },
      });

      const recipientUserIds = members.map((m) => m.userId);

      if (recipientUserIds.length > 0) {
        await dispatch({
          organizationId: params.organizationId,
          type: "KSEF_SYNC_COMPLETE",
          title: "KSeF Sync Complete",
          body: `${invoicesCreated} new invoice${invoicesCreated === 1 ? "" : "s"} fetched from KSeF`,
          entityType: "INVOICE",
          entityId: params.connectionId,
          recipientUserIds,
          metadata: {
            invoicesCreated,
            duplicatesFound,
            link: "/invoices?source=KSEF",
          },
        });
      }
    }

    return { invoicesCreated, duplicatesFound, errors };
  } catch (error) {
    // Update sync log to FAILED
    await prisma.integrationSyncLog.update({
      where: { id: syncLog.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        errorMessage:
          error instanceof Error ? error.message : String(error),
      },
    });

    // Update connection to ERROR
    await prisma.integrationConnection.update({
      where: { id: params.connectionId },
      data: {
        lastSyncAt: new Date(),
        lastErrorAt: new Date(),
        lastErrorMessage:
          error instanceof Error ? error.message : String(error),
        status: "ERROR",
      },
    });

    throw error;
  } finally {
    // Always terminate KSeF session
    if (client) {
      try {
        await client.terminateSession();
      } catch {
        // Swallow session termination errors
      }
    }
  }
}
