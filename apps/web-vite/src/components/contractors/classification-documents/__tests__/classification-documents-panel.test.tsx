/**
 * The panel itself is purely view-driven (props in) but composes three tRPC
 * containers. We mock the containers so the panel resolves in isolation and
 * verify the GB/DE branching + a11y anchors.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../generate-sds-button.js', () => ({
  GenerateSdsButton: ({
    classificationAssessmentId,
  }: {
    classificationAssessmentId: string;
  }) => (
    <button
      type="button"
      data-testid="generate-sds-btn"
      data-assessment={classificationAssessmentId}>
      Generate SDS
    </button>
  ),
}));

vi.mock('../generate-drv-bundle-button.js', () => ({
  GenerateDrvBundleButton: ({
    classificationAssessmentId,
    disabled,
    disabledReason,
  }: {
    classificationAssessmentId: string;
    disabled?: boolean;
    disabledReason?: string;
  }) => (
    <button
      type="button"
      data-testid="generate-drv-btn"
      data-assessment={classificationAssessmentId}
      data-disabled={disabled ? 'true' : 'false'}
      aria-disabled={disabled}>
      Generate DRV bundle
      {disabled && disabledReason ? <span data-testid="drv-reason">{disabledReason}</span> : null}
    </button>
  ),
}));

vi.mock('../document-history-list.js', () => ({
  DocumentHistoryListContainer: ({ engagementId }: { engagementId: string }) => (
    <div data-testid="history-list" data-engagement={engagementId}>
      history
    </div>
  ),
}));

import { render, screen } from '../../../../test/test-utils.js';
import { ClassificationDocumentsPanel } from '../classification-documents-panel.js';

interface PanelProps {
  engagementId: string;
  countryCode: string | null;
  completedAssessmentId: string | null;
  attestationSigned?: boolean;
}

function renderPanel(props: PanelProps) {
  return render(<ClassificationDocumentsPanel {...props} />);
}

describe('ClassificationDocumentsPanel', () => {
  it('renders the Generate SDS button when GB + completed assessment exists', () => {
    renderPanel({
      engagementId: 'cass_1',
      countryCode: 'GB',
      completedAssessmentId: 'ca_1',
    });
    expect(screen.getByTestId('generate-sds-btn')).toBeInTheDocument();
    expect(screen.getByTestId('generate-sds-btn').getAttribute('data-assessment')).toBe('ca_1');
  });

  it('renders the DRV bundle button disabled (needs attestation) for DE + completed assessment', () => {
    renderPanel({
      engagementId: 'cass_1',
      countryCode: 'DE',
      completedAssessmentId: 'ca_1',
      attestationSigned: false,
    });
    expect(screen.queryByTestId('generate-sds-btn')).toBeNull();
    const drv = screen.getByTestId('generate-drv-btn');
    expect(drv.getAttribute('data-assessment')).toBe('ca_1');
    expect(drv.getAttribute('data-disabled')).toBe('true');
    expect(screen.getByTestId('drv-reason').textContent).toMatch(/other-clients attestation/i);
  });

  it('enables the DRV bundle button when DE + completedAssessmentId + attestationSigned', () => {
    renderPanel({
      engagementId: 'cass_1',
      countryCode: 'DE',
      completedAssessmentId: 'ca_1',
      attestationSigned: true,
    });
    const drv = screen.getByTestId('generate-drv-btn');
    expect(drv.getAttribute('data-disabled')).toBe('false');
  });

  it('renders disabled SDS button when no completed assessment exists (even for GB)', () => {
    renderPanel({
      engagementId: 'cass_1',
      countryCode: 'GB',
      completedAssessmentId: null,
    });
    expect(screen.queryByTestId('generate-sds-btn')).toBeNull();
    const button = screen.getByRole('button', { name: 'Generate SDS' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
  });

  it('renders disabled DRV button with "needs assessment" reason when no completed assessment (DE)', () => {
    renderPanel({
      engagementId: 'cass_1',
      countryCode: 'DE',
      completedAssessmentId: null,
    });
    expect(screen.queryByTestId('generate-drv-btn')).toBeNull();
    const button = screen.getByRole('button', { name: /Generate DRV/i });
    expect(button).toHaveAttribute('aria-disabled', 'true');
  });

  it('exposes the panel as a labelled section (a11y anchor)', () => {
    renderPanel({
      engagementId: 'cass_1',
      countryCode: 'GB',
      completedAssessmentId: 'ca_1',
    });
    const heading = screen.getByRole('heading', { name: 'Classification documents' });
    expect(heading.id).toBeTruthy();
    const section = heading.closest('section');
    expect(section?.getAttribute('aria-labelledby')).toBe(heading.id);
  });

  it('always renders the DocumentHistoryList with the engagement id', () => {
    renderPanel({
      engagementId: 'cass_xyz',
      countryCode: 'GB',
      completedAssessmentId: null,
    });
    const list = screen.getByTestId('history-list');
    expect(list.getAttribute('data-engagement')).toBe('cass_xyz');
  });

  it('does not render SDS or DRV buttons for unsupported country codes', () => {
    renderPanel({
      engagementId: 'cass_1',
      countryCode: 'PL',
      completedAssessmentId: 'ca_1',
    });
    expect(screen.queryByTestId('generate-sds-btn')).toBeNull();
    expect(screen.queryByTestId('generate-drv-btn')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Generate SDS' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Generate DRV/i })).toBeNull();
  });
});
