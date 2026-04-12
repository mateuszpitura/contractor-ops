import { PeppolOrchestrator } from "@contractor-ops/api/services/peppol-orchestrator";
import { prisma } from "@contractor-ops/db";
import { StorecoveAdapter } from "@contractor-ops/einvoice";
import { getCredentials } from "@contractor-ops/integrations";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// POST /api/peppol/outbound
// ---------------------------------------------------------------------------

/**
 * QStash callback endpoint for outbound Peppol invoice transmission.
 *
 * Called when an invoice is queued for Peppol delivery. Decrypts ASP
 * credentials, generates PINT-AE XML, and transmits via Storecove.
 *
 * Returns 200 even on business errors (don't trigger QStash retry for
 * validation failures — only infra errors should retry).
 */
async function handler(request: NextRequest) {
  const body = await request.json();
  const { organizationId, invoiceId, receiverParticipantId } = body as {
    organizationId: string;
    invoiceId: string;
    receiverParticipantId: string;
  };

  if (!(organizationId && invoiceId && receiverParticipantId)) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    // Load connection and decrypt credentials
    const connection = await prisma.integrationConnection.findFirst({
      where: {
        organizationId,
        provider: "PEPPOL",
        status: "CONNECTED",
      },
    });

    if (!connection) {
      console.error(`[peppol/outbound] No active Peppol connection for org ${organizationId}`);
      return NextResponse.json({ error: "No Peppol connection" });
    }

    const credentials = await getCredentials(connection.credentialsRef, "peppol");
    const config = (connection.configJson as Record<string, unknown>) ?? {};
    const environment = config.environment as string;

    const adapter = new StorecoveAdapter({
      apiKey: credentials.accessToken,
      baseUrl:
        environment === "production"
          ? "https://api.storecove.com/api/v2"
          : "https://api-sandbox.storecove.com/api/v2",
    });

    const orchestrator = new PeppolOrchestrator(adapter);
    const transmission = await orchestrator.submitOutboundInvoice({
      organizationId,
      invoiceId,
      receiverParticipantId,
    });

    return NextResponse.json({ processed: true, transmissionId: transmission.id });
  } catch (error) {
    console.error(
      `[peppol/outbound] Failed for org ${organizationId}, invoice ${invoiceId}:`,
      error,
    );
    // Return 200 to prevent QStash retry on business errors
    // The transmission record is already marked FAILED in the orchestrator
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Outbound processing failed",
    });
  }
}

export const POST = verifySignatureAppRouter(handler);
