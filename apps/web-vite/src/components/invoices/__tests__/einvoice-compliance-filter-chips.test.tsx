import { render, screen, setup } from '@/test/test-utils';

import {
  EInvoiceComplianceFilterChips,
  parseFilterParam,
} from '../einvoice-compliance-filter-chips';

describe('parseFilterParam', () => {
  it('returns ["all"] for null input', () => {
    expect(parseFilterParam(null)).toEqual(['all']);
  });

  it('parses comma-separated tokens and filters unknown ones', () => {
    expect(parseFilterParam('invalid,failed,garbage')).toEqual(['invalid', 'failed']);
  });

  it('short-circuits when `all` is present in a multi-select', () => {
    expect(parseFilterParam('all,invalid')).toEqual(['all']);
  });
});

describe('EInvoiceComplianceFilterChips', () => {
  it('renders all 7 chips as tabs', () => {
    render(<EInvoiceComplianceFilterChips syncToUrl={false} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(7);
  });

  it('marks the "All" tab as selected by default (no value, no URL)', () => {
    render(<EInvoiceComplianceFilterChips syncToUrl={false} />);
    expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'true');
  });

  it('fires onChange with the clicked filter token', async () => {
    const onChange = vi.fn();
    const { user } = setup(<EInvoiceComplianceFilterChips syncToUrl={false} onChange={onChange} />);
    await user.click(screen.getByRole('tab', { name: 'Invalid' }));
    expect(onChange).toHaveBeenCalledWith(['invalid']);
  });

  it('controlled value prop overrides URL state (single value rendered active)', () => {
    render(<EInvoiceComplianceFilterChips syncToUrl={false} value={['failed']} />);
    expect(screen.getByRole('tab', { name: 'Failed' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'false');
  });
});
