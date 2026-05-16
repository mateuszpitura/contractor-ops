import {
  registerAdapter,
  registerCompanyRegistryAdapter,
  registerOcrAdapter,
} from '../registry.js';
import { ClaudeOcrAdapter } from './claude-ocr-adapter.js';
import { DataportCompanyRegistryAdapter } from './dataport-company-registry-adapter.js';
import { KsefAdapter } from './ksef-adapter.js';
import { ResendAdapter } from './resend-adapter.js';
import { SlackAdapter } from './slack-adapter.js';

// ---------------------------------------------------------------------------
// Adapter Registration — F-SCALE-14
// ---------------------------------------------------------------------------
//
// Cold-start cost split into two tiers:
//
//   1. ESSENTIAL (eager, sync): Slack + Resend + KSeF + the Claude Vision
//      OCR adapter. These power the webhook-ingress path
//      (`/api/webhooks/[provider]`), the email-intake / Resend processing
//      path, and the daily KSeF poller — all of which must work on the
//      very first request after a cold start without an extra await. Their
//      modules are small (a few hundred lines + node:crypto) so the cost
//      to module-eval them is negligible.
//
//   2. HEAVY (lazy, dynamic import): every other provider. Each one pulls
//      in a vendor SDK or a sizeable client class:
//        - docusign-adapter → docusign-esign SDK (~2 MB module graph)
//        - google-workspace-adapter → google-auth-library + admin SDK
//        - google-calendar / outlook-calendar → graph SDK shapes
//        - jira / linear / notion / confluence → custom REST clients
//        - autenti / clockify / teams → vendor-specific clients
//      These were previously imported eagerly at the top of this file,
//      so every cold start of every route that called
//      `registerAllAdapters()` paid the full ~100-500 ms parse + module-
//      eval cost (audit measurement; see .audit-2026-05-03/06-scalability
//      F-SCALE-14).
//
// Public API:
//   - `registerAllAdapters()` — backwards-compatible sync entry point.
//     Eagerly registers the ESSENTIAL tier and kicks off the HEAVY tier
//     load as a fire-and-forget background task. Routes that only ever
//     touch ESSENTIAL adapters (the webhook ingress, the email-intake)
//     never block on the heavy load and get the full cold-start win.
//   - `loadHeavyAdapters()` — async helper that returns a promise resolving
//     once every HEAVY adapter is registered. Routes that need a heavy
//     adapter (OAuth callback for DocuSign, Linear webhook _process,
//     Google Workspace sync) `await loadHeavyAdapters()` before calling
//     `getAdapter(slug)` to avoid a race on the first request.
//
// The dynamic `import()` boundary lets Next.js / Webpack split each heavy
// adapter into its own chunk, so routes that don't reach the lazy code
// path never bundle the heavy SDKs into their server-side output. This is
// the key cold-start win for the F-SCALE-14 fix.

let registered = false;
let heavyLoadPromise: Promise<void> | null = null;

/**
 * Internal: starts (or returns the in-flight) HEAVY-tier dynamic import.
 *
 * This is invoked eagerly at module load (see the bottom of this file)
 * so the heavy SDKs are fetched in parallel with the rest of the request
 * pipeline rather than blocking the first call to `getAdapter('docusign')`.
 * On a cold start, the dynamic-import chunks are local-filesystem reads
 * (no network), so they typically resolve in <10 ms — well before any
 * route handler reaches an await on a heavy adapter.
 */
