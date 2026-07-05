import { createHash } from 'node:crypto';
import { prisma } from '@contractor-ops/db';
import { fetchWithTimeout } from '@contractor-ops/integrations';
import {
  createSigningEnvelope as createProviderEnvelope,
  downloadSignedDocument,
  getEmbeddedSigningUrl as getProviderSigningUrl,
  resendSigningNotification,
  voidSigningEnvelope as voidProviderEnvelope,
} from '@contractor-ops/integrations/services/esign-service';
import { TRPCError } from '@trpc/server';
import * as E from '../errors';
import { createPresignedDownloadUrl, createPresignedUploadUrl, generateStorageKey } from './r2';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ESignProvider = 'DOCUSIGN' | 'AUTENTI';

export interface SendForSignatureParams {
  organizationId: string;
  userId: string;
  contractId?: string;
  documentId: string;
  connectionId: string;
  provider: ESignProvider;
  signers: {
    name: string;
    email: string;
    role: 'signer' | 'countersigner';
    routingOrder: number;
  }[];
  message?: string;
  expiresInDays?: number;
  reminderIntervalDays?: number;
}

export interface GetSigningUrlParams {
  organizationId: string;
  envelopeId: string;
  recipientEmail: string;
  returnUrl: string;
}

export interface VoidEnvelopeParams {
  organizationId: string;
  envelopeId: string;
  userId: string;
  reason: string;
}

export interface ResendToRecipientParams {
  organizationId: string;
  envelopeId: string;
  recipientEmail: string;
}

/**
 * Raised by {@link handleSigningCompletion} so the webhook drain can tell a
 * transient failure (R2 outage, network) from a permanent one (envelope never
 * reached the provider). Retriable failures must FAIL the delivery so QStash /
 * the reaper re-drive completion; permanent ones must be swallowed so the
 * delivery isn't retried forever.
 */
export class EsignCompletionError extends Error {
  readonly retriable: boolean;
  constructor(message: string, retriable: boolean) {
    super(message);
    this.name = 'EsignCompletionError';
    this.retriable = retriable;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Fetches a document record and generates a presigned download URL for its content.
 * Returns the document record and the base64-encoded PDF content.
 */
async function fetchDocumentContent(
  organizationId: string,
  documentId: string,
): Promise<{
  document: { storageKey: string; originalFileName: string; documentType: string };
  documentBase64: string;
}> {
  const document = await prisma.document.findFirst({
    where: { id: documentId, organizationId, deletedAt: null },
    select: { storageKey: true, originalFileName: true, documentType: true },
  });

  if (!document) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: E.ESIGN_DOCUMENT_NOT_FOUND,
    });
  }

  // Generate presigned URL and fetch the PDF content
  const downloadUrl = await createPresignedDownloadUrl(document.storageKey);
  // Signed PDFs can be large — give the body read plenty of headroom.
  const response = await fetchWithTimeout(downloadUrl, undefined, { timeoutMs: 60_000 });

  if (!response.ok) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: E.ESIGN_DOWNLOAD_FAILED,
    });
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const documentBase64 = buffer.toString('base64');

  return { document, documentBase64 };
}

// ---------------------------------------------------------------------------
// sendForSignature
// ---------------------------------------------------------------------------

/**
 * Detects a Prisma unique-constraint violation (P2002) without importing the
 * Prisma error class into this module's dependency graph.
 */
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === 'P2002'
  );
}

/**
 * Deterministic digest of the logical signer set for one send. Combined with
 * `organizationId` + `documentId` (the other two thirds of the intent-row
 * dedup key) it identifies a single logical envelope. Mirrors the DocuSign
 * adapter's `businessKey`: a hash over the document identity and the sorted
 * signer set (email + role + routing order), so a resend of the same document
 * to the same signers collapses to one key regardless of array ordering.
 */
function computeSignerSetHash(
  documentId: string,
  signers: SendForSignatureParams['signers'],
): string {
  const canonicalSigners = signers
    .map(s => `${s.email}:${s.role}:${s.routingOrder}`)
    .sort()
    .join(',');
  return createHash('sha256').update(`${documentId}|${canonicalSigners}`).digest('hex');
}

