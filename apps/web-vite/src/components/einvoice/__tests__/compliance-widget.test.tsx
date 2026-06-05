/**
 * Post-passthrough refactor: `EInvoiceComplianceWidget` (container) now
 * branches on `isLoading` and the empty case (no statuses + no peppol),
 * delegating render to `EInvoiceComplianceWidgetSkeleton`,
 * returning `null`, or rendering `EInvoiceComplianceWidgetView`. These
 * tests exercise the siblings directly — no tRPC / React Query mocks.
 *
 * The view renders `<Link>` from `../../i18n/navigation.js`, a
 * thin `react-router-dom` wrapper, so we wrap in `<MemoryRouter>`.
 */

import type { ComplianceStatus } from '@contractor-ops/einvoice/compliance';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import type { EInvoiceComplianceWidgetViewProps } from '../compliance-widget.js';
import {
  EInvoiceComplianceWidgetSkeleton,
  EInvoiceComplianceWidgetView,
} from '../compliance-widget.js';
import { findByText, mount } from './_render.js';

function withRouter(node: ReactElement): ReactElement {
  return <MemoryRouter initialEntries={['/en/dashboard']}>{node}</MemoryRouter>;
}

function makeStatus(overrides: Partial<ComplianceStatus> = {}): ComplianceStatus {
  return {
    profileId: 'sa-1',
    state: 'active',
    country: 'SA',
    displayName: 'Saudi Arabia',
    healthScore: 100,
    capabilities: {
      canGenerate: true,
      canParse: true,
      canSign: true,
      canQRCode: true,
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
  notConnected: 'Not connected',
};

type TFn = EInvoiceComplianceWidgetViewProps['t'];

const tStub = ((key: string) => {
  const map: Record<string, string> = {
    'ComplianceWidget.title': 'E-Invoicing Compliance',
  };
  return map[key] ?? key;
}) as unknown as TFn;

afterEach(() => {
  document.body.innerHTML = '';
});

describe('EInvoiceComplianceWidgetSkeleton (web-vite)', () => {
  it('renders skeleton placeholders and no widget title', async () => {
    const { container } = await mount(withRouter(<EInvoiceComplianceWidgetSkeleton />));
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
    expect(findByText(container, 'E-Invoicing Compliance')).toBeNull();
  });
});

describe('EInvoiceComplianceWidgetView (web-vite)', () => {
  it('renders the widget title', async () => {
    const { container } = await mount(
      withRouter(
        <EInvoiceComplianceWidgetView
          isLoading={false}
          statuses={[makeStatus()]}
          peppolState={null}
          stateLabels={stateLabels}
          t={tStub}
        />,
      ),
    );
    expect(findByText(container, 'E-Invoicing Compliance')).not.toBeNull();
  });

  it('renders display names and state labels for each status row', async () => {
    const statuses = [
      makeStatus({ profileId: 'sa-1', displayName: 'Saudi Arabia', state: 'active' }),
      makeStatus({ profileId: 'de-1', displayName: 'Germany', state: 'sandbox' }),
    ];
    const { container } = await mount(
      withRouter(
        <EInvoiceComplianceWidgetView
          isLoading={false}
          statuses={statuses}
          peppolState={null}
          stateLabels={stateLabels}
          t={tStub}
        />,
      ),
    );
    expect(findByText(container, 'Saudi Arabia')).not.toBeNull();
    expect(findByText(container, 'Germany')).not.toBeNull();
    expect(findByText(container, 'Active')).not.toBeNull();
    expect(findByText(container, 'Sandbox')).not.toBeNull();
  });

  it('renders status rows as links pointing to /settings#einvoice (locale-prefixed)', async () => {
    const { container } = await mount(
      withRouter(
        <EInvoiceComplianceWidgetView
          isLoading={false}
          statuses={[makeStatus()]}
          peppolState={null}
          stateLabels={stateLabels}
          t={tStub}
        />,
      ),
    );
    const links = Array.from(container.querySelectorAll('a'));
    expect(links.length).toBeGreaterThan(0);
    // localePath() prefixes `/en`, react-router preserves the `#einvoice` hash.
    expect(links[0]?.getAttribute('href') ?? '').toContain('/settings');
    expect(links[0]?.getAttribute('href') ?? '').toContain('einvoice');
  });
});
