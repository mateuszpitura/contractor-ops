import { prisma } from "@contractor-ops/db";
import { normalizeSigningEvent } from "./esign-service.js";

// ---------------------------------------------------------------------------
// E-Sign Webhook Handler
// ---------------------------------------------------------------------------

type ESignProvider = "DOCUSIGN" | "AUTENTI";

/**
 * Maps normalized envelope status to Prisma SigningEnvelopeStatus.
 */
const ENVELOPE_STATUS_MAP: Record<string, string> = {
  CREATED: "CREATED",
  SENT: "SENT",
  DELIVERED: "DELIVERED",
  COMPLETED: "COMPLETED",
  DECLINED: "DECLINED",
  VOIDED: "VOIDED",
  EXPIRED: "EXPIRED",
};

/**
 * Maps normalized recipient status to Prisma SigningRecipientStatus.
 */
const RECIPIENT_STATUS_MAP: Record<string, string> = {
  PENDING: "PENDING",
  SENT: "SENT",
  DELIVERED: "DELIVERED",
  VIEWED: "VIEWED",
  SIGNED: "SIGNED",
  DECLINED: "DECLINED",
};

/**
 * Maps terminal envelope status to the corresponding contract status.
 */
const CONTRACT_STATUS_MAP: Record<string, string> = {
  COMPLETED: "ACTIVE",
  DECLINED: "SIGNATURE_DECLINED",
  EXPIRED: "SIGNATURE_EXPIRED",
};

/**
 * Processes a signing webhook event from DocuSign or Autenti.
 *
 * CRITICAL: This file lives in `packages/integrations` and MUST NOT import
 * from `packages/api`. It only uses esign-service (same package) and
 * `@contractor-ops/db` (prisma client). The signed PDF download and R2
 * storage is delegated back to the caller via the `completed` return value.
 *
 * @returns envelopeId and whether the signing is completed (caller should
 * trigger PDF download + storage via orchestrator in packages/api)
 */
export async function handleSigningWebhook(params: {
  provider: ESignProvider;
  payload: unknown;
  organizationId: string;
  connectionId: string;
}): Promise<{ envelopeId: string; completed: boolean }> {
  const { provider, payload, organizationId } = params;

  // a. Normalize the provider-specific event
  const event = normalizeSigningEvent(provider, payload);

  // b. Find the SigningEnvelope by externalEnvelopeId + organizationId
  const envelope = await prisma.signingEnvelope.findFirst({
    where: {
      externalEnvelopeId: event.externalEnvelopeId,
      organizationId,
    },
  });

  if (!envelope) {
    throw new Error(
      `SigningEnvelope not found for externalEnvelopeId=${event.externalEnvelopeId} org=${organizationId}. Will be retried.`,
    );
  }

  // c. Idempotency check: skip if this providerEventId was already processed
  if (event.providerEventId) {
    const existing = await prisma.signingEvent.findFirst({
      where: {
        signingEnvelopeId: envelope.id,
        providerEventId: event.providerEventId,
      },
    });

    if (existing) {
      return { envelopeId: envelope.id, completed: false };
    }
  }

  // d. Process the event in a transaction
  await prisma.$transaction(async (tx) => {
    // Create SigningEvent record
    await tx.signingEvent.create({
      data: {
        organizationId,
        signingEnvelopeId: envelope.id,
        eventType: event.eventType as never,
        actorName: event.actorName ?? null,
        actorEmail: event.actorEmail ?? null,
        description: event.description,
        providerEventId: event.providerEventId ?? null,
        occurredAt: event.occurredAt,
      },
    });

    // Update recipient status if event has recipientEmail
    if (event.recipientEmail && event.recipientStatus) {
      const recipientStatus =
        RECIPIENT_STATUS_MAP[event.recipientStatus] ?? event.recipientStatus;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const recipientUpdate: Record<string, any> = {
        status: recipientStatus,
      };

      if (event.eventType === "RECIPIENT_SIGNED") {
        recipientUpdate.signedAt = event.occurredAt;
      }
      if (event.eventType === "RECIPIENT_DECLINED") {
        recipientUpdate.declinedAt = event.occurredAt;
      }
      if (event.eventType === "RECIPIENT_VIEWED") {
        recipientUpdate.viewedAt = event.occurredAt;
      }

      // Update the matching recipient by envelope + email
      const recipient = await tx.signingRecipient.findFirst({
        where: {
          signingEnvelopeId: envelope.id,
          email: event.recipientEmail,
        },
      });

      if (recipient) {
        await tx.signingRecipient.update({
          where: { id: recipient.id },
          data: recipientUpdate,
        });
      }
    }

    // Update envelope status if event has envelopeStatus
    if (event.envelopeStatus) {
      const envelopeStatus =
        ENVELOPE_STATUS_MAP[event.envelopeStatus] ?? event.envelopeStatus;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const envelopeUpdate: Record<string, any> = {
        status: envelopeStatus,
      };

      if (event.envelopeStatus === "COMPLETED") {
        envelopeUpdate.completedAt = event.occurredAt;
      }
      if (event.envelopeStatus === "VOIDED") {
        envelopeUpdate.voidedAt = event.occurredAt;
      }

      await tx.signingEnvelope.update({
        where: { id: envelope.id },
        data: envelopeUpdate,
      });

      // Update contract status for terminal envelope states
      if (envelope.contractId && CONTRACT_STATUS_MAP[event.envelopeStatus]) {
        const contractStatus = CONTRACT_STATUS_MAP[event.envelopeStatus]!;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const contractUpdate: Record<string, any> = {
          status: contractStatus,
        };

        if (event.envelopeStatus === "COMPLETED") {
          contractUpdate.signedAt = event.occurredAt;
        }

        await tx.contract.update({
          where: { id: envelope.contractId },
          data: contractUpdate,
        });
      }
    }
  });

  // e. Return completion signal
  const isCompleted = event.envelopeStatus === "COMPLETED";

  return { envelopeId: envelope.id, completed: isCompleted };
}
