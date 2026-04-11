// ---------------------------------------------------------------------------
// Storecove ASP Types
// ---------------------------------------------------------------------------

/**
 * Configuration for the Storecove ASP adapter.
 */
export interface StorecoveConfig {
  apiKey: string;
  baseUrl: string;
  webhookSecret?: string;
}

/**
 * Storecove document submission response.
 */
export interface StorecoveDocumentSubmission {
  guid: string;
  status: string;
  document_url?: string;
  created_at: string;
}

/**
 * Storecove legal entity (Peppol participant).
 */
export interface StorecoveLegalEntity {
  id: number;
  party_name: string;
  peppol_identifiers: Array<{
    identifier: string;
    scheme: string;
    superscheme: string;
  }>;
}

/**
 * Storecove received document (inbound invoice).
 */
export interface StorecoveReceivedDocument {
  guid: string;
  source: string;
  document: string;
  sender: {
    identifier: string;
    scheme: string;
  };
  created_at: string;
}

/**
 * Storecove webhook event payload.
 */
export interface StorecoveWebhookPayload {
  guid: string;
  event: string;
  document_guid?: string;
  document?: string;
}
