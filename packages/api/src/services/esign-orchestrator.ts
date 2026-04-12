import { createHash } from "node:crypto";
import { prisma } from "@contractor-ops/db";
import {
  createSigningEnvelope as createProviderEnvelope,
  downloadSignedDocument,
  getEmbeddedSigningUrl as getProviderSigningUrl,
  resendSigningNotification,
  voidSigningEnvelope as voidProviderEnvelope,
} from "@contractor-ops/integrations/services/esign-service";
import { TRPCError } from "@trpc/server";
import * as E from "../errors.js";
import { createPresignedDownloadUrl, createPresignedUploadUrl, generateStorageKey } from "./r2.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ESignProvider = "DOCUSIGN" | "AUTENTI";

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
    role: "signer" | "countersigner";
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
      code: "NOT_FOUND",
      message: E.ESIGN_DOCUMENT_NOT_FOUND,
    });
  }

  // Generate presigned URL and fetch the PDF content
  const downloadUrl = await createPresignedDownloadUrl(document.storageKey);
  const response = await fetch(downloadUrl);

  if (!response.ok) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: E.ESIGN_DOWNLOAD_FAILED,
    });
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const documentBase64 = buffer.toString("base64");

  return { document, documentBase64 };
}

// ---------------------------------------------------------------------------
// sendForSignature
// ---------------------------------------------------------------------------

