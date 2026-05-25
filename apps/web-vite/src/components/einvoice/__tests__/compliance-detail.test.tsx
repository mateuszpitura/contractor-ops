/**
 * Step 10 port of apps/web/src/components/einvoice/__tests__/compliance-detail.test.tsx.
 *
 * Post-passthrough refactor: the container `EInvoiceComplianceDetail` now
 * branches on `isLoading` and empty `statuses`, rendering one of three
 * presentational siblings — `EInvoiceComplianceDetailSkeleton`,
 * `EInvoiceComplianceDetailEmpty`, or `EInvoiceComplianceDetailView`.
 * These tests drive each sibling directly — no tRPC / React Query mocks.
 * Hook coverage lives in `hooks/__tests__/use-einvoice-compliance-detail.test.tsx`.
 */

import type { ComplianceStatus } from '@contractor-ops/einvoice/compliance';
import { afterEach, describe, expect, it } from 'vitest';
import type { EInvoiceComplianceDetailViewProps } from '../compliance-detail.js';
import {
  EInvoiceComplianceDetailEmpty,
  EInvoiceComplianceDetailSkeleton,
  EInvoiceComplianceDetailView,
} from '../compliance-detail.js';
import { findByText, mount } from './_render.js';

function makeStatus(overrides: Partial<ComplianceStatus> = {}): ComplianceStatus {
  return {
    profileId: 'pl-1',
    state: 'active',
    country: 'PL',
    displayName: 'KSeF Poland',
    healthScore: 95,
    capabilities: {
      canGenerate: true,
      canParse: true,
      canSign: true,
      canQRCode: false,
    },
    ...overrides,
  };
}

const stateLabels: Record<string, string> = {
  active: 'Active',
  sandbox: 'Sandbox',
  degraded: 'Degraded',
  onboarding: 'Onboarding',
  suspended: 'Suspended',
  error: 'Error',
  notConnected: 'Not Connected',
};

type TFn = EInvoiceComplianceDetailViewProps['t'];

const tStub = ((key: string) => {
  const map: Record<string, string> = {
    heading: 'E-Invoicing Compliance',
    subline: 'Status of connected e-invoicing profiles',
    emptyBody: 'No e-invoicing profiles configured.',
    health: 'Health',
    lastSync: 'Last Sync:',
    error: 'Error:',
    capabilities: 'Capabilities',
    capGenerate: 'Generate',
    capParse: 'Parse',
    capSign: 'Sign',
    capQrCode: 'QR Code',
    timeNever: 'Never',
    timeJustNow: 'Just now',
  };
  return map[key] ?? key;
}) as unknown as TFn;

const formatTimeAgoStub: EInvoiceComplianceDetailViewProps['formatTimeAgo'] = date => {
  if (!date) return 'Never';
  const d = typeof date === 'string' ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
};

afterEach(() => {
  document.body.innerHTML = '';
});

describe('EInvoiceComplianceDetailSkeleton (web-vite)', () => {
  it('renders skeleton placeholders', async () => {
    const { container } = await mount(<EInvoiceComplianceDetailSkeleton />);
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });
});

describe('EInvoiceComplianceDetailEmpty (web-vite)', () => {
  it('renders heading, subline, and empty-state body', async () => {
    const { container } = await mount(<EInvoiceComplianceDetailEmpty t={tStub} />);
    expect(findByText(container, 'E-Invoicing Compliance')).not.toBeNull();
    expect(findByText(container, /Status of connected e-invoicing profiles/)).not.toBeNull();
    expect(findByText(container, 'No e-invoicing profiles configured.')).not.toBeNull();
  });

  it('renders the section element with an id ending in -einvoice', async () => {
    const { container } = await mount(<EInvoiceComplianceDetailEmpty t={tStub} />);
    expect(container.querySelector('[id$="-einvoice"]')).not.toBeNull();
  });
});

