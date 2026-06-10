import { Alert, AlertDescription, AlertTitle } from '@contractor-ops/ui/components/shadcn/alert';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import type {
  CapabilityEnum,
  ScopeCapabilities,
} from '@contractor-ops/validators/scope-capabilities';
import { AlertCircle } from 'lucide-react';
import { useId } from 'react';
import { useTranslations } from '../../i18n/useTranslations.js';

// ---------------------------------------------------------------------------
// Capability constants
// ---------------------------------------------------------------------------

/**
 * Capability granted once the admin opts into IdP deprovisioning. A connection
 * without it is read-only and must re-OAuth before deprovisioning can run.
 * `satisfies CapabilityEnum` guards against drift from the shared scope schema.
 */
const REQUIRED_CAPABILITY = 'user.deprovision' satisfies CapabilityEnum;

/**
 * Write capability granted by the additive `admin.directory.user` scope. A
 * connection that has `user.deprovision` but lacks this still needs the
 * write-access re-OAuth.
 */
const WRITE_CAPABILITY = 'directory.write' satisfies CapabilityEnum;

/**
 * OAuth start endpoint for the Google Workspace connection flow. The reconnect
 * button routes here with the existing scope set; the server adds any extra
 * consent prompt for the write-access upgrade.
 */
const DEFAULT_RECONNECT_HREF = '/api/oauth/google_workspace/start';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface GoogleWorkspaceReconnectBannerProps {
  /**
   * Parsed `IntegrationConnection.scopeCapabilities` for the Google Workspace
   * connection. `null` means a connection with no capability record yet — the
   * banner is shown so the admin can re-grant.
   */
  scopeCapabilities: ScopeCapabilities | null;
  /**
   * OAuth start URL. Defaults to the standard endpoint; injectable for tests
   * and future re-routing without touching this component.
   */
  reconnectHref?: string;
}

/**
 * Banner shown above the Google Workspace provider section when a connection
 * lacks a capability that IdP deprovisioning needs.
 *
 * Visibility:
 *   - `scopeCapabilities === null` → show "Reconnect required"
 *   - capabilities lack `user.deprovision` → show "Reconnect required"
 *   - has `user.deprovision` but lacks `directory.write` → show "Write access required"
 *   - has both → hidden
 *
 * The reconnect button routes to the existing OAuth start URL; the server
 * upgrades the scope set and grants the new capability, after which the banner
 * self-removes.
 *
 * RTL-safe: spacing uses logical-property classes only (`ps-`/`pe-`/`ms-`/`me-`),
 * never physical (`pl-`/`pr-`/`ml-`/`mr-`).
 */
export function GoogleWorkspaceReconnectBanner({
  scopeCapabilities,
  reconnectHref = DEFAULT_RECONNECT_HREF,
}: GoogleWorkspaceReconnectBannerProps) {
  const t = useTranslations('Integrations.GoogleWorkspaceReconnect');
  const titleId = useId();

  const capabilities = scopeCapabilities?.capabilities ?? [];
  const hasDeprovision = capabilities.includes(REQUIRED_CAPABILITY);
  const hasWrite = capabilities.includes(WRITE_CAPABILITY);

  // Reconnect when there is no capability record or deprovision was never
  // granted; prompt for write access once deprovision is present but write is not.
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
      aria-labelledby={titleId}
      className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/30">
      <AlertCircle className="text-amber-600 dark:text-amber-400" aria-hidden="true" />
      <div className="flex flex-col gap-2">
        <AlertTitle id={titleId}>{t(titleKey)}</AlertTitle>
        <AlertDescription>{t(bodyKey)}</AlertDescription>
        <Button render={<a href={reconnectHref} />} className="w-fit">
          {t(buttonKey)}
        </Button>
      </div>
    </Alert>
  );
}