function startHeavyLoad(): Promise<void> {
  if (heavyLoadPromise) return heavyLoadPromise;
  heavyLoadPromise = (async () => {
    const [
      { DocuSignAdapter },
      { AutentiAdapter },
      { ClockifyAdapter },
      { JiraAdapter },
      { NotionAdapter },
      { ConfluenceAdapter },
      { GoogleCalendarAdapter },
      { GoogleWorkspaceAdapter },
      { OutlookCalendarAdapter },
      { LinearAdapter },
      { TeamsAdapter },
      { Bir1CompanyRegistryAdapter },
    ] = await Promise.all([
      import('./docusign-adapter.js'),
      import('./autenti-adapter.js'),
      import('./clockify-adapter.js'),
      import('./jira-adapter.js'),
      import('./notion-adapter.js'),
      import('./confluence-adapter.js'),
      import('./google-calendar-adapter.js'),
      import('./google-workspace-adapter.js'),
      import('./outlook-calendar-adapter.js'),
      import('./linear-adapter.js'),
      import('./teams-adapter.js'),
      import('./bir1-company-registry-adapter.js'),
    ]);
    registerAdapter(new DocuSignAdapter());
    registerAdapter(new AutentiAdapter());
    registerAdapter(new ClockifyAdapter());
    registerAdapter(new JiraAdapter());
    registerAdapter(new NotionAdapter());
    registerAdapter(new ConfluenceAdapter());
    registerAdapter(new GoogleCalendarAdapter());
    registerAdapter(new GoogleWorkspaceAdapter());
    registerAdapter(new OutlookCalendarAdapter());
    registerAdapter(new LinearAdapter());
    registerAdapter(new TeamsAdapter());
    // Bir1 wraps a SOAP client (`bir1` npm package). Lazy-loaded so the SOAP
    // module graph stays out of cold-start for routes that only ever use the
    // (default) dataport adapter.
    registerCompanyRegistryAdapter(new Bir1CompanyRegistryAdapter());
  })();
  return heavyLoadPromise;
}

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
 * F-SCALE-14: ESSENTIAL adapters (Slack, Resend, KSeF, OCR) register
 * synchronously. HEAVY adapters (DocuSign, Notion, Confluence, Jira,
 * Linear, Google Workspace, Google/Outlook Calendar, Autenti, Clockify,
 * Teams) are loaded via dynamic `import()` triggered eagerly at module
 * load. Routes that need a heavy adapter on the first request can `await
 * loadHeavyAdapters()` to be deterministic about availability.
 */
export function registerAllAdapters(): void {
  // Hot path — bail out before any constructor / import lookup runs.
  if (registered) return;
  // Set the sentinel BEFORE the constructors run so a re-entrant call
  // doesn't double-register. `registerAdapter` is itself idempotent in
  // registry.ts but belt+braces is worth the one-line cost.
  registered = true;

  // ESSENTIAL tier — eagerly registered synchronously.
  registerAdapter(new SlackAdapter());
  registerAdapter(new ResendAdapter());
  registerAdapter(new KsefAdapter());
  registerOcrAdapter(new ClaudeOcrAdapter());
  // Default Polish company-registry adapter (dev). Pure-fetch, no SDK pull,
  // safe for cold-start and the only one wired for the free-tier dev flow.
  registerCompanyRegistryAdapter(new DataportCompanyRegistryAdapter());

  // HEAVY tier — load already kicked off at module load (see bottom of
  // this file). The promise is shared with `loadHeavyAdapters()` so
  // callers that want determinism can await it.
  void startHeavyLoad();
}

/**
 * Returns a promise that resolves once every HEAVY-tier adapter is
 * registered. Routes that touch a heavy adapter on first request must
 * await this to avoid a race against the eager background load.
 *
 * ```ts
 * registerAllAdapters();
 * await loadHeavyAdapters();
 * const adapter = getAdapter('docusign');
 * ```
 *
 * Routes that only ever touch ESSENTIAL adapters (e.g. the Slack webhook
 * ingress) do not need to await — the background load runs harmlessly on
 * its own and they remain on the fully-synchronous fast path.
 */
export function loadHeavyAdapters(): Promise<void> {
  return startHeavyLoad();
}

/** Test helper — resets the cached registration sentinels. Intended for
 *  unit tests that want to re-register adapters after `vi.resetModules()`. */
export function __resetAdapterRegistrationForTests(): void {
  registered = false;
  heavyLoadPromise = null;
}

// Eagerly kick off the heavy adapter load at module evaluation time. This
// runs in parallel with the rest of route bootstrap (Prisma init, auth
// init, etc.) so by the time a request handler reaches a `getAdapter`
// call the heavy modules are typically already registered. Routes that
// must be deterministic still `await loadHeavyAdapters()`.
void startHeavyLoad();
