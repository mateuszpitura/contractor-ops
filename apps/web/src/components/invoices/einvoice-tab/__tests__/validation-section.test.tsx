import { describe, expect, it, vi } from 'vitest';
import { render, screen, setup } from '@/test/test-utils';
import { ValidationSection } from '../validation-section';

describe('ValidationSection', () => {
  it('renders empty state + Validate CTA when validation has not run', async () => {
    const onRevalidate = vi.fn();
    const { user } = setup(
      <ValidationSection
        lifecycle={null}
        isRevalidatePending={false}
        isDownloadReportPending={false}
        onRevalidate={onRevalidate}
        onDownloadReport={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Validation' })).toBeInTheDocument();
    expect(
      screen.getByText(
        /Validation has not run yet\. Finalize the invoice to validate against KoSIT\./,
      ),
    ).toBeInTheDocument();

    const btn = screen.getByRole('button', { name: 'Validate now' });
    await user.click(btn);
    expect(onRevalidate).toHaveBeenCalledTimes(1);
  });

  it('renders 3 layer rows + SvrlIssueList when summary has issues', () => {
    render(
      <ValidationSection
        lifecycle={{
          id: 'lc_1',
          validationStatus: 'WARNINGS',
          transmissionStatus: 'NOT_SENT',
          events: [],
          validationReportSummary: {
            status: 'WARNINGS',
            ruleSetVersion: '3.0.2',
            issues: [
              {
                layer: 'Layer 2',
                severity: 'warning',
                ruleId: 'BR-CL-24',
                xpath: '/rsm:X/ram:Y',
                message: 'Short warning message.',
              },
            ],
            perLayer: [
              { layer: '1', status: 'passed', errorCount: 0, warningCount: 0 },
              { layer: '2', status: 'warnings', errorCount: 0, warningCount: 1 },
              { layer: '3', status: 'passed', errorCount: 0, warningCount: 0 },
            ],
          },
        }}
        isRevalidatePending={false}
        isDownloadReportPending={false}
        onRevalidate={vi.fn()}
        onDownloadReport={vi.fn()}
      />,
    );

    const layerRows = document.querySelectorAll('[data-slot=validation-layer-row]');
    expect(layerRows).toHaveLength(3);

    expect(screen.getByText('BR-CL-24')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Issues' })).toBeInTheDocument();
  });

  it('spinner visible while revalidation pending', () => {
    render(
      <ValidationSection
        lifecycle={null}
        isRevalidatePending={true}
        isDownloadReportPending={false}
        onRevalidate={vi.fn()}
        onDownloadReport={vi.fn()}
      />,
    );

    const btn = screen.getByRole('button', { name: 'Validate now' });
    expect(btn).toBeDisabled();
  });
});
