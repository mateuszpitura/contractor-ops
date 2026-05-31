/**
 * Web-vite port of apps/web/src/components/settings/__tests__/integrations-tab.test.tsx.
 *
 * The tab composes ~15 provider containers that each call tRPC at module
 * eval. We stub them all so the test verifies the layout-level wiring:
 * the standard provider grid renders, and the Slack-specific mapping
 * section is only mounted when `isSlackConnected` is true.
 */

import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../integrations/google-workspace-provider-section-container', () => ({
  GoogleWorkspaceProviderSection: () => null,
}));
vi.mock('../../integrations/jira-provider-section-container', () => ({
  JiraProviderSection: () => null,
}));
vi.mock('../../integrations/linear-provider-section-container', () => ({
  LinearProviderSection: () => null,
}));
vi.mock('../../integrations/teams-provider-section-container', () => ({
  TeamsProviderSection: () => null,
}));
vi.mock('../../peppol/peppol-status-card-container', () => ({
  PeppolStatusCardContainer: () => null,
}));
vi.mock('../../zatca/zatca-status-card-container', () => ({
  ZatcaStatusCard: () => null,
}));
vi.mock('../dpd-provider-section-container', () => ({
  DpdProviderSectionContainer: () => null,
}));
vi.mock('../ups-provider-section-container', () => ({
  UpsProviderSectionContainer: () => null,
}));
vi.mock('../ksef-provider-section-container', () => ({
  KsefProviderSectionContainer: () => null,
}));
vi.mock('../org-calendar-section-container', () => ({
  OrgCalendarSectionContainer: () => <div data-testid="org-calendar" />,
}));
vi.mock('../provider-connection-card-container', () => ({
  ProviderConnectionCardContainer: ({
    displayName,
    description,
  }: {
    displayName: string;
    description: ReactNode;
  }) => (
    <div data-testid={`provider-card-${displayName}`}>
      <span>{displayName}</span>
      <span>{description}</span>
    </div>
  ),
}));
vi.mock('../slack-sync-button-container', () => ({
  SlackSyncButtonContainer: () => <div data-testid="slack-sync-button" />,
}));
vi.mock('../slack-user-mapping-container', () => ({
  SlackUserMappingContainer: () => <div data-testid="slack-user-mapping" />,
}));
vi.mock('../slack-org-grid-card-container', () => ({
  SlackOrgGridCardContainer: () => <div data-testid="slack-org-grid" />,
}));
vi.mock('../idp-deprovisioning-toggle-table-container', () => ({
  IdpDeprovisioningToggleTableContainer: () => <div data-testid="idp-toggle-table" />,
}));
vi.mock('../../integrations/entra-provider-section-container', () => ({
  EntraProviderSection: () => <div data-testid="entra-section" />,
}));
vi.mock('../../integrations/okta-provider-section-container', () => ({
  OktaProviderSection: () => <div data-testid="okta-section" />,
}));
vi.mock('../../integrations/github-provider-section-container', () => ({
  GitHubProviderSection: () => <div data-testid="github-section" />,
}));

import { render, screen } from '@/test/test-utils';
import { IntegrationsTab } from '../integrations-tab';

const tStub = (key: string) => key;

describe('IntegrationsTab', () => {
  it('renders the standard provider cards and the org calendar section', () => {
    render(<IntegrationsTab t={tStub as never} isSlackConnected={false} />);

    expect(screen.getByTestId('provider-card-Slack')).toBeInTheDocument();
    expect(screen.getByTestId('provider-card-Notion')).toBeInTheDocument();
    expect(screen.getByTestId('provider-card-Confluence')).toBeInTheDocument();
    expect(screen.getByTestId('org-calendar')).toBeInTheDocument();
  });

  it('hides Slack user-mapping section when Slack is not connected', () => {
    render(<IntegrationsTab t={tStub as never} isSlackConnected={false} />);

    expect(screen.queryByTestId('slack-user-mapping')).not.toBeInTheDocument();
    expect(screen.queryByTestId('slack-sync-button')).not.toBeInTheDocument();
  });

  it('renders Slack user-mapping section when Slack is connected', () => {
    render(<IntegrationsTab t={tStub as never} isSlackConnected />);

    expect(screen.getByTestId('slack-user-mapping')).toBeInTheDocument();
    expect(screen.getByTestId('slack-sync-button')).toBeInTheDocument();
  });
});