describe('EInvoiceComplianceDetailView (web-vite)', () => {
  it('renders heading and subline', async () => {
    const { container } = await mount(
      <EInvoiceComplianceDetailView
        isLoading={false}
        statuses={[makeStatus()]}
        stateLabels={stateLabels}
        formatTimeAgo={formatTimeAgoStub}
        t={tStub}
      />,
    );
    expect(findByText(container, 'E-Invoicing Compliance')).not.toBeNull();
    expect(findByText(container, /Status of connected e-invoicing profiles/)).not.toBeNull();
  });

  it('renders a profile card with display name, badge, country and health score', async () => {
    const { container } = await mount(
      <EInvoiceComplianceDetailView
        isLoading={false}
        statuses={[
          makeStatus({
            healthScore: 95,
            lastSyncAt: new Date(),
          }),
        ]}
        stateLabels={stateLabels}
        formatTimeAgo={formatTimeAgoStub}
        t={tStub}
      />,
    );
    expect(findByText(container, 'KSeF Poland')).not.toBeNull();
    expect(findByText(container, 'Active')).not.toBeNull();
    expect(findByText(container, 'PL')).not.toBeNull();
    expect(findByText(container, '95%')).not.toBeNull();
  });

  it('renders capability labels for each capability slot', async () => {
    const { container } = await mount(
      <EInvoiceComplianceDetailView
        isLoading={false}
        statuses={[
          makeStatus({
            capabilities: {
              canGenerate: true,
              canParse: false,
              canSign: true,
              canQRCode: true,
            },
          }),
        ]}
        stateLabels={stateLabels}
        formatTimeAgo={formatTimeAgoStub}
        t={tStub}
      />,
    );
    expect(findByText(container, 'Capabilities')).not.toBeNull();
    expect(findByText(container, 'Generate')).not.toBeNull();
    expect(findByText(container, 'Parse')).not.toBeNull();
    expect(findByText(container, 'Sign')).not.toBeNull();
    expect(findByText(container, 'QR Code')).not.toBeNull();
  });

  it('renders the last error message when lastErrorMessage is set', async () => {
    const { container } = await mount(
      <EInvoiceComplianceDetailView
        isLoading={false}
        statuses={[
          makeStatus({
            state: 'error',
            displayName: 'Error Profile',
            lastErrorMessage: 'Connection timeout',
            healthScore: 10,
          }),
        ]}
        stateLabels={stateLabels}
        formatTimeAgo={formatTimeAgoStub}
        t={tStub}
      />,
    );
    expect(findByText(container, 'Error Profile')).not.toBeNull();
    expect(findByText(container, 'Connection timeout')).not.toBeNull();
  });

  it('renders multiple profile cards side-by-side', async () => {
    const { container } = await mount(
      <EInvoiceComplianceDetailView
        isLoading={false}
        statuses={[
          makeStatus({ profileId: 'pl-1', displayName: 'KSeF Poland', state: 'active' }),
          makeStatus({
            profileId: 'de-1',
            displayName: 'XRechnung Germany',
            state: 'degraded',
            country: 'DE',
            healthScore: 40,
            lastErrorMessage: 'API rate limited',
          }),
        ]}
        stateLabels={stateLabels}
        formatTimeAgo={formatTimeAgoStub}
        t={tStub}
      />,
    );
    expect(findByText(container, 'KSeF Poland')).not.toBeNull();
    expect(findByText(container, 'XRechnung Germany')).not.toBeNull();
    expect(findByText(container, 'API rate limited')).not.toBeNull();
  });

  it('renders the section element with an id ending in -einvoice', async () => {
    const { container } = await mount(
      <EInvoiceComplianceDetailView
        isLoading={false}
        statuses={[makeStatus()]}
        stateLabels={stateLabels}
        formatTimeAgo={formatTimeAgoStub}
        t={tStub}
      />,
    );
    expect(container.querySelector('[id$="-einvoice"]')).not.toBeNull();
  });
});
