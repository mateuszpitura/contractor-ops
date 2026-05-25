/**
 * Container/component split port. Legacy test mocked the entire tRPC stack
 * to render the smart `<ConsentManagementSection />`; web-vite exposes
 * `<ConsentManagementSectionView />` that takes the hook's return shape as
 * props, so we exercise the presentational layer directly with shaped stubs.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '../../../test/test-utils.js';
import type { ConsentManagementSectionViewProps } from '../consent-management-section.js';
import {
  ConsentManagementSectionLoading,
  ConsentManagementSectionNotRequired,
  ConsentManagementSectionView,
} from '../consent-management-section.js';

function makeProps(
  overrides: Partial<ConsentManagementSectionViewProps> = {},
): ConsentManagementSectionViewProps {
  return {
    notice: {
      jurisdiction: 'AE',
      legalReference: 'Federal Decree-Law No. 45/2021',
      controller: { name: 'Test Org', country: 'AE' },
      sections: [{ title: 'Processing Purposes', content: 'We process data for...' }],
    },
    purposeToggles: [
      { purpose: 'CONTRACTOR_DATA_PROCESSING', required: true, granted: true, disabled: true },
      { purpose: 'ANALYTICS_REPORTING', required: false, granted: false, disabled: false },
    ],
    onToggle: vi.fn(),
    consentHistory: [
      {
        id: 'rec-1',
        purpose: 'CONTRACTOR_DATA_PROCESSING',
        granted: true,
        createdAt: '2026-04-11T10:00:00Z',
        version: 1,
      },
    ],
    hasConsentHistory: true,
    crossBorder: { detected: true, orgRegion: 'GCC', hostingRegion: 'EU' },
    showCrossBorder: true,
    dpaDownload: { onDownload: vi.fn(), isPending: false },
    sccDownload: { onDownload: vi.fn(), isPending: false },
    ...overrides,
  };
}

describe('ConsentManagementSectionView (web-vite)', () => {
  it('renders consent toggles for each purpose entry', () => {
    render(<ConsentManagementSectionView {...makeProps()} />);
    expect(document.getElementById('consent-CONTRACTOR_DATA_PROCESSING')).not.toBeNull();
    expect(document.getElementById('consent-ANALYTICS_REPORTING')).not.toBeNull();
  });

  it('renders the legal documents section with DPA + SCC download buttons', () => {
    render(<ConsentManagementSectionView {...makeProps()} />);
    expect(screen.getByRole('button', { name: /Download DPA/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Download SCCs/i })).toBeInTheDocument();
  });

  it('invokes dpaDownload.onDownload when the DPA button is clicked', async () => {
    const onDownload = vi.fn();
    const props = makeProps({ dpaDownload: { onDownload, isPending: false } });
    render(<ConsentManagementSectionView {...props} />);
    screen.getByRole('button', { name: /Download DPA/i }).click();
    expect(onDownload).toHaveBeenCalledTimes(1);
  });

  it('shows the not-required card when ConsentManagementSectionNotRequired is rendered', () => {
    render(<ConsentManagementSectionNotRequired />);
    expect(
      screen.getByText(/Consent management is not required in your jurisdiction/i),
    ).toBeInTheDocument();
  });

  it('renders the consent history table heading when hasConsentHistory is true', () => {
    render(<ConsentManagementSectionView {...makeProps()} />);
    expect(screen.getByText(/Consent history/i)).toBeInTheDocument();
  });

  it('renders cross-border banner when detected', () => {
    render(<ConsentManagementSectionView {...makeProps()} />);
    expect(screen.getByText(/Cross-border transfer detected/i)).toBeInTheDocument();
  });

  it('renders the no-cross-border message when detected is false', () => {
    const props = makeProps({
      crossBorder: { detected: false, orgRegion: 'EU', hostingRegion: 'EU' },
    });
    render(<ConsentManagementSectionView {...props} />);
    expect(screen.getByText(/No cross-border data transfers detected/i)).toBeInTheDocument();
  });

  it('renders a loading status when ConsentManagementSectionLoading is rendered', () => {
    render(<ConsentManagementSectionLoading />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
