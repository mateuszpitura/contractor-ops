import { registerAdapter, registerOcrAdapter } from '../registry.js';
import { AutentiAdapter } from './autenti-adapter.js';
import { ClaudeOcrAdapter } from './claude-ocr-adapter.js';
import { ClockifyAdapter } from './clockify-adapter.js';
import { ConfluenceAdapter } from './confluence-adapter.js';
import { DocuSignAdapter } from './docusign-adapter.js';
import { GoogleCalendarAdapter } from './google-calendar-adapter.js';
import { GoogleWorkspaceAdapter } from './google-workspace-adapter.js';
import { JiraAdapter } from './jira-adapter.js';
import { KsefAdapter } from './ksef-adapter.js';
import { LinearAdapter } from './linear-adapter.js';
import { NotionAdapter } from './notion-adapter.js';
import { OutlookCalendarAdapter } from './outlook-calendar-adapter.js';
import { ResendAdapter } from './resend-adapter.js';
import { SlackAdapter } from './slack-adapter.js';
import { TeamsAdapter } from './teams-adapter.js';

// ---------------------------------------------------------------------------
// Adapter Registration
// ---------------------------------------------------------------------------

let registered = false;

/**
 * Registers all provider adapters with the global registries.
 *
 * - Integration provider adapters (OAuth + webhooks + health) are registered
 *   in the main provider registry consumed by `getAllAdapters()` and
 *   `getProviderHealth()`.
 * - OCR-only adapters (e.g. Claude Vision) are registered in the dedicated
 *   OCR registry. They have no IntegrationConnection row and must NOT be
 *   surfaced to the health-service which would query Prisma with a
 *   non-existent provider enum.
 *
 * Safe to call multiple times — only registers on the first call.
 */
export function registerAllAdapters(): void {
  if (registered) return;

  // True integration provider adapters
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
  registerAdapter(new TeamsAdapter());

  // OCR-only adapters (separate registry — no Prisma connection rows)
  registerOcrAdapter(new ClaudeOcrAdapter());

  registered = true;
}
