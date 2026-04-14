import { describe, expect, it, vi } from 'vitest';
import { setup, render, screen } from '@/test/test-utils';
import {
  EInvoiceComplianceFilterChips,
  parseFilterParam,
} from '../einvoice-compliance-filter-chips';

// ---------------------------------------------------------------------------
// Mock-friendly router + searchParams hooks. Each test tweaks the URL-state
// via a shared mutable object so we can observe calls to router.replace.
// ---------------------------------------------------------------------------

const routerState = {
  search: '',
  replace: vi.fn<(url: string) => void>(),
};

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(routerState.search),
}));

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ replace: routerState.replace }),
}));

beforeEach(() => {
  routerState.search = '';
  routerState.replace.mockReset();
});

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
  it('renders all 7 chips with role="button" and keyboard reachability', () => {
    render(<EInvoiceComplianceFilterChips syncToUrl={false} />);
    const chips = screen.getAllByRole('button');
    expect(chips).toHaveLength(7);
    for (const chip of chips) {
      expect(chip).toHaveAttribute('tabIndex', '0');
    }
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('clicking "Invalid" writes ?einvoiceStatus=invalid to the URL and fires onChange', async () => {
    const onChange = vi.fn();
    const { user } = setup(<EInvoiceComplianceFilterChips onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: 'Invalid' }));
    expect(routerState.replace).toHaveBeenCalledWith('?einvoiceStatus=invalid');
    expect(onChange).toHaveBeenCalledWith(['invalid']);
  });

  it('keyboard Enter activates a chip', async () => {
    const onChange = vi.fn();
    const { user } = setup(<EInvoiceComplianceFilterChips onChange={onChange} />);
    const chip = screen.getByRole('button', { name: 'Warnings' });
    chip.focus();
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith(['warnings']);
  });

  it('loads active state from ?einvoiceStatus URL param', () => {
    routerState.search = 'einvoiceStatus=failed';
    render(<EInvoiceComplianceFilterChips syncToUrl={false} />);
    expect(screen.getByRole('button', { name: 'Failed' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('renders the German translation under de locale', () => {
    render(<EInvoiceComplianceFilterChips syncToUrl={false} />, { locale: 'de' });
    expect(screen.getByRole('button', { name: 'Alle' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ungültig' })).toBeInTheDocument();
  });

  it('controlled value prop overrides URL state (supports multi-select)', () => {
    routerState.search = 'einvoiceStatus=all';
    render(
      <EInvoiceComplianceFilterChips
        syncToUrl={false}
        value={['invalid', 'failed']}
      />,
    );
    expect(screen.getByRole('button', { name: 'Invalid' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Failed' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
