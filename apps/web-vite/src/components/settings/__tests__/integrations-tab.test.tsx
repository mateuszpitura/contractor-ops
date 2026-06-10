/**
 * The tab composes ~15 provider containers that each call tRPC at module
 * eval. We stub them all so the test verifies the layout-level wiring:
 * the standard provider grid renders, and the Slack-specific mapping
 * section is only mounted when `isSlackConnected` is true.
 */

import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../integrations/google-workspace-provider-section', () => ({
  GoogleWorkspaceProviderSection: () => null,
}));
vi.mock('../../integrations/jira-provider-section', () => ({
  JiraProviderSection: () => null,
}));
vi.mock('../../integrations/linear-provider-section', () => ({
  LinearProviderSection: () => null,
}));
vi.mock('../../integrations/teams-provider-section', () => ({
  TeamsProviderSection: () => null,
}));
vi.mock('../../peppol/peppol-status-card', () => ({
  PeppolStatusCard: () => null,
}));
vi.mock('../../zatca/zatca-status-card', () => ({
  ZatcaStatusCard: () => null,
}));
vi.mock('../dpd-provider-section.js', () => ({
  DpdProviderSection: () => null,
}));
vi.mock('../ups-provider-section.js', () => ({
  UpsProviderSection: () => null,
}));
vi.mock('../ksef-provider-section.js', () => ({
  KsefProviderSection: () => null,
}));
vi.mock('../org-calendar-section.js', () => ({
  OrgCalendarSection: () => <div data-testid="org-calendar" />,
}));
vi.mock('../provider-connection-card.js', () => ({
  ProviderConnectionCard: ({
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
vi.mock('../slack-sync-button.js', () => ({
  SlackSyncButton: () => <div data-testid="slack-sync-button" />,
}));
vi.mock('../slack-user-mapping.js', () => ({
  SlackUserMapping: () => <div data-testid="slack-user-mapping" />,
}));
vi.mock('../slack-org-grid-card.js', () => ({
  SlackOrgGridCard: () => <div data-testid="slack-org-grid" />,
}));
vi.mock('../idp-deprovisioning-toggle-table.js', () => ({
  IdpDeprovisioningToggleTable: () => <div data-testid="idp-toggle-table" />,
}));
vi.mock('../../integrations/entra-provider-section', () => ({
  EntraProviderSection: () => <div data-testid="entra-section" />,
}));
vi.mock('../../integrations/okta-provider-section', () => ({
  OktaProviderSection: () => <div data-testid="okta-section" />,
}));
vi.mock('../../integrations/github-provider-section', () => ({
  GitHubProviderSection: () => <div data-testid="github-section" />,
}));

import { render, screen } from '@/test/test-utils';
import { IntegrationsTabView } from '../integrations-tab';

const tStub = (key: string) => key;

describe('IntegrationsTabView', () => {
  it('renders the standard provider cards and the org calendar section', () => {
    render(<IntegrationsTabView t={tStub as never} isSlackConnected={false} />);

    expect(screen.getByTestId('provider-card-Slack')).toBeInTheDocument();
    expect(screen.getByTestId('provider-card-Notion')).toBeInTheDocument();
    expect(screen.getByTestId('provider-card-Confluence')).toBeInTheDocument();
    expect(screen.getByTestId('org-calendar')).toBeInTheDocument();
  });

  it('hides Slack user-mapping section when Slack is not connected', () => {
    render(<IntegrationsTabView t={tStub as never} isSlackConnected={false} />);

    expect(screen.queryByTestId('slack-user-mapping')).not.toBeInTheDocument();
    expect(screen.queryByTestId('slack-sync-button')).not.toBeInTheDocument();
  });

  it('renders Slack user-mapping section when Slack is connected', () => {
    render(<IntegrationsTabView t={tStub as never} isSlackConnected />);

    expect(screen.getByTestId('slack-user-mapping')).toBeInTheDocument();
    expect(screen.getByTestId('slack-sync-button')).toBeInTheDocument();
  });
});
