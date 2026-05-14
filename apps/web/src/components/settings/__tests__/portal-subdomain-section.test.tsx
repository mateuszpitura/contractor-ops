import { render, screen, setup, waitFor } from '@/test/test-utils';
import { PortalSubdomainSection } from '../portal-subdomain-section';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let portalDomainData: unknown = null;
const { mockMutate } = vi.hoisted(() => ({
  mockMutate: vi.fn(),
}));

vi.mock('@tanstack/react-query', async importOriginal => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: (opts: { select?: (data: unknown) => unknown }) => {
      if (opts?.select && portalDomainData) {
        opts.select(portalDomainData);
      }
      return { data: portalDomainData, isLoading: false };
    },
    useMutation: (opts: { onSuccess?: () => void }) => ({
      mutate: (...args: unknown[]) => {
        mockMutate(...(args as Parameters<typeof mockMutate>));
        opts?.onSuccess?.();
      },
      isPending: false,
    }),
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});
vi.mock('@/trpc/init', () => ({
  trpc: {
    settings: {
      getPortalDomain: {
        queryOptions: () => ({ queryKey: ['settings.getPortalDomain'] }),
        queryKey: () => ['settings.getPortalDomain'],
      },
      updatePortalDomain: { mutationOptions: (opts: Record<string, unknown>) => opts },
    },
  },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PortalSubdomainSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    portalDomainData = null;
  });

  it('renders portal subdomain heading', () => {
    portalDomainData = { portalSubdomain: '' };
    render(<PortalSubdomainSection />);

    expect(screen.getByText('Portal Subdomain')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save domain/i })).toBeInTheDocument();
  });

  it('shows subdomain suffix text', () => {
    portalDomainData = { portalSubdomain: '' };
    render(<PortalSubdomainSection />);

    const suffixTexts = screen.getAllByText(/\.portal\.yourdomain\.com/);
    expect(suffixTexts.length).toBeGreaterThan(0);
  });

  it('renders subdomain input pre-filled with existing value', () => {
    portalDomainData = { portalSubdomain: 'testco' };
    render(<PortalSubdomainSection />);

    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('testco');
  });

  it('validates subdomain and shows error for too short input', async () => {
    portalDomainData = { portalSubdomain: '' };
    const { user } = setup(<PortalSubdomainSection />);

    const subdomainInput = screen.getByRole('textbox');
    await user.type(subdomainInput, 'ab');

    await user.click(screen.getByRole('button', { name: /save domain/i }));

    await waitFor(() => {
      expect(screen.getByText(/at least 3 characters/i)).toBeInTheDocument();
    });
  });

  it('saves domain with valid subdomain', async () => {
    portalDomainData = { portalSubdomain: '' };
    const { user } = setup(<PortalSubdomainSection />);

    const subdomainInput = screen.getByRole('textbox');
    await user.type(subdomainInput, 'mycompany');
    await user.click(screen.getByRole('button', { name: /save domain/i }));

    expect(mockMutate).toHaveBeenCalled();
  });

  it('converts uppercase input to lowercase in subdomain field', async () => {
    portalDomainData = { portalSubdomain: '' };
    const { user } = setup(<PortalSubdomainSection />);

    const input = screen.getByRole('textbox');
    await user.type(input, 'ACME');
    expect((input as HTMLInputElement).value).toBe('acme');
  });

  it('saves domain with empty subdomain clears it', async () => {
    portalDomainData = { portalSubdomain: 'old' };
    const { user } = setup(<PortalSubdomainSection />);

    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.click(screen.getByRole('button', { name: /save domain/i }));

    expect(mockMutate).toHaveBeenCalled();
  });

  it('clears subdomain error when user types a valid value', async () => {
    portalDomainData = { portalSubdomain: '' };
    const { user } = setup(<PortalSubdomainSection />);

    const input = screen.getByRole('textbox');
    await user.type(input, 'ab');
    await user.click(screen.getByRole('button', { name: /save domain/i }));
    await waitFor(() => {
      expect(screen.getByText(/at least 3 characters/i)).toBeInTheDocument();
    });

    await user.type(input, 'c');
    await waitFor(() => {
      expect(screen.queryByText(/at least 3 characters/i)).not.toBeInTheDocument();
    });
  });

  it('validates subdomain rejects value starting with dash', async () => {
    portalDomainData = { portalSubdomain: '' };
    const { user } = setup(<PortalSubdomainSection />);

    const input = screen.getByRole('textbox');
    await user.type(input, '-abc');
    await user.click(screen.getByRole('button', { name: /save domain/i }));

    await waitFor(() => {
      const errorText = screen.queryByText(/lowercase letters/i);
      expect(errorText).toBeInTheDocument();
    });
  });

  it('validates subdomain rejects input exceeding 63 characters', async () => {
    portalDomainData = { portalSubdomain: '' };
    const { user } = setup(<PortalSubdomainSection />);

    const input = screen.getByRole('textbox');
    const longSubdomain = 'a'.repeat(64);
    await user.type(input, longSubdomain);
    await user.click(screen.getByRole('button', { name: /save domain/i }));

    await waitFor(() => {
      const errorText = screen.queryByText(/at most 63/i);
      expect(errorText).toBeInTheDocument();
    });
  });

  it('saves valid subdomain with 3+ characters and lowercase', async () => {
    portalDomainData = { portalSubdomain: '' };
    const { user } = setup(<PortalSubdomainSection />);

    const input = screen.getByRole('textbox');
    await user.type(input, 'test123');
    await user.click(screen.getByRole('button', { name: /save domain/i }));

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        portalSubdomain: 'test123',
      }),
    );
  });

  it('saves subdomain with hyphens in middle', async () => {
    portalDomainData = { portalSubdomain: '' };
    const { user } = setup(<PortalSubdomainSection />);

    const input = screen.getByRole('textbox');
    await user.type(input, 'my-company');
    await user.click(screen.getByRole('button', { name: /save domain/i }));

    expect(mockMutate).toHaveBeenCalled();
  });

  it('strips special characters from subdomain input', async () => {
    portalDomainData = { portalSubdomain: '' };
    const { user } = setup(<PortalSubdomainSection />);

    const input = screen.getByRole('textbox');
    await user.type(input, 'test@#$company');
    expect((input as HTMLInputElement).value).toBe('testcompany');
  });
});
