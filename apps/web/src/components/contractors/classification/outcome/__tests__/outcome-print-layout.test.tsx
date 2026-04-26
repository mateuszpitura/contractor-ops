import { describe, expect, it } from 'vitest';

import { render, screen } from '@/test/test-utils';

import { OutcomePrintLayout } from '../outcome-print-layout';

describe('OutcomePrintLayout', () => {
  it('renders children content', () => {
    render(
      <OutcomePrintLayout>
        <p>Assessment results here</p>
      </OutcomePrintLayout>,
    );

    expect(screen.getByText('Assessment results here')).toBeInTheDocument();
  });

  it('renders with default data-testid', () => {
    render(
      <OutcomePrintLayout>
        <p>Content</p>
      </OutcomePrintLayout>,
    );

    expect(screen.getByTestId('outcome-print-layout')).toBeInTheDocument();
  });

  it('accepts a custom data-testid', () => {
    render(
      <OutcomePrintLayout data-testid="custom-layout">
        <p>Content</p>
      </OutcomePrintLayout>,
    );

    expect(screen.getByTestId('custom-layout')).toBeInTheDocument();
  });

  it('renders header in print-only section when provided', () => {
    render(
      <OutcomePrintLayout header={<span>Company Logo</span>}>
        <p>Content</p>
      </OutcomePrintLayout>,
    );

    expect(screen.getByText('Company Logo')).toBeInTheDocument();
  });

  it('renders footer in print-only section when provided', () => {
    render(
      <OutcomePrintLayout footer={<span>Page footer</span>}>
        <p>Content</p>
      </OutcomePrintLayout>,
    );

    expect(screen.getByText('Page footer')).toBeInTheDocument();
  });

  it('does not render header/footer sections when not provided', () => {
    const { container } = render(
      <OutcomePrintLayout>
        <p>Content</p>
      </OutcomePrintLayout>,
    );

    const printOnlySections = container.querySelectorAll('.outcome-print-only');
    expect(printOnlySections).toHaveLength(0);
  });

  it('injects print styles via a style tag', () => {
    const { container } = render(
      <OutcomePrintLayout>
        <p>Content</p>
      </OutcomePrintLayout>,
    );

    const styleTag = container.querySelector('style');
    expect(styleTag).toBeInTheDocument();
    expect(styleTag?.textContent).toContain('@media print');
  });
});