interface PersistEnvelopeArgs {
  organizationId: string;
  userId: string;
  contractId?: string;
  documentId: string;
  connectionId: string;
  provider: ESignProvider;
  signers: SendForSignatureParams['signers'];
  message?: string;
  expiresInDays: number;
  reminderIntervalDays?: number;
  externalEnvelopeId: string;
  /** Provider recipient mapping; empty when re-driving persistence for an existing process. */
  providerSigners: ReadonlyArray<{ externalRecipientId?: string | null; email: string }>;
}

/**
 * Writes the local SigningEnvelope + recipients + events (+ contract status /
 * external link) for a provider process that has already been created. Kept
 * separate from the provider call so a retry can re-drive persistence against
 * an existing process without issuing a second provider create.
 */
async function persistEnvelopeRecords(args: PersistEnvelopeArgs) {
  const {
    organizationId,
    userId,
    contractId,
    documentId,
    connectionId,
    provider,
    signers,
    message,
    expiresInDays,
    reminderIntervalDays,
    externalEnvelopeId,
    providerSigners,
  } = args;

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  const now = new Date();

  return prisma.$transaction(async tx => {
    // a. Create SigningEnvelope
    const env = await tx.signingEnvelope.create({
      data: {
        organizationId,
        integrationConnectionId: connectionId,
        provider: provider as never,
        externalEnvelopeId,
        contractId: contractId ?? null,
        documentId,
        status: 'SENT',
        message: message ?? null,
        expiresAt,
        reminderIntervalDays: reminderIntervalDays ?? null,
        sentByUserId: userId,
        sentAt: now,
      },
      include: { recipients: true },
    });

    // b. Create SigningRecipient records
    for (const signer of signers) {
      const externalRecipient = providerSigners.find(s => s.email === signer.email);
      await tx.signingRecipient.create({
        data: {
          signingEnvelopeId: env.id,
          externalRecipientId: externalRecipient?.externalRecipientId ?? null,
          name: signer.name,
          email: signer.email,
          role: signer.role === 'countersigner' ? 'COUNTERSIGNER' : 'SIGNER',
          routingOrder: signer.routingOrder,
          status: 'SENT',
        },
      });
    }

    // c. Create ENVELOPE_CREATED event
    await tx.signingEvent.create({
      data: {
        organizationId,
        signingEnvelopeId: env.id,
        eventType: 'ENVELOPE_CREATED',
        description: 'Signing envelope created',
        occurredAt: now,
      },
    });

    // d. Create ENVELOPE_SENT event
    const firstSigner = [...signers].sort((a, b) => a.routingOrder - b.routingOrder)[0];
    await tx.signingEvent.create({
      data: {
        organizationId,
        signingEnvelopeId: env.id,
        eventType: 'ENVELOPE_SENT',
        description: `Sent to ${firstSigner?.name ?? 'recipient'} for signature`,
        occurredAt: now,
      },
    });

    // e. Update contract status to PENDING_SIGNATURE if contractId provided
    if (contractId) {
      await tx.contract.update({
        where: { id: contractId },
        data: { status: 'PENDING_SIGNATURE' },
      });
    }

    // f. Create ExternalLink mapping
    await tx.externalLink.create({
      data: {
        organizationId,
        integrationConnectionId: connectionId,
        entityType: contractId ? 'CONTRACT' : 'DOCUMENT',
        entityId: contractId ?? documentId,
        externalType: `${provider}_ENVELOPE`,
        externalId: externalEnvelopeId,
      },
    });

    // Re-fetch with recipients for return value
    return tx.signingEnvelope.findUniqueOrThrow({
      where: { id: env.id },
      include: { recipients: true },
    });
  });
}

/**
 * Reuses a provider process that a prior (or concurrent) attempt already
 * created for this logical send. Returns the persisted envelope if it exists;
 * otherwise re-drives only the local persistence against the existing process
 * (the case where the earlier local transaction rolled back after the provider
 * call). Never issues a second provider create.
 */
