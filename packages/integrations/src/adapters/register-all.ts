import { registerAdapter } from "../registry.js";
import { SlackAdapter } from "./slack-adapter.js";
import { ResendAdapter } from "./resend-adapter.js";

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

  registered = true;
}
