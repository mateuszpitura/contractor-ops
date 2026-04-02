import type { IntegrationProviderAdapter } from "../types/provider.js";
import { registerAdapter } from "../registry.js";
import { SlackAdapter } from "./slack-adapter.js";
import { ResendAdapter } from "./resend-adapter.js";
import { DocuSignAdapter } from "./docusign-adapter.js";
import { AutentiAdapter } from "./autenti-adapter.js";
import { KsefAdapter } from "./ksef-adapter.js";
import { ClockifyAdapter } from "./clockify-adapter.js";
import { JiraAdapter } from "./jira-adapter.js";
import { NotionAdapter } from "./notion-adapter.js";
import { ConfluenceAdapter } from "./confluence-adapter.js";
import { GoogleCalendarAdapter } from "./google-calendar-adapter.js";
import { GoogleWorkspaceAdapter } from "./google-workspace-adapter.js";
import { OutlookCalendarAdapter } from "./outlook-calendar-adapter.js";
import { LinearAdapter } from "./linear-adapter.js";
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
  registerAdapter(new KsefAdapter());
  registerAdapter(new ClockifyAdapter());
  registerAdapter(new JiraAdapter());
  registerAdapter(new NotionAdapter());
  registerAdapter(new ConfluenceAdapter());
  registerAdapter(new GoogleCalendarAdapter());
  registerAdapter(new GoogleWorkspaceAdapter());
  registerAdapter(new OutlookCalendarAdapter());
  registerAdapter(new LinearAdapter());
  registerAdapter(new ClaudeOcrAdapter() as unknown as IntegrationProviderAdapter);

  registered = true;
}
