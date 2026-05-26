/**
 * Ported from apps/web/src/components/contracts/contract-detail/__tests__/contract-detail-tabs.test.tsx.
 *
 * Web-vite split: ContractDetailTabs renders Container components for each
 * tab. We mock containers + the underlying `useContractDetailTabs` hook so
 * the test focuses on the tabs surface itself.
 */

import { vi } from 'vitest';
import { render, screen } from '@/test/test-utils';

vi.mock('../overview-tab-container.js', () => {
  const React = require('react');
  return {
    OverviewTabContainer: () =>
      React.createElement('div', { 'data-testid': 'overview' }, 'Overview'),
  };
});
vi.mock('../documents-tab-container.js', () => {
  const React = require('react');
  return {
    DocumentsTabContainer: () =>
      React.createElement('div', { 'data-testid': 'documents' }, 'Documents'),
  };
});
vi.mock('../amendments-tab-container.js', () => {
  const React = require('react');
  return {
    AmendmentsTabContainer: () =>
      React.createElement('div', { 'data-testid': 'amendments' }, 'Amendments'),
  };
});
vi.mock('../activity-tab.js', () => {
  const React = require('react');
  return {
    ActivityTab: () => React.createElement('div', { 'data-testid': 'activity' }, 'Activity'),
  };
});
vi.mock('../linear-linked-issues-panel-container.js', () => ({
  LinearLinkedIssuesPanelContainer: () => null,
}));
vi.mock('../../hooks/use-contract-detail-tabs.js', () => ({
  useContractDetailTabs: () => ({
    tabKeys: ['overview', 'documents', 'amendments', 'activity'],
    currentTab: 'overview',
    setTab: vi.fn(),
    taskRunIds: [],
  }),
}));

import { ContractDetailTabs } from '../contract-detail-tabs';

describe('ContractDetailTabs', () => {
  const contract = {
    id: 'ct1',
    contractor: {
      displayName: 'ACME',
      email: 'test@acme.pl',
    },
  };

  it('renders all 4 tab triggers', () => {
    render(<ContractDetailTabs contract={contract as never} contractParties={[]} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(4);
  });

  it('shows overview content by default', () => {
    render(<ContractDetailTabs contract={contract as never} contractParties={[]} />);
    expect(screen.getByTestId('overview')).toBeInTheDocument();
  });
});
