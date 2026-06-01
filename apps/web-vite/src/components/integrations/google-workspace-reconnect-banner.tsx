import type { ScopeCapabilities } from '@contractor-ops/db';
import { Alert, AlertDescription, AlertTitle } from '@contractor-ops/ui/components/shadcn/alert';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { AlertCircle } from 'lucide-react';
import { useTranslations } from '../../i18n/useTranslations.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Capability that Phase 76 (IdP deprovisioning) requires. Phase 70 only
 * surfaces the visibility prompt — the actual OAuth scope upgrade ships in
 * Phase 76. Once granted, this capability is written into
 * IntegrationConnection.scopeCapabilities and the banner self-removes.
 */
const REQUIRED_CAPABILITY = 'user.deprovision' as const;

/**
 * Phase 76 SC#3 — write capability granted by the additive `admin.directory.user`
 * scope. A connection that has `user.deprovision` (opted in) but lacks `directory.write`
 * is a v3.0 connection that still needs the write-access re-OAuth.
 */
const WRITE_CAPABILITY = 'directory.write' as const;

/**
 * Default OAuth start endpoint for the existing Google Workspace v3.0
 * connection flow. The Reconnect button just routes here with the EXISTING
 * scope set — Phase 70 ships ZERO new OAuth scopes (T-70-10-01).
 */
const DEFAULT_RECONNECT_HREF = '/api/oauth/google_workspace/start';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface GoogleWorkspaceReconnectBannerProps {
  /**
   * Parsed `IntegrationConnection.scopeCapabilities` JSONB column for the
   * Google Workspace connection. `null` indicates a legacy v3.0 connection
   * that pre-dates the D-13/D-14 capability tracking — banner is shown.
   */
  scopeCapabilities: ScopeCapabilities | null;
  /**
   * OAuth start URL. Defaults to the existing v3.0 endpoint; injectable for
   * tests and future re-routing without touching this component.
   */
  reconnectHref?: string;
}

/**
 * Phase 70 D-16 / FOUND6-05 — Banner shown above the Google Workspace
 * provider section when an existing v3.0 connection lacks the IdP
 * deprovisioning capability that Phase 76 will need.
 *
 * Visibility rules:
 *   - `scopeCapabilities === null` (legacy connection, never backfilled OR
 *     pre-D-14 grant) → show banner
 *   - `scopeCapabilities.capabilities` does NOT contain `'user.deprovision'`
 *     → show banner
 *   - capabilities contain `'user.deprovision'` → hide (already opted in)
 *
 * IMPORTANT: Phase 70 ships ZERO new OAuth scopes. The Reconnect button
 * routes to the EXISTING OAuth start URL with the EXISTING scope set.
 * Phase 76 (IdP deprovisioning) will upgrade the scope set, at which point
 * the Reconnect flow grants the new capability and the banner disappears.
 *
 * RTL-safety: only logical-property classes (`ps-`/`pe-`/`ms-`/`me-`) are
 * used. No physical-direction (`pl-`/`pr-`/`ml-`/`mr-`) spacing per the
 * Phase 56 RTL convention (PITFALLS P20).
 */
export function GoogleWorkspaceReconnectBanner({
  scopeCapabilities,
  reconnectHref = DEFAULT_RECONNECT_HREF,
}: GoogleWorkspaceReconnectBannerProps) {
  const t = useTranslations('Integrations.GoogleWorkspaceReconnect');

  const capabilities = scopeCapabilities?.capabilities ?? [];
  const hasDeprovision = capabilities.includes(REQUIRED_CAPABILITY);
  const hasWrite = capabilities.includes(WRITE_CAPABILITY);

  // State decision tree (Phase 76 SC#3 / T-76-08-04):
  //   1. null OR no `user.deprovision`        → "Reconnect required" (Phase 70 D-16; UNCHANGED)
  //   2. has `user.deprovision`, no `directory.write` → "Write access required" (Phase 76 NEW)
  //   3. has both                              → hidden
  const needsReconnect = scopeCapabilities === null || !hasDeprovision;
  const needsWriteAccess = hasDeprovision && !hasWrite;

  if (!(needsReconnect || needsWriteAccess)) {
    return null;
  }

  const titleKey = needsWriteAccess ? 'writeAccessTitle' : 'bannerTitle';
  const bodyKey = needsWriteAccess ? 'writeAccessBody' : 'bannerBody';
  const buttonKey = needsWriteAccess ? 'writeAccessButton' : 'reconnectButton';

  return (
    <Alert
      role="region"
      aria-label={t(titleKey)}
      className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/30">
      <AlertCircle className="text-amber-600 dark:text-amber-400" aria-hidden="true" />
      <div className="flex flex-col gap-2">
        <AlertTitle>{t(titleKey)}</AlertTitle>
        <AlertDescription>{t(bodyKey)}</AlertDescription>
        <Button render={<a href={reconnectHref} />} className="w-fit">
          {t(buttonKey)}
        </Button>
      </div>
    </Alert>
  );
}
