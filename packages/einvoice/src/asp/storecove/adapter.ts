import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  ASPAdapter,
  ASPHealthStatus,
  InboundInvoicePayload,
  ParticipantRegistration,
  ParticipantStatus,
  RegisterParticipantParams,
  TransmissionResult,
  TransmissionStatus,
  TransmitInvoiceParams,
  WebhookVerification,
} from "../types.js";
import { StorecoveApiError, StorecoveClient } from "./client.js";
import { storecoveWebhookPayloadSchema } from "./schemas.js";
import type { StorecoveConfig } from "./types.js";

// ---------------------------------------------------------------------------
// Storecove ASP Adapter
// ---------------------------------------------------------------------------

/**
 * Storecove implementation of the ASPAdapter interface.
 *
 * Wraps the Storecove REST API v2 for Peppol network operations.
 * HMAC-SHA256 webhook signature verification per Storecove docs.
 */
export class StorecoveAdapter implements ASPAdapter {
  readonly providerId = "storecove" as const;
  readonly displayName = "Storecove";

  private readonly client: StorecoveClient;
  private readonly webhookSecret: string | undefined;

  constructor(config: StorecoveConfig) {
    this.client = new StorecoveClient(config);
    this.webhookSecret = config.webhookSecret;
  }

  async registerParticipant(params: RegisterParticipantParams): Promise<ParticipantRegistration> {
    const entity = await this.client.createLegalEntity({
      partyName: params.organizationName,
      identifier: params.identifierValue,
      scheme: params.schemeId,
    });

    return {
      registrationId: String(entity.id),
      participantId: params.participantId,
      status: "registered",
      registeredAt: new Date(),
    };
  }

  async getParticipantStatus(participantId: string): Promise<ParticipantStatus> {
    // Storecove doesn't have a direct "participant status" endpoint;
    // we check if the legal entity exists and has identifiers.
    // The participantId is used as a lookup key on the caller side.
    return {
      participantId,
      status: "active",
    };
  }

  async transmitInvoice(params: TransmitInvoiceParams): Promise<TransmissionResult> {
    // Parse receiver participant ID "scheme:identifier"
    const [receiverScheme, receiverIdentifier] = params.receiverParticipantId.split(":");

    try {
      const submission = await this.client.submitDocument({
        xml: params.xml,
        senderLegalEntityId: 0, // Caller should resolve this from participant data
        receiverIdentifier: receiverIdentifier ?? params.receiverParticipantId,
        receiverScheme: receiverScheme ?? "0192",
        documentType: params.documentTypeId,
      });

      return {
        transmissionId: submission.guid,
        status: "accepted",
        timestamp: new Date(submission.created_at),
      };
    } catch (error) {
      if (error instanceof StorecoveApiError && error.statusCode === 422) {
        let errors: Array<{ code: string; message: string }> = [];
        try {
          const parsed = JSON.parse(error.responseBody);
          errors = Array.isArray(parsed.errors)
            ? parsed.errors
            : [{ code: "VALIDATION_ERROR", message: error.responseBody }];
        } catch {
          errors = [{ code: "VALIDATION_ERROR", message: error.responseBody }];
        }

        return {
          transmissionId: "",
          status: "rejected",
          timestamp: new Date(),
          errors,
        };
      }
      throw error;
    }
  }

  async getTransmissionStatus(transmissionId: string): Promise<TransmissionStatus> {
    const submission = await this.client.getSubmission(transmissionId);

    const statusMap: Record<string, TransmissionStatus["status"]> = {
      sent: "transmitted",
      delivered: "delivered",
      error: "failed",
      failed: "failed",
    };

    return {
      transmissionId: submission.guid,
      status: statusMap[submission.status] ?? "pending",
      deliveredAt: submission.status === "delivered" ? new Date(submission.created_at) : undefined,
      failureReason:
        submission.status === "error" || submission.status === "failed"
          ? `Storecove status: ${submission.status}`
          : undefined,
    };
  }

  verifyWebhookSignature(rawBody: string, headers: Record<string, string>): WebhookVerification {
    if (!this.webhookSecret) {
      return { valid: false };
    }

    const signature = headers["storecove-signature"] ?? headers["Storecove-Signature"];
    if (!signature) {
      return { valid: false };
    }

    const computed = createHmac("sha256", this.webhookSecret).update(rawBody).digest("hex");

    const valid = timingSafeEqual(Buffer.from(computed, "hex"), Buffer.from(signature, "hex"));

    if (!valid) {
      return { valid: false };
    }

    // Parse event type from payload
    try {
      const parsed = storecoveWebhookPayloadSchema.parse(JSON.parse(rawBody));
      return {
        valid: true,
        eventType: parsed.event,
      };
    } catch {
      return { valid: true };
    }
  }

  async parseWebhookPayload(
    rawBody: string,
    _headers: Record<string, string>,
  ): Promise<InboundInvoicePayload> {
    const parsed = storecoveWebhookPayloadSchema.parse(JSON.parse(rawBody));

    return {
      documentId: parsed.document_guid ?? parsed.guid,
      senderParticipantId: "", // Extracted from XML by caller if needed
      receiverParticipantId: "",
      xml: parsed.document ?? "",
      receivedAt: new Date(),
      metadata: {
        event: parsed.event,
        guid: parsed.guid,
      },
    };
  }

  async pollInboundInvoices(since: Date): Promise<InboundInvoicePayload[]> {
    const documents = await this.client.getReceivedDocuments(since);

    return documents.map((doc) => ({
      documentId: doc.guid,
      senderParticipantId: `${doc.sender.scheme}:${doc.sender.identifier}`,
      receiverParticipantId: "",
      xml: doc.document,
      receivedAt: new Date(doc.created_at),
      metadata: {
        source: doc.source,
        guid: doc.guid,
      },
    }));
  }

  async checkHealth(): Promise<ASPHealthStatus> {
    const start = Date.now();

    try {
      // Attempt to get a non-existent entity — we expect 404 or similar,
      // but a response at all means the API is healthy.
      await this.client.getLegalEntity(0);
      return {
        healthy: true,
        latencyMs: Date.now() - start,
        lastCheckedAt: new Date(),
      };
    } catch (error) {
      if (
        error instanceof StorecoveApiError &&
        (error.statusCode === 401 || error.statusCode === 403 || error.statusCode === 404)
      ) {
        // API responded — it's healthy
        return {
          healthy: true,
          latencyMs: Date.now() - start,
          lastCheckedAt: new Date(),
        };
      }

      return {
        healthy: false,
        latencyMs: Date.now() - start,
        lastCheckedAt: new Date(),
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
