import { describe, expect, it, vi } from 'vitest';
import { render, screen, setup } from '@/test/test-utils';
import { KleinunternehmerToggle } from '../kleinunternehmer-toggle';

vi.mock('@/trpc/init', () => ({
  trpc: {
    organization: {
      getCurrent: { queryKey: () => ['organization.getCurrent'] },
      setKleinunternehmer: {
        mutationOptions: (opts: Record<string, unknown>) => ({ mutationFn: vi.fn(), ...opts }),
      },
    },
  },
}));

describe('KleinunternehmerToggle', () => {
  it('renders nothing for non-DE organizations', () => {
    const { container } = render(
      <KleinunternehmerToggle orgCountryCode="US" isKleinunternehmer={false} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when orgCountryCode is null', () => {
    const { container } = render(
      <KleinunternehmerToggle orgCountryCode={null} isKleinunternehmer={false} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders the toggle for DE organizations', () => {
    render(<KleinunternehmerToggle orgCountryCode="DE" isKleinunternehmer={false} />);
    expect(screen.getByTestId('kleinunternehmer-toggle')).toBeInTheDocument();
  });

  it('renders the label text', () => {
    render(<KleinunternehmerToggle orgCountryCode="DE" isKleinunternehmer={false} />);
    expect(screen.getByText(/Kleinunternehmerregelung \(§ 19 UStG\)/)).toBeInTheDocument();
  });

  it('renders description text', () => {
    render(<KleinunternehmerToggle orgCountryCode="DE" isKleinunternehmer={false} />);
    expect(screen.getByText(/all invoice lines are billed at 0% VAT/)).toBeInTheDocument();
  });

  it('renders the switch with accessible name', () => {
    render(<KleinunternehmerToggle orgCountryCode="DE" isKleinunternehmer={false} />);
    expect(screen.getByRole('switch')).toBeInTheDocument();
  });

  it('reflects isKleinunternehmer=true as checked', () => {
    render(<KleinunternehmerToggle orgCountryCode="DE" isKleinunternehmer={true} />);
    const toggle = screen.getByRole('switch');
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  it('reflects isKleinunternehmer=false as unchecked', () => {
    render(<KleinunternehmerToggle orgCountryCode="DE" isKleinunternehmer={false} />);
    const toggle = screen.getByRole('switch');
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  it('renders nothing when orgCountryCode is undefined', () => {
    const { container } = render(
      <KleinunternehmerToggle orgCountryCode={undefined} isKleinunternehmer={false} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('opens confirmation dialog when switch is toggled', async () => {
    const { user } = setup(
      <KleinunternehmerToggle orgCountryCode="DE" isKleinunternehmer={false} />,
    );
    const toggle = screen.getByRole('switch');
    await user.click(toggle);
    // Dialog should show enable confirmation title
    expect(screen.getByText('Enable Kleinunternehmerregelung?')).toBeInTheDocument();
  });

  it('shows disable confirmation when toggling off', async () => {
    const { user } = setup(
      <KleinunternehmerToggle orgCountryCode="DE" isKleinunternehmer={true} />,
    );
    const toggle = screen.getByRole('switch');
    await user.click(toggle);
    expect(screen.getByText('Disable Kleinunternehmerregelung?')).toBeInTheDocument();
    expect(
      screen.getByText(/Future invoices will resume standard German VAT handling/),
    ).toBeInTheDocument();
  });

  it('shows enable description when enabling', async () => {
    const { user } = setup(
      <KleinunternehmerToggle orgCountryCode="DE" isKleinunternehmer={false} />,
    );
    await user.click(screen.getByRole('switch'));
    expect(screen.getByText(/All new invoice lines will be billed at 0% VAT/)).toBeInTheDocument();
  });

  it('renders Cancel button in confirmation dialog', async () => {
    const { user } = setup(
      <KleinunternehmerToggle orgCountryCode="DE" isKleinunternehmer={false} />,
    );
    await user.click(screen.getByRole('switch'));
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('renders Confirm button in dialog', async () => {
    const { user } = setup(
      <KleinunternehmerToggle orgCountryCode="DE" isKleinunternehmer={false} />,
    );
    await user.click(screen.getByRole('switch'));
    expect(screen.getByTestId('kleinunternehmer-confirm')).toBeInTheDocument();
    expect(screen.getByTestId('kleinunternehmer-confirm')).toHaveTextContent('Confirm');
  });
});
