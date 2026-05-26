/**
 * Ported from apps/web/src/components/peppol/__tests__/peppol-compliance-widget.test.tsx.
 *
 * Web-vite PeppolComplianceWidget is a fully presentational row used
 * inside `EInvoiceComplianceWidgetView`. It owns its own STATE_LABELS
 * map (no translations) so the test is a literal port — we still
 * mount through the per-domain helper to keep the React 19 act() flag
 * + i18n bootstrap consistent with sibling tests.
 */

import { afterEach, describe, expect, it } from 'vitest';

import { PeppolComplianceWidget } from '../peppol-compliance-widget.js';
import { findByText, mount } from './_render.js';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('PeppolComplianceWidget (web-vite)', () => {
  it('renders the widget label', async () => {
    await mount(<PeppolComplianceWidget status={{ state: 'active', healthScore: 100 }} />);
    expect(findByText(document.body, 'Peppol (UAE)')).not.toBeNull();
  });

  it('shows the Active status label for the active state', async () => {
    await mount(<PeppolComplianceWidget status={{ state: 'active', healthScore: 100 }} />);
    expect(findByText(document.body, 'Active')).not.toBeNull();
  });

  it('shows the Onboarding status label', async () => {
    await mount(<PeppolComplianceWidget status={{ state: 'onboarding', healthScore: 50 }} />);
    expect(findByText(document.body, 'Onboarding')).not.toBeNull();
  });

  it('shows the Suspended status label', async () => {
    await mount(<PeppolComplianceWidget status={{ state: 'suspended', healthScore: 0 }} />);
    expect(findByText(document.body, 'Suspended')).not.toBeNull();
  });

  it('shows Not Connected for the notConnected state', async () => {
    await mount(<PeppolComplianceWidget status={{ state: 'notConnected', healthScore: 0 }} />);
    expect(findByText(document.body, 'Not Connected')).not.toBeNull();
  });

  it('falls back to Unknown for an unrecognised state', async () => {
    await mount(<PeppolComplianceWidget status={{ state: 'banana', healthScore: 0 }} />);
    expect(findByText(document.body, 'Unknown')).not.toBeNull();
  });

  it('renders transmission counts when provided', async () => {
    await mount(
      <PeppolComplianceWidget
        status={{ state: 'active', healthScore: 100 }}
        transmissionCounts={{ sent: 42, received: 17 }}
      />,
    );
    expect(findByText(document.body, '42 sent, 17 rcvd')).not.toBeNull();
  });

  it('omits transmission counts when none are provided', async () => {
    await mount(<PeppolComplianceWidget status={{ state: 'active', healthScore: 100 }} />);
    expect(findByText(document.body, /sent/)).toBeNull();
  });
});
