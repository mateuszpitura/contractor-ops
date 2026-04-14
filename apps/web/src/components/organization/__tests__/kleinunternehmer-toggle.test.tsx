import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/test/test-utils';
import { KleinunternehmerToggle } from '../kleinunternehmer-toggle';

vi.mock('@/trpc/init', () => ({
  trpc: {
    useUtils: () => ({
      organization: {
        getCurrent: {
          invalidate: vi.fn(),
        },
      },
    }),
    organization: {
      setKleinunternehmer: {
        useMutation: (opts?: Record<string, unknown>) => ({
          mutate: vi.fn(),
          isPending: false,
          ...opts,
        }),
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
});
