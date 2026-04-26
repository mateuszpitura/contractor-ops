import type { Prisma } from '@contractor-ops/db';
import { prisma } from '@contractor-ops/db';
import type {
  ContractStatus,
  SigningEnvelopeStatus,
  SigningRecipientStatus,
} from '@contractor-ops/db/generated/prisma/client';
import { normalizeSigningEvent } from './esign-service.js';

// ---------------------------------------------------------------------------
// E-Sign Webhook Handler
// ---------------------------------------------------------------------------

type ESignProvider = 'DOCUSIGN' | 'AUTENTI';

/**
 * Maps normalized envelope status to Prisma SigningEnvelopeStatus.
 */
const ENVELOPE_STATUS_MAP: Record<string, string> = {
  CREATED: 'CREATED',
  SENT: 'SENT',
  DELIVERED: 'DELIVERED',
  COMPLETED: 'COMPLETED',
  DECLINED: 'DECLINED',
  VOIDED: 'VOIDED',
  EXPIRED: 'EXPIRED',
};

/**
 * Maps normalized recipient status to Prisma SigningRecipientStatus.
 */
const RECIPIENT_STATUS_MAP: Record<string, string> = {
  PENDING: 'PENDING',
  SENT: 'SENT',
  DELIVERED: 'DELIVERED',
  VIEWED: 'VIEWED',
  SIGNED: 'SIGNED',
  DECLINED: 'DECLINED',
};

/**
 * Maps terminal envelope status to the corresponding contract status.
 */
const CONTRACT_STATUS_MAP: Record<string, string> = {
  COMPLETED: 'ACTIVE',
  DECLINED: 'SIGNATURE_DECLINED',
  EXPIRED: 'SIGNATURE_EXPIRED',
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
  await prisma.$transaction(async tx => {
    await createSigningEvent(tx, organizationId, envelope.id, event);

    if (event.recipientEmail && event.recipientStatus) {
      await updateRecipientStatus(tx, envelope.id, event);
    }

    if (event.envelopeStatus) {
      await updateEnvelopeStatus(tx, envelope.id, event);
      await updateContractStatusIfTerminal(tx, envelope.contractId, event);
    }
  });

  // e. Return completion signal
  const isCompleted = event.envelopeStatus === 'COMPLETED';

  return { envelopeId: envelope.id, completed: isCompleted };
}

// ---------------------------------------------------------------------------
// Transaction helpers
// ---------------------------------------------------------------------------

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

interface NormalizedEvent {
  eventType: string;
  externalEnvelopeId: string;
  actorName?: string | null;
  actorEmail?: string | null;
  description: string;
  providerEventId?: string | null;
  occurredAt: Date;
  recipientEmail?: string | null;
  recipientStatus?: string | null;
  envelopeStatus?: string | null;
}

async function createSigningEvent(
  tx: TxClient,
  organizationId: string,
  envelopeId: string,
  event: NormalizedEvent,
): Promise<void> {
  await tx.signingEvent.create({
    data: {
      organizationId,
      signingEnvelopeId: envelopeId,
      eventType: event.eventType as never,
      actorName: event.actorName ?? null,
      actorEmail: event.actorEmail ?? null,
      description: event.description,
      providerEventId: event.providerEventId ?? null,
      occurredAt: event.occurredAt,
    },
  });
}

/** Maps event types to the recipient timestamp field they update. */
const RECIPIENT_TIMESTAMP_FIELD: Record<string, string> = {
  RECIPIENT_SIGNED: 'signedAt',
  RECIPIENT_DECLINED: 'declinedAt',
  RECIPIENT_VIEWED: 'viewedAt',
};

async function updateRecipientStatus(
  tx: TxClient,
  envelopeId: string,
  event: NormalizedEvent,
): Promise<void> {
  const rawStatus = event.recipientStatus ?? '';
  const recipientStatus = RECIPIENT_STATUS_MAP[rawStatus] ?? rawStatus;

  const recipientUpdate: Prisma.SigningRecipientUpdateInput = {
    status: recipientStatus as SigningRecipientStatus,
  };

  const timestampField = RECIPIENT_TIMESTAMP_FIELD[event.eventType];
  if (timestampField) {
    (recipientUpdate as Record<string, unknown>)[timestampField] = event.occurredAt;
  }

  const recipient = await tx.signingRecipient.findFirst({
    where: { signingEnvelopeId: envelopeId, email: event.recipientEmail ?? '' },
  });

  if (recipient) {
    await tx.signingRecipient.update({
      where: { id: recipient.id },
      data: recipientUpdate,
    });
  }
}

async function updateEnvelopeStatus(
  tx: TxClient,
  envelopeId: string,
  event: NormalizedEvent,
): Promise<void> {
  const rawEnvStatus = event.envelopeStatus ?? '';
  const envelopeStatus = ENVELOPE_STATUS_MAP[rawEnvStatus] ?? rawEnvStatus;

  const envelopeUpdate: Prisma.SigningEnvelopeUpdateInput = {
    status: envelopeStatus as SigningEnvelopeStatus,
  };

  if (event.envelopeStatus === 'COMPLETED') {
    envelopeUpdate.completedAt = event.occurredAt;
  }
  if (event.envelopeStatus === 'VOIDED') {
    envelopeUpdate.voidedAt = event.occurredAt;
  }

  await tx.signingEnvelope.update({
    where: { id: envelopeId },
    data: envelopeUpdate,
  });
}

async function updateContractStatusIfTerminal(
  tx: TxClient,
  contractId: string | null,
  event: NormalizedEvent,
): Promise<void> {
  const envelopeStatus = event.envelopeStatus ?? '';
  const contractStatus = CONTRACT_STATUS_MAP[envelopeStatus];
  if (!(contractId && contractStatus)) return;

  const contractUpdate: Prisma.ContractUpdateInput = {
    status: contractStatus as ContractStatus,
  };

  if (event.envelopeStatus === 'COMPLETED') {
    contractUpdate.signedAt = event.occurredAt;
  }

  await tx.contract.update({
    where: { id: contractId },
    data: contractUpdate,
  });
}