async function reuseProviderEnvelope(args: Omit<PersistEnvelopeArgs, 'providerSigners'>) {
  const existing = await prisma.signingEnvelope.findUnique({
    where: {
      provider_externalEnvelopeId: {
        provider: args.provider as never,
        externalEnvelopeId: args.externalEnvelopeId,
      },
    },
    include: { recipients: true },
  });

  if (existing) return existing;

  return persistEnvelopeRecords({ ...args, providerSigners: [] });
}

/**
 * Creates a signing envelope with the specified provider, saves the envelope
 * and recipient records in the database, and updates contract status if applicable.
 *
 * Idempotency for non-idempotent providers: the provider process is created
 * BEFORE the local transaction, so a rolled-back transaction would otherwise
 * orphan the process and let a retry create a duplicate. DocuSign is protected
 * by its server-honored `X-DocuSign-Idempotency-Key`, but Autenti's multi-step
 * `document-processes` POSTs honor no idempotency header. An `EsignEnvelopeIntent`
 * row keyed on `(organizationId, documentId, signerSetHash)` is claimed BEFORE
 * the provider call and stamped with `externalEnvelopeId` once the create
 * returns; a retry reuses the recorded process instead of duplicating it.
 */
export async function sendForSignature(params: SendForSignatureParams) {
  const {
    organizationId,
    userId,
    contractId,
    documentId,
    connectionId,
    provider,
    signers,
    message,
    expiresInDays = 14,
    reminderIntervalDays,
  } = params;

  const signerSetHash = computeSignerSetHash(documentId, signers);
  const dedupKey = {
    organizationId_documentId_signerSetHash: { organizationId, documentId, signerSetHash },
  };

  const reuseArgs: Omit<PersistEnvelopeArgs, 'providerSigners' | 'externalEnvelopeId'> = {
    organizationId,
    userId,
    contractId,
    documentId,
    connectionId,
    provider,
    signers,
    message,
    expiresInDays,
    reminderIntervalDays,
  };

  // A provider process was already created for this logical send — reuse it.
  const existingIntent = await prisma.esignEnvelopeIntent.findUnique({ where: dedupKey });
  if (existingIntent?.externalEnvelopeId) {
    return reuseProviderEnvelope({
      ...reuseArgs,
      externalEnvelopeId: existingIntent.externalEnvelopeId,
    });
  }

  // A prior attempt claimed this logical send but never stamped a provider id —
  // it crashed somewhere between the claim and the `externalEnvelopeId`
  // write-back. That attempt may already have created a provider process before
  // dying, so re-issuing the create here would duplicate it. Fail closed and
  // direct a manual reconcile rather than blindly re-creating. (This is the
  // pre-existing claimed-but-unstamped row; a claim we make ourselves below is
  // safe to proceed on because no provider call has happened yet.)
  if (existingIntent) {
    throw new TRPCError({ code: 'CONFLICT', message: E.ESIGN_NO_EXTERNAL_ID });
  }

  // No prior intent — claim the row now, before touching the provider. We own
  // the (yet-to-be-created) process only if OUR create wins; a concurrent claim
  // for the same logical send raises P2002.
  let intentId: string;
  try {
    const created = await prisma.esignEnvelopeIntent.create({
      data: {
        organizationId,
        documentId,
        contractId: contractId ?? null,
        provider: provider as never,
        integrationConnectionId: connectionId,
        signerSetHash,
      },
      select: { id: true },
    });
    intentId = created.id;
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    // A concurrent send claimed the same logical envelope first. Reuse its
    // process rather than creating a duplicate at the provider.
    const winner = await prisma.esignEnvelopeIntent.findUnique({ where: dedupKey });
    if (winner?.externalEnvelopeId) {
      return reuseProviderEnvelope({
        ...reuseArgs,
        externalEnvelopeId: winner.externalEnvelopeId,
      });
    }
    // The winner is mid-flight and has not recorded a provider id yet;
    // refuse to create a second process. The caller retries once it settles.
    throw new TRPCError({ code: 'CONFLICT', message: E.ESIGN_NO_EXTERNAL_ID });
  }

  // Fetch and prepare the document, then create the provider envelope.
  const { document, documentBase64 } = await fetchDocumentContent(organizationId, documentId);

  // `organizationId` is plumbed through so the adapter's idempotency-key
  // derivation shares the canonical orgId scope.
  const result = await createProviderEnvelope({
    provider,
    connectionId,
    request: {
      organizationId,
      documentBase64,
      documentName: document.originalFileName,
      signers: signers.map(s => ({
        name: s.name,
        email: s.email,
        role: s.role,
        routingOrder: s.routingOrder,
      })),
      message,
      expiresInDays,
      reminderIntervalDays,
    },
  });

  // Record the provider process id on the intent row BEFORE the local
  // transaction, so a rollback below still leaves a durable pointer for a
  // retry to reuse instead of orphaning the process and duplicating it.
  await prisma.esignEnvelopeIntent.update({
    where: { id: intentId },
    data: { externalEnvelopeId: result.externalEnvelopeId },
  });

  return persistEnvelopeRecords({
    ...reuseArgs,
    externalEnvelopeId: result.externalEnvelopeId,
    providerSigners: result.signers,
  });
}

