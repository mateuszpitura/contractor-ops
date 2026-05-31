import { KsefBrandIcon, SlackBrandIcon } from '../integrations/brand-icons';
import { GoogleWorkspaceProviderSection } from '../integrations/google-workspace-provider-section-container.js';
import { JiraLogo } from '../integrations/jira-logo.js';
import { JiraProviderSection } from '../integrations/jira-provider-section-container.js';
import { LinearProviderSection } from '../integrations/linear-provider-section-container.js';
import { ConfluenceIcon, NotionIcon } from '../integrations/provider-icons.js';
import { TeamsProviderSection } from '../integrations/teams-provider-section-container.js';
import { PeppolStatusCardContainer } from '../peppol/peppol-status-card-container';
import { ZatcaStatusCard } from '../zatca/zatca-status-card-container.js';
import { DpdProviderSectionContainer } from './dpd-provider-section-container.js';
import type { IntegrationsTabProps } from './hooks/use-integrations-tab.js';
import { IdpDeprovisioningToggleTableContainer } from './idp-deprovisioning-toggle-table-container.js';
import { KsefProviderSectionContainer } from './ksef-provider-section-container.js';
import { OrgCalendarSectionContainer } from './org-calendar-section-container.js';
import { ProviderConnectionCardContainer } from './provider-connection-card-container.js';
import { SlackOrgGridCardContainer } from './slack-org-grid-card-container.js';
import { SlackSyncButtonContainer } from './slack-sync-button-container.js';
import { SlackUserMappingContainer } from './slack-user-mapping-container.js';
import { UpsProviderSectionContainer } from './ups-provider-section-container.js';

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

export function IntegrationsTab({ t, isSlackConnected }: IntegrationsTabProps) {
  // Non-KSeF/Jira providers (rendered separately for custom behavior)
  const standardProviders = PROVIDER_CONFIG.filter(
    c => c.provider !== 'ksef' && c.provider !== 'jira',
  );

  return (
    <div className="space-y-8">
      {/* Provider cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {standardProviders.map(config => (
          <ProviderConnectionCardContainer
            key={config.provider}
            provider={config.provider}
            displayName={config.displayName}
            icon={config.icon}
            description={t(config.descriptionKey)}
          />
        ))}

        {/* KSeF has custom connect dialog + sync controls */}
        <KsefProviderSectionContainer />

        {/* ZATCA (Saudi Arabia) has onboarding wizard + status card */}
        <ZatcaStatusCard />

        {/* Peppol (UAE) has custom wizard + status card */}
        <PeppolStatusCardContainer />

        {/* Jira has custom status mapping controls */}
        <JiraProviderSection />

        {/* Linear has custom status mapping controls (D-03, D-11: coexists with Jira) */}
        <LinearProviderSection />

        {/* Google Workspace has directory import wizard */}
        <GoogleWorkspaceProviderSection />

        {/* Phase 77 D-14 — Slack Org-Grid deprovisioning connection (second Slack card) */}
        <SlackOrgGridCardContainer />

        {/* Microsoft Teams integration with channel mapping */}
        <TeamsProviderSection />

        {/* DPD courier integration */}
        <DpdProviderSectionContainer />

        {/* UPS courier integration */}
        <UpsProviderSectionContainer />

        {/* Notion provider card */}
        <ProviderConnectionCardContainer
          provider="notion"
          displayName="Notion"
          icon={<NotionIcon className="size-8" />}
          description={t('provider.connectCta', { provider: 'Notion' })}
        />

        {/* Confluence provider card */}
        <ProviderConnectionCardContainer
          provider="confluence"
          displayName="Confluence"
          icon={<ConfluenceIcon className="size-8" />}
          description={t('provider.connectCta', {
            provider: 'Confluence',
          })}
        />
      </div>

      {/* Phase 77 D-15 — per-provider IdP deprovisioning enable matrix */}
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-medium">{t('idpDeprovisioning.heading')}</h3>
          <p className="text-sm text-muted-foreground">{t('idpDeprovisioning.description')}</p>
        </div>
        <IdpDeprovisioningToggleTableContainer />
      </section>

      {/* Organization shared calendar section */}
      <OrgCalendarSectionContainer />

      {/* Slack-specific user mapping (preserved for backward compatibility) */}
      {isSlackConnected && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <SlackSyncButtonContainer />
          </div>
          <SlackUserMappingContainer />
        </div>
      )}
    </div>
  );
}
