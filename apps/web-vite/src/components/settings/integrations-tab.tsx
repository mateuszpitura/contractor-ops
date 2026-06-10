import { KsefBrandIcon, SlackBrandIcon } from '../integrations/brand-icons';
import { EntraProviderSection } from '../integrations/entra-provider-section.js';
import { GitHubProviderSection } from '../integrations/github-provider-section.js';
import { GoogleWorkspaceProviderSection } from '../integrations/google-workspace-provider-section.js';
import { JiraLogo } from '../integrations/jira-logo.js';
import { JiraProviderSection } from '../integrations/jira-provider-section.js';
import { LinearProviderSection } from '../integrations/linear-provider-section.js';
import { OktaProviderSection } from '../integrations/okta-provider-section.js';
import { ConfluenceIcon, NotionIcon } from '../integrations/provider-icons.js';
import { TeamsProviderSection } from '../integrations/teams-provider-section.js';
import { PeppolStatusCard } from '../peppol/peppol-status-card.js';
import { ZatcaStatusCard } from '../zatca/zatca-status-card.js';
import { DpdProviderSection } from './dpd-provider-section.js';
import type { IntegrationsTabProps } from './hooks/use-integrations-tab.js';
import { useIntegrationsTab } from './hooks/use-integrations-tab.js';
import { IdpDeprovisioningToggleTable } from './idp-deprovisioning-toggle-table.js';
import { KsefProviderSection } from './ksef-provider-section.js';
import { OrgCalendarSection } from './org-calendar-section.js';
import { ProviderConnectionCard } from './provider-connection-card.js';
import { SlackOrgGridCard } from './slack-org-grid-card.js';
import { SlackSyncButton } from './slack-sync-button.js';
import { SlackUserMapping } from './slack-user-mapping.js';
import { UpsProviderSection } from './ups-provider-section.js';

// ---------------------------------------------------------------------------
// Provider registry for UI (static for now, will be dynamic in future phases)
// ---------------------------------------------------------------------------

const PROVIDER_CONFIG = [
  {
    provider: 'slack',
    displayName: 'Slack',
    icon: <SlackBrandIcon className="size-8" />,
    descriptionKey: 'slack.descriptionDisconnected' as const,
  },
  {
    provider: 'ksef',
    displayName: 'KSeF',
    icon: <KsefBrandIcon className="size-8" />,
    descriptionKey: 'ksef.descriptionDisconnected' as const,
  },
  {
    provider: 'jira',
    displayName: 'Jira',
    icon: <JiraLogo className="size-8" />,
    descriptionKey: 'jira.descriptionDisconnected' as const,
  },
];

export type { IntegrationsTabProps };

export function IntegrationsTab() {
  const tab = useIntegrationsTab();
  return <IntegrationsTabView {...tab} />;
}

export function IntegrationsTabView({ t, isSlackConnected }: IntegrationsTabProps) {
  // Non-KSeF/Jira providers (rendered separately for custom behavior)
  const standardProviders = PROVIDER_CONFIG.filter(
    c => c.provider !== 'ksef' && c.provider !== 'jira',
  );

  return (
    <div className="space-y-8">
      {/* Provider cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {standardProviders.map(config => (
          <ProviderConnectionCard
            key={config.provider}
            provider={config.provider}
            displayName={config.displayName}
            icon={config.icon}
            description={t(config.descriptionKey)}
          />
        ))}

        {/* KSeF has custom connect dialog + sync controls */}
        <KsefProviderSection />

        {/* ZATCA (Saudi Arabia) has onboarding wizard + status card */}
        <ZatcaStatusCard />

        {/* Peppol (UAE) has custom wizard + status card */}
        <PeppolStatusCard />

        {/* Jira has custom status mapping controls */}
        <JiraProviderSection />

        {/* Linear has custom status mapping controls (D-03, D-11: coexists with Jira) */}
        <LinearProviderSection />

        {/* Google Workspace has directory import wizard */}
        <GoogleWorkspaceProviderSection />

        {/* Phase 77 D-14 — Slack Org-Grid deprovisioning connection (second Slack card) */}
        <SlackOrgGridCard />

        {/* Microsoft Teams integration with channel mapping */}
        <TeamsProviderSection />

        {/* DPD courier integration */}
        <DpdProviderSection />

        {/* UPS courier integration */}
        <UpsProviderSection />

        {/* Notion provider card */}
        <ProviderConnectionCard
          provider="notion"
          displayName="Notion"
          icon={<NotionIcon className="size-8" />}
          description={t('provider.connectCta', { provider: 'Notion' })}
        />

        {/* Confluence provider card */}
        <ProviderConnectionCard
          provider="confluence"
          displayName="Confluence"
          icon={<ConfluenceIcon className="size-8" />}
          description={t('provider.connectCta', {
            provider: 'Confluence',
          })}
        />
      </div>

      {/* Phase 77 D-15 / Phase 78 D-12 — per-provider IdP deprovisioning */}
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-medium">{t('idpDeprovisioning.heading')}</h3>
          <p className="text-sm text-muted-foreground">{t('idpDeprovisioning.description')}</p>
        </div>

        {/* Phase 78 — Entra ID / Okta / GitHub deprovisioning provider cards */}
        <div className="grid gap-4 md:grid-cols-1">
          <EntraProviderSection />
          <OktaProviderSection />
          <GitHubProviderSection />
        </div>

        <IdpDeprovisioningToggleTable />
      </section>

      {/* Organization shared calendar section */}
      <OrgCalendarSection />

      {/* Slack-specific user mapping (preserved for backward compatibility) */}
      {isSlackConnected && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <SlackSyncButton />
          </div>
          <SlackUserMapping />
        </div>
      )}
    </div>
  );
}
