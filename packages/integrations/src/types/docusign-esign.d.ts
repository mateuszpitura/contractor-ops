// ---------------------------------------------------------------------------
// Minimal type declarations for docusign-esign SDK (pure JS, no bundled types)
// ---------------------------------------------------------------------------

declare module "docusign-esign" {
  export class ApiClient {
    setBasePath(basePath: string): void;
    addDefaultHeader(name: string, value: string): void;
  }

  export class EnvelopesApi {
    constructor(apiClient: ApiClient);
    createEnvelope(
      accountId: string,
      opts: { envelopeDefinition: unknown },
    ): Promise<{ envelopeId: string; status: string }>;
    createRecipientView(
      accountId: string,
      envelopeId: string,
      opts: { recipientViewRequest: unknown },
    ): Promise<{ url: string }>;
    getDocument(
      accountId: string,
      envelopeId: string,
      documentId: string,
    ): Promise<Buffer>;
    getEnvelope(
      accountId: string,
      envelopeId: string,
    ): Promise<{ envelopeId: string; status: string }>;
    listRecipients(
      accountId: string,
      envelopeId: string,
    ): Promise<{
      signers?: Array<{
        recipientId: string;
        email: string;
        name: string;
        status: string;
      }>;
    }>;
    update(
      accountId: string,
      envelopeId: string,
      opts: { envelope: unknown },
    ): Promise<void>;
    updateRecipients(
      accountId: string,
      envelopeId: string,
      opts: { recipients: unknown; resendEnvelope?: string },
    ): Promise<void>;
  }

  // Model constructors (static factory methods)
  export const Document: {
    constructFromObject(data: Record<string, unknown>): unknown;
  };
  export const Signer: {
    constructFromObject(data: Record<string, unknown>): unknown;
  };
  export const Recipients: {
    constructFromObject(data: Record<string, unknown>): unknown;
  };
  export const EnvelopeDefinition: {
    constructFromObject(data: Record<string, unknown>): unknown;
  };
  export const Envelope: {
    constructFromObject(data: Record<string, unknown>): unknown;
  };
  export const RecipientViewRequest: {
    constructFromObject(data: Record<string, unknown>): unknown;
  };
  export const Expirations: {
    constructFromObject(data: Record<string, unknown>): unknown;
  };
  export const Reminders: {
    constructFromObject(data: Record<string, unknown>): unknown;
  };
  export const Notification: {
    constructFromObject(data: Record<string, unknown>): unknown;
  };
}