// ---------------------------------------------------------------------------
// getSigningUrl
// ---------------------------------------------------------------------------

/**
 * Generates an embedded signing URL for a specific recipient.
 * Returns null-ish embedded: false if provider doesn't support embedded signing.
 */
export async function getSigningUrl(params: GetSigningUrlParams) {
  const { organizationId, envelopeId, recipientEmail, returnUrl } = params;

  const envelope = await prisma.signingEnvelope.findFirst({
    where: { id: envelopeId, organizationId },
  });

  if (!envelope) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: E.ESIGN_ENVELOPE_NOT_FOUND,
    });
  }

  if (!envelope.externalEnvelopeId) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: E.ESIGN_NO_EXTERNAL_ID,
    });
  }

  const result = await getProviderSigningUrl({
    provider: envelope.provider as ESignProvider,
    connectionId: envelope.integrationConnectionId,
    envelopeId: envelope.externalEnvelopeId,
    recipientEmail,
    returnUrl,
  });

  if (!result) {
    return { embedded: false as const, redirectUrl: null };
  }

  return {
    embedded: true as const,
    url: result.url,
    expiresAt: result.expiresAt,
  };
}

// ---------------------------------------------------------------------------
// handleSigningCompletion
// ---------------------------------------------------------------------------

/**
 * Returns the signed `Document` already persisted for a completed envelope, or
 * `null` when the envelope has no contract link (a `SIGNED_COPY` `DocumentLink`
 * is only created for contract-linked envelopes). Used both by the fast-path
 * idempotency check and by the loser of a concurrent completion race once the
 * `SIGNED_PDF_SAVED` partial unique has rejected its duplicate write.
 */
async function loadSavedSignedDocument(envelope: {
  organizationId: string;
  contractId: string | null;
}) {
  if (!envelope.contractId) return null;
  const existingLink = await prisma.documentLink.findFirst({
    where: {
      organizationId: envelope.organizationId,
      entityType: 'CONTRACT',
      entityId: envelope.contractId,
      linkRole: 'SIGNED_COPY',
    },
    include: { document: true },
  });
  return existingLink?.document ?? null;
}

/**
 * Downloads the signed PDF from the provider, uploads to R2, and creates
 * Document + DocumentLink records. Called from the webhook API route when
 * the webhook handler returns completed === true.
 */