/**
 * Creates a signing envelope with the specified provider, saves the envelope
 * and recipient records in the database, and updates contract status if applicable.
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

  // Fetch and prepare the document
  const { document, documentBase64 } = await fetchDocumentContent(organizationId, documentId);

  // Call the provider adapter to create the envelope
  const result = await createProviderEnvelope({
    provider,
    connectionId,
    request: {
      documentBase64,
      documentName: document.originalFileName,
      signers: signers.map((s) => ({
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

  // Compute expiry date
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  const now = new Date();

  // Create all records in a single transaction
  const envelope = await prisma.$transaction(async (tx) => {
    // a. Create SigningEnvelope
    const env = await tx.signingEnvelope.create({
      data: {
        organizationId,
        integrationConnectionId: connectionId,
        provider: provider as never,
        externalEnvelopeId: result.externalEnvelopeId,
        contractId: contractId ?? null,
        documentId,
        status: "SENT",
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
      const externalRecipient = result.signers.find((s) => s.email === signer.email);
      await tx.signingRecipient.create({
        data: {
          signingEnvelopeId: env.id,
          externalRecipientId: externalRecipient?.externalRecipientId ?? null,
          name: signer.name,
          email: signer.email,
          role: signer.role === "countersigner" ? "COUNTERSIGNER" : "SIGNER",
          routingOrder: signer.routingOrder,
          status: "SENT",
        },
      });
    }

    // c. Create ENVELOPE_CREATED event
    await tx.signingEvent.create({
      data: {
        organizationId,
        signingEnvelopeId: env.id,
        eventType: "ENVELOPE_CREATED",
        description: "Signing envelope created",
        occurredAt: now,
      },
    });

    // d. Create ENVELOPE_SENT event
    const firstSigner = signers.sort((a, b) => a.routingOrder - b.routingOrder)[0];
    await tx.signingEvent.create({
      data: {
        organizationId,
        signingEnvelopeId: env.id,
        eventType: "ENVELOPE_SENT",
        description: `Sent to ${firstSigner?.name ?? "recipient"} for signature`,
        occurredAt: now,
      },
    });

    // e. Update contract status to PENDING_SIGNATURE if contractId provided
    if (contractId) {
      await tx.contract.update({
        where: { id: contractId },
        data: { status: "PENDING_SIGNATURE" },
      });
    }

    // f. Create ExternalLink mapping
    await tx.externalLink.create({
      data: {
        organizationId,
        integrationConnectionId: connectionId,
        entityType: contractId ? "CONTRACT" : "DOCUMENT",
        entityId: contractId ?? documentId,
        externalType: `${provider}_ENVELOPE`,
        externalId: result.externalEnvelopeId,
      },
    });

    // Re-fetch with recipients for return value
    return tx.signingEnvelope.findUniqueOrThrow({
      where: { id: env.id },
      include: { recipients: true },
    });
  });

  return envelope;
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
      code: "NOT_FOUND",
      message: E.ESIGN_ENVELOPE_NOT_FOUND,
    });
  }

  if (!envelope.externalEnvelopeId) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
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
    throw new Error(
      `Cannot handle signing completion: envelope ${envelopeId} not found or missing external ID`,
    );
  }

  // Download signed PDF from the provider
  const signedDoc = await downloadSignedDocument({
    provider,
    connectionId,
    envelopeId: envelope.externalEnvelopeId,
  });

  // Generate a storage key for the signed copy
  const docBuffer = Buffer.from(signedDoc.documentBase64, "base64");
  const checksumSha256 = createHash("sha256").update(docBuffer).digest("hex");
  const signedFileName = signedDoc.fileName || "signed-document.pdf";
  const storageKey = generateStorageKey(
    envelope.organizationId,
    `esign-${envelope.id}`,
    signedFileName,
  );

  // Upload to R2 via presigned URL
  const uploadUrl = await createPresignedUploadUrl(
    storageKey,
    signedDoc.mimeType || "application/pdf",
  );
  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    body: docBuffer,
    headers: { "Content-Type": signedDoc.mimeType || "application/pdf" },
  });

  if (!uploadResponse.ok) {
    throw new Error(`Failed to upload signed PDF to R2: ${uploadResponse.status}`);
  }

  // Determine document type from original document if available
  let documentType: string = "OTHER";
  if (envelope.documentId) {
    const originalDoc = await prisma.document.findUnique({
      where: { id: envelope.documentId },
      select: { documentType: true },
    });
    if (originalDoc) {
      documentType = originalDoc.documentType;
    }
  }

  // Create Document and DocumentLink in a transaction
  const document = await prisma.$transaction(async (tx) => {
    // Create Document record with source = ESIGN
    const doc = await tx.document.create({
      data: {
        organizationId: envelope.organizationId,
        storageKey,
        originalFileName: signedFileName,
        mimeType: signedDoc.mimeType || "application/pdf",
        fileSizeBytes: BigInt(docBuffer.length),
        checksumSha256,
        documentType: documentType as never,
        source: "ESIGN",
        virusScanStatus: "CLEAN", // Signed PDFs from providers are trusted
      },
    });

    // Create DocumentLink with SIGNED_COPY role if we have a contractId
    if (envelope.contractId) {
      await tx.documentLink.create({
        data: {
          organizationId: envelope.organizationId,
          documentId: doc.id,
          entityType: "CONTRACT",
          entityId: envelope.contractId,
          linkRole: "SIGNED_COPY",
        },
      });
    }

    // Create SIGNED_PDF_SAVED event
    await tx.signingEvent.create({
      data: {
        organizationId: envelope.organizationId,
        signingEnvelopeId: envelope.id,
        eventType: "SIGNED_PDF_SAVED",
        description: `Signed PDF saved as ${signedFileName}`,
        occurredAt: new Date(),
      },
    });

    return doc;
  });

  return document;
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
      code: "NOT_FOUND",
      message: E.ESIGN_ENVELOPE_NOT_FOUND,
    });
  }

  if (!envelope.externalEnvelopeId) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
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

  await prisma.$transaction(async (tx) => {
    // Update envelope status
    await tx.signingEnvelope.update({
      where: { id: envelopeId },
      data: {
        status: "VOIDED",
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
      if (contract?.status === "PENDING_SIGNATURE") {
        await tx.contract.update({
          where: { id: envelope.contractId },
          data: { status: "DRAFT" },
        });
      }
    }

    // Create ENVELOPE_VOIDED event
    await tx.signingEvent.create({
      data: {
        organizationId,
        signingEnvelopeId: envelopeId,
        eventType: "ENVELOPE_VOIDED",
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
      code: "NOT_FOUND",
      message: E.ESIGN_ENVELOPE_NOT_FOUND,
    });
  }

  if (!envelope.externalEnvelopeId) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
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
      eventType: "ENVELOPE_SENT",
      description: `Resent to ${recipientEmail}`,
      occurredAt: new Date(),
    },
  });
}
