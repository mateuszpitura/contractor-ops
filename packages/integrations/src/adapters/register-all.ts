import type { IntegrationProviderAdapter } from "../types/provider.js";
import { registerAdapter } from "../registry.js";
import { SlackAdapter } from "./slack-adapter.js";
import { ResendAdapter } from "./resend-adapter.js";
import { DocuSignAdapter } from "./docusign-adapter.js";
import { AutentiAdapter } from "./autenti-adapter.js";
import { ClaudeOcrAdapter } from "./claude-ocr-adapter.js";

// ---------------------------------------------------------------------------
// Adapter Registration
// ---------------------------------------------------------------------------

let registered = false;

/**
 * Registers all provider adapters with the global registry.
 * Safe to call multiple times — only registers on the first call.
 */
export function registerAllAdapters(): void {
  if (registered) return;

  registerAdapter(new SlackAdapter());
  registerAdapter(new ResendAdapter());
  registerAdapter(new DocuSignAdapter());
  registerAdapter(new AutentiAdapter());
  registerAdapter(
    new ClaudeOcrAdapter() as unknown as IntegrationProviderAdapter,
  );

  registered = true;
}