export async function handleSigningCompletion(
  envelopeId: string,
  connectionId: string,
  provider: ESignProvider,
) {
  // Fetch envelope with its org context
  const envelope = await prisma.signingEnvelope.findFirst({
    where: { id: envelopeId },
    include: {
      recipients: true,
    },
  });

  if (!envelope?.externalEnvelopeId) {
    // Permanent: an envelope that never received a provider external id can
    // never yield a signed PDF. Retrying re-reads the same broken state.
    throw new EsignCompletionError(
      `Cannot handle signing completion: envelope ${envelopeId} not found or missing external ID`,
      false,
    );
  }

  // Idempotency fast path: a redelivered "completed" webhook (or a provider
  // firing the completed status more than once) must not re-download the signed
  // PDF or insert a duplicate signed Document. SIGNED_PDF_SAVED is written in the
  // same transaction as the Document + DocumentLink, so its presence proves the
  // signed copy is already persisted. This is only an optimization — the atomic
  // guard is the SIGNED_PDF_SAVED partial unique enforced inside the transaction
  // below, which closes the read-then-write race two concurrent deliveries hit.
  const alreadySaved = await prisma.signingEvent.findFirst({
    where: {
      organizationId: envelope.organizationId,
      signingEnvelopeId: envelope.id,
      eventType: 'SIGNED_PDF_SAVED',
    },
    select: { id: true },
  });

  if (alreadySaved) {
    return loadSavedSignedDocument(envelope);
  }

  // Download signed PDF from the provider
  const signedDoc = await downloadSignedDocument({
    provider,
    connectionId,
    envelopeId: envelope.externalEnvelopeId,
  });

  // Generate a storage key for the signed copy
  const docBuffer = Buffer.from(signedDoc.documentBase64, 'base64');
  const checksumSha256 = createHash('sha256').update(docBuffer).digest('hex');
  const signedFileName = signedDoc.fileName || 'signed-document.pdf';
  const storageKey = generateStorageKey(
    envelope.organizationId,
    `esign-${envelope.id}`,
    signedFileName,
  );

  // Upload to R2 via presigned URL
  const uploadUrl = await createPresignedUploadUrl(
    storageKey,
    signedDoc.mimeType || 'application/pdf',
  );
  const uploadResponse = await fetchWithTimeout(
    uploadUrl,
    {
      method: 'PUT',
      body: docBuffer,
      headers: { 'Content-Type': signedDoc.mimeType || 'application/pdf' },
    },
    { timeoutMs: 60_000 },
  );

  if (!uploadResponse.ok) {
    // Retriable: an R2 write failure is transient — fail the delivery so the
    // signed PDF save is re-driven instead of being silently lost.
    throw new EsignCompletionError(
      `Failed to upload signed PDF to R2: ${uploadResponse.status}`,
      true,
    );
  }

  // Determine document type from original document if available
  let documentType: string = 'OTHER';
  if (envelope.documentId) {
    const originalDoc = await prisma.document.findUnique({
      where: { id: envelope.documentId },
      select: { documentType: true },
    });
    if (originalDoc) {
      documentType = originalDoc.documentType;
    }
  }

  // Create Document + DocumentLink + the terminal SIGNED_PDF_SAVED event in one
  // transaction. The SIGNED_PDF_SAVED partial unique
  // (signing_event_signed_pdf_saved_key) makes this write atomic: two concurrent
  // "completed" deliveries both pass the fast-path check above, but only one can
  // commit the event — the loser's event insert raises P2002, rolling back its
  // whole transaction (duplicate Document + link included). We catch that P2002
  // as an idempotent no-op and return the winner's already-persisted signed
  // Document rather than surfacing an error or leaving a duplicate.
  try {
    return await prisma.$transaction(async tx => {
      // Create Document record with source = ESIGN
      const doc = await tx.document.create({
        data: {
          organizationId: envelope.organizationId,
          storageKey,
          originalFileName: signedFileName,
          mimeType: signedDoc.mimeType || 'application/pdf',
          fileSizeBytes: BigInt(docBuffer.length),
          checksumSha256,
          documentType: documentType as never,
          source: 'ESIGN',
          virusScanStatus: 'CLEAN', // Signed PDFs from providers are trusted
        },
      });

      // Create DocumentLink with SIGNED_COPY role if we have a contractId
      if (envelope.contractId) {
        await tx.documentLink.create({
          data: {
            organizationId: envelope.organizationId,
            documentId: doc.id,
            entityType: 'CONTRACT',
            entityId: envelope.contractId,
            linkRole: 'SIGNED_COPY',
          },
        });
      }

      // Create SIGNED_PDF_SAVED event
      await tx.signingEvent.create({
        data: {
          organizationId: envelope.organizationId,
          signingEnvelopeId: envelope.id,
          eventType: 'SIGNED_PDF_SAVED',
          description: `Signed PDF saved as ${signedFileName}`,
          occurredAt: new Date(),
        },
      });

      return doc;
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return loadSavedSignedDocument(envelope);
    }
    throw err;
  }
}

/**
 * True when an envelope has reached terminal COMPLETED but its signed PDF has
 * not been persisted yet (no SIGNED_PDF_SAVED event).
 *
 * The webhook drain uses this to re-drive {@link handleSigningCompletion} on a
 * QStash retry: the provider's "completed" event is recorded in the webhook
 * handler's own transaction, so a redelivery of that event dedups to
 * `completed = false`. Without this durable check a completion that failed at
 * R2 on the first attempt would never be retried, and the delivery would flip
 * PROCESSED with the signed PDF permanently missing.
 */
export async function isSignedCopyPending(envelopeId: string): Promise<boolean> {
  const envelope = await prisma.signingEnvelope.findFirst({
    where: { id: envelopeId },
    select: { id: true, status: true, organizationId: true },
  });
  if (!envelope || envelope.status !== 'COMPLETED') return false;

  const saved = await prisma.signingEvent.findFirst({
    where: {
      organizationId: envelope.organizationId,
      signingEnvelopeId: envelope.id,
      eventType: 'SIGNED_PDF_SAVED',
    },
    select: { id: true },
  });
  return !saved;
}

// ---------------------------------------------------------------------------
// voidEnvelope
// ---------------------------------------------------------------------------

/**
 * Voids a signing envelope with the provider and updates local records.
 */
export async function voidEnvelope(params: VoidEnvelopeParams) {
  const { organizationId, envelopeId, userId, reason } = params;

  const envelope = await prisma.signingEnvelope.findFirst({
    where: { id: envelopeId, organizationId },
  });

  if (!envelope) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: E.ESIGN_ENVELOPE_NOT_FOUND,
    });
  }

  if (!envelope.externalEnvelopeId) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: E.ESIGN_NO_EXTERNAL_ID,
    });
  }

  // Void with the provider
  await voidProviderEnvelope({
    provider: envelope.provider as ESignProvider,
    connectionId: envelope.integrationConnectionId,
    envelopeId: envelope.externalEnvelopeId,
    reason,
  });

  const now = new Date();

  await prisma.$transaction(async tx => {
    // Update envelope status
    await tx.signingEnvelope.update({
      where: { id: envelopeId },
      data: {
        status: 'VOIDED',
        voidedAt: now,
        voidReason: reason,
      },
    });

    // If contract was PENDING_SIGNATURE, revert to DRAFT
    if (envelope.contractId) {
      const contract = await tx.contract.findUnique({
        where: { id: envelope.contractId },
        select: { status: true },
      });
      if (contract?.status === 'PENDING_SIGNATURE') {
        await tx.contract.update({
          where: { id: envelope.contractId },
          data: { status: 'DRAFT' },
        });
      }
    }

    // Create ENVELOPE_VOIDED event
    await tx.signingEvent.create({
      data: {
        organizationId,
        signingEnvelopeId: envelopeId,
        eventType: 'ENVELOPE_VOIDED',
        description: `Envelope voided: ${reason}`,
        actorName: userId,
        occurredAt: now,
      },
    });
  });
}

// ---------------------------------------------------------------------------
// resendToRecipient
// ---------------------------------------------------------------------------

/**
 * Resends a signing notification to a specific recipient.
 */
export async function resendToRecipient(params: ResendToRecipientParams) {
  const { organizationId, envelopeId, recipientEmail } = params;

  const envelope = await prisma.signingEnvelope.findFirst({
    where: { id: envelopeId, organizationId },
  });

  if (!envelope) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: E.ESIGN_ENVELOPE_NOT_FOUND,
    });
  }

  if (!envelope.externalEnvelopeId) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: E.ESIGN_NO_EXTERNAL_ID,
    });
  }

  // Resend with the provider
  await resendSigningNotification({
    provider: envelope.provider as ESignProvider,
    connectionId: envelope.integrationConnectionId,
    envelopeId: envelope.externalEnvelopeId,
    recipientEmail,
  });

  // Create ENVELOPE_SENT event for the resend
  await prisma.signingEvent.create({
    data: {
      organizationId,
      signingEnvelopeId: envelopeId,
      eventType: 'ENVELOPE_SENT',
      description: `Resent to ${recipientEmail}`,
      occurredAt: new Date(),
    },
  });
}
