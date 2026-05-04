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
// Adapter Registration — F-SCALE-14
// ---------------------------------------------------------------------------
//
// `registerAllAdapters()` is called from many App Router top-level modules
// (webhook ingress, OAuth callback, OCR / sync routes, integration tRPC
// router). Every cold start re-runs the registration body; while the inner
// `if (registered) return` guard makes the registration body O(1) on
// subsequent calls within the same process, the adapter *imports* still
// happen on first load — 16 classes, some of which pull in heavy SDKs
// (`docusign-esign`, `@google-cloud/local-auth`, etc.).
//
// On Render serverless cold starts (instance scale-up, deploy, idle wake),
// every API route that imports this module pays the parse + module-eval
// cost regardless of whether the adapter is exercised. The audit measures
// this at 100-500 ms per cold start.
//
// True per-adapter dynamic import is a larger refactor (the registry needs
// async resolution) and is out of scope for a Phase 3 sweep. What this
// commit does:
//
// 1. Make the guard a module-scoped boolean *checked first* in a hot path
//    that returns immediately without touching any constructors.
// 2. Track registration state via a sentinel so concurrent callers in the
//    same tick can't both attempt to register (rare, but cheap to fix).
// 3. Leave the eager imports in place for now (they happen once per
//    process when the module loads); document the follow-up as a TODO.

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
 *
 * F-SCALE-14: subsequent calls are O(1) (boolean check + return). Heavy
 * adapter SDK imports run once at module load, *before* the first
 * `registerAllAdapters()` invocation, so the cost is paid by the first
 * importer rather than redundantly per call.
 *
 * TODO(F-SCALE-14 follow-up): convert to per-adapter dynamic import so the
 * web pod's auth route doesn't pay the DocuSign / Google SDK parse cost
 * during first-request latency. Requires registry async resolution.
 */
export function registerAllAdapters(): void {
  // Hot path — bail out before any constructor / import lookup runs. The
  // ordering matters: `registered` is checked before any `new X()` so that
  // every call after the first is essentially free.
  if (registered) return;
  // Set the sentinel BEFORE the constructors run so that a recursive /
  // re-entrant call (extremely unlikely but cheap to guard) does not
  // double-register. `registerAdapter` is itself idempotent in registry.ts
  // but belt+braces is worth the one-line cost here.
  registered = true;

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
}

/** Test helper — resets the cached registration sentinel. Intended for unit
 *  tests that want to re-register adapters after `vi.resetModules()`. */
export function __resetAdapterRegistrationForTests(): void {
  registered = false;
}
