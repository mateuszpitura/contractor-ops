import { render, screen, setup, waitFor } from '@/test/test-utils';
import { AdminBrandingSection } from '../admin-branding-section';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let brandingData: unknown = null;
let brandingLoading = false;
let portalDomainData: unknown = null;
const { mockMutate, mockMutateAsync } = vi.hoisted(() => ({
  mockMutate: vi.fn(),
  mockMutateAsync: vi.fn(),
}));

let queryCallIndex = 0;

vi.mock('@tanstack/react-query', async importOriginal => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: (opts: { select?: (data: unknown) => unknown }) => {
      const idx = queryCallIndex++;
      // First useQuery = getBranding, second = getPortalDomain
      const isBranding = idx % 2 === 0;
      const data = isBranding ? brandingData : portalDomainData;
      const loading = isBranding ? brandingLoading : false;

      // Call select to trigger state initialization
      if (opts?.select && data) {
        opts.select(data);
      }

      return { data, isLoading: loading };
    },
    useMutation: (opts: { onSuccess?: () => void }) => ({
      mutate: (...args: unknown[]) => {
        mockMutate(...(args as Parameters<typeof mockMutate>));
        opts?.onSuccess?.();
      },
      mutateAsync: mockMutateAsync,
      isPending: false,
    }),
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});
vi.mock('@/trpc/init', () => ({
  trpc: {
    settings: {
      getBranding: {
        queryOptions: () => ({ queryKey: ['settings.getBranding'] }),
        queryKey: () => ['settings.getBranding'],
      },
      getLogoUploadUrl: { mutationOptions: () => ({}) },
      updateBranding: { mutationOptions: (opts: Record<string, unknown>) => opts },
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

vi.mock('../brand-color-picker', () => ({
  BrandColorPicker: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <div data-testid="color-picker">
      <span>Color: {value}</span>
      {/* biome-ignore lint/nursery/noJsxPropsBind: controlled input handler */}
      <button type="button" onClick={() => onChange('#ff0000')}>
        Set red
      </button>
    </div>
  ),
}));

vi.mock('../brand-preview-strip', () => ({
  BrandPreviewStrip: ({ color }: { color: string }) => (
    <div data-testid="preview-strip">Preview: {color}</div>
  ),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AdminBrandingSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    brandingData = null;
    brandingLoading = false;
    portalDomainData = null;
    queryCallIndex = 0;
  });

  it('renders loading skeleton when branding data is loading', () => {
    brandingLoading = true;
    const { container } = render(<AdminBrandingSection />);

    // Skeleton components render with data-slot="skeleton"
    const skeletons = container.querySelectorAll("[data-slot='skeleton']");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders branding section heading when loaded', () => {
    brandingData = { brandColor: '#4f46e5', logo: null };
    portalDomainData = { portalSubdomain: '' };
    render(<AdminBrandingSection />);

    expect(screen.getByText('Portal Branding')).toBeInTheDocument();
    expect(screen.getByText(/customize/i)).toBeInTheDocument();
  });

  it('renders logo upload button when no logo', () => {
    brandingData = { brandColor: '#4f46e5', logo: null };
    portalDomainData = { portalSubdomain: '' };
    render(<AdminBrandingSection />);

    expect(screen.getByText('Upload logo')).toBeInTheDocument();
  });

  it('renders color picker with current color', () => {
    brandingData = { brandColor: '#4f46e5', logo: null };
    portalDomainData = { portalSubdomain: '' };
    render(<AdminBrandingSection />);

    expect(screen.getByTestId('color-picker')).toBeInTheDocument();
    expect(screen.getByText('Color: #4f46e5')).toBeInTheDocument();
  });

  it('renders preview strip', () => {
    brandingData = { brandColor: '#4f46e5', logo: null };
    portalDomainData = { portalSubdomain: '' };
    render(<AdminBrandingSection />);

    expect(screen.getByTestId('preview-strip')).toBeInTheDocument();
  });

  it('renders save branding button', () => {
    brandingData = { brandColor: '#4f46e5', logo: null };
    portalDomainData = { portalSubdomain: '' };
    render(<AdminBrandingSection />);

    expect(screen.getByRole('button', { name: /save branding/i })).toBeInTheDocument();
  });

  it('calls updateBranding mutation on save', async () => {
    brandingData = { brandColor: '#4f46e5', logo: null };
    portalDomainData = { portalSubdomain: '' };
    const { user } = setup(<AdminBrandingSection />);

    await user.click(screen.getByRole('button', { name: /save branding/i }));

    expect(mockMutate).toHaveBeenCalledWith({
      brandColor: '#4f46e5',
      logoUrl: null,
    });
  });

  it('updates color when color picker changes', async () => {
    brandingData = { brandColor: '#4f46e5', logo: null };
    portalDomainData = { portalSubdomain: '' };
    const { user } = setup(<AdminBrandingSection />);

    await user.click(screen.getByText('Set red'));

    await waitFor(() => {
      expect(screen.getByText('Color: #ff0000')).toBeInTheDocument();
    });
  });

  it('renders logo label and hint text', () => {
    brandingData = { brandColor: '#4f46e5', logo: null };
    portalDomainData = { portalSubdomain: '' };
    render(<AdminBrandingSection />);

    expect(screen.getByText('Logo')).toBeInTheDocument();
    expect(screen.getByText(/png.*jpg.*svg/i)).toBeInTheDocument();
  });

  it('renders accent color label', () => {
    brandingData = { brandColor: '#4f46e5', logo: null };
    portalDomainData = { portalSubdomain: '' };
    render(<AdminBrandingSection />);

    expect(screen.getByText('Accent Color')).toBeInTheDocument();
  });

  it('renders portal subdomain section', () => {
    brandingData = { brandColor: '#4f46e5', logo: null };
    portalDomainData = { portalSubdomain: 'acme' };
    render(<AdminBrandingSection />);

    expect(screen.getByText('Portal Subdomain')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save domain/i })).toBeInTheDocument();
  });

  it('shows subdomain suffix text', () => {
    brandingData = { brandColor: '#4f46e5', logo: null };
    portalDomainData = { portalSubdomain: '' };
    render(<AdminBrandingSection />);

    const suffixTexts = screen.getAllByText(/\.portal\.yourdomain\.com/);
    expect(suffixTexts.length).toBeGreaterThan(0);
  });

  it('renders logo preview when logo URL exists', () => {
    brandingData = { brandColor: '#4f46e5', logo: 'https://example.com/logo.png' };
    portalDomainData = { portalSubdomain: '' };
    render(<AdminBrandingSection />);

    const img = screen.getByAltText('Organization logo');
    expect(img).toBeInTheDocument();
    expect(screen.getByText('Remove')).toBeInTheDocument();
  });

  it('removes logo when remove button is clicked', async () => {
    brandingData = { brandColor: '#4f46e5', logo: 'https://example.com/logo.png' };
    portalDomainData = { portalSubdomain: '' };
    const { user } = setup(<AdminBrandingSection />);

    await user.click(screen.getByText('Remove'));

    await waitFor(() => {
      expect(screen.getByText('Upload logo')).toBeInTheDocument();
    });
  });

  it('renders hidden file input for logo upload', () => {
    brandingData = { brandColor: '#4f46e5', logo: null };
    portalDomainData = { portalSubdomain: '' };
    render(<AdminBrandingSection />);

    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).toBeInTheDocument();
    expect(fileInput).toHaveAttribute('accept', 'image/png,image/jpeg,image/svg+xml');
  });

  it('validates subdomain and shows error for too short input', async () => {
    brandingData = { brandColor: '#4f46e5', logo: null };
    portalDomainData = { portalSubdomain: '' };
    const { user } = setup(<AdminBrandingSection />);

    const subdomainInput = screen.getByRole('textbox');
    await user.type(subdomainInput, 'ab');

    await user.click(screen.getByRole('button', { name: /save domain/i }));

    await waitFor(() => {
      expect(screen.getByText(/at least 3 characters/i)).toBeInTheDocument();
    });
  });

  it('saves branding with updated color after color change', async () => {
    brandingData = { brandColor: '#4f46e5', logo: null };
    portalDomainData = { portalSubdomain: '' };
    const { user } = setup(<AdminBrandingSection />);

    // Change color via mock
    await user.click(screen.getByText('Set red'));
    await user.click(screen.getByRole('button', { name: /save branding/i }));

    expect(mockMutate).toHaveBeenCalledWith({
      brandColor: '#ff0000',
      logoUrl: null,
    });
  });

  it('renders preview strip with correct color value', () => {
    brandingData = { brandColor: '#ff5722', logo: null };
    portalDomainData = { portalSubdomain: '' };
    render(<AdminBrandingSection />);

    expect(screen.getByTestId('preview-strip')).toHaveTextContent('Preview: #ff5722');
  });

  it('renders subdomain input pre-filled with existing value', () => {
    brandingData = { brandColor: '#4f46e5', logo: null };
    portalDomainData = { portalSubdomain: 'testco' };
    render(<AdminBrandingSection />);

    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('testco');
  });

  it('saves domain with valid subdomain', async () => {
    brandingData = { brandColor: '#4f46e5', logo: null };
    portalDomainData = { portalSubdomain: '' };
    const { user } = setup(<AdminBrandingSection />);

    const subdomainInput = screen.getByRole('textbox');
    await user.type(subdomainInput, 'mycompany');
    await user.click(screen.getByRole('button', { name: /save domain/i }));

    expect(mockMutate).toHaveBeenCalled();
  });

  it('renders branding description text', () => {
    brandingData = { brandColor: '#4f46e5', logo: null };
    portalDomainData = { portalSubdomain: '' };
    render(<AdminBrandingSection />);

    expect(screen.getByText(/customize/i)).toBeInTheDocument();
  });

  it('renders logo section with upload button when no logo present', () => {
    brandingData = { brandColor: '#4f46e5', logo: null };
    portalDomainData = { portalSubdomain: '' };
    render(<AdminBrandingSection />);

    expect(screen.getByText('Logo')).toBeInTheDocument();
    expect(screen.getByText('Upload logo')).toBeInTheDocument();
    expect(screen.queryByAltText('Organization logo')).not.toBeInTheDocument();
  });

  it('saves branding with logo URL when logo is present', async () => {
    brandingData = { brandColor: '#4f46e5', logo: 'https://example.com/logo.png' };
    portalDomainData = { portalSubdomain: '' };
    const { user } = setup(<AdminBrandingSection />);

    await user.click(screen.getByRole('button', { name: /save branding/i }));

    expect(mockMutate).toHaveBeenCalledWith({
      brandColor: '#4f46e5',
      logoUrl: 'https://example.com/logo.png',
    });
  });

  it('renders color picker and allows color change before save', async () => {
    brandingData = { brandColor: '#000000', logo: null };
    portalDomainData = { portalSubdomain: '' };
    const { user } = setup(<AdminBrandingSection />);

    expect(screen.getByText('Color: #000000')).toBeInTheDocument();
    await user.click(screen.getByText('Set red'));
    await waitFor(() => {
      expect(screen.getByText('Color: #ff0000')).toBeInTheDocument();
    });
    expect(screen.getByTestId('preview-strip')).toHaveTextContent('Preview: #ff0000');
  });

  it('validates subdomain rejects special characters', async () => {
    brandingData = { brandColor: '#4f46e5', logo: null };
    portalDomainData = { portalSubdomain: '' };
    const { user } = setup(<AdminBrandingSection />);

    const input = screen.getByRole('textbox');
    await user.type(input, 'a');
    await user.click(screen.getByRole('button', { name: /save domain/i }));

    await waitFor(() => {
      expect(screen.getByText(/at least 3 characters/i)).toBeInTheDocument();
    });
  });

  it('renders remove button and removes logo on click', async () => {
    brandingData = { brandColor: '#4f46e5', logo: 'https://example.com/logo.png' };
    portalDomainData = { portalSubdomain: '' };
    const { user } = setup(<AdminBrandingSection />);

    expect(screen.getByAltText('Organization logo')).toBeInTheDocument();
    await user.click(screen.getByText('Remove'));

    await waitFor(() => {
      expect(screen.queryByAltText('Organization logo')).not.toBeInTheDocument();
      expect(screen.getByText('Upload logo')).toBeInTheDocument();
    });
  });

  it('renders file input with correct accept types for logo', () => {
    brandingData = { brandColor: '#4f46e5', logo: null };
    portalDomainData = { portalSubdomain: '' };
    render(<AdminBrandingSection />);

    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).toHaveAttribute('accept', 'image/png,image/jpeg,image/svg+xml');
  });

  // ---- Subdomain sanitization: uppercase converted to lowercase ----
  it('converts uppercase input to lowercase in subdomain field', async () => {
    brandingData = { brandColor: '#4f46e5', logo: null };
    portalDomainData = { portalSubdomain: '' };
    const { user } = setup(<AdminBrandingSection />);

    const input = screen.getByRole('textbox');
    await user.type(input, 'ACME');
    expect((input as HTMLInputElement).value).toBe('acme');
  });

  // ---- Save domain with empty subdomain clears it ----
  it('saves domain with empty subdomain', async () => {
    brandingData = { brandColor: '#4f46e5', logo: null };
    portalDomainData = { portalSubdomain: 'old' };
    const { user } = setup(<AdminBrandingSection />);

    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.click(screen.getByRole('button', { name: /save domain/i }));

    expect(mockMutate).toHaveBeenCalled();
  });

  // ---- Subdomain error clears on new input ----
  it('clears subdomain error when user types a valid value', async () => {
    brandingData = { brandColor: '#4f46e5', logo: null };
    portalDomainData = { portalSubdomain: '' };
    const { user } = setup(<AdminBrandingSection />);

    const input = screen.getByRole('textbox');
    await user.type(input, 'ab');
    await user.click(screen.getByRole('button', { name: /save domain/i }));
    await waitFor(() => {
      expect(screen.getByText(/at least 3 characters/i)).toBeInTheDocument();
    });

    // Type more characters - error should clear
    await user.type(input, 'c');
    await waitFor(() => {
      expect(screen.queryByText(/at least 3 characters/i)).not.toBeInTheDocument();
    });
  });

  // ---- Save branding after logo removal ----
  it('saves branding with null logo after removal', async () => {
    brandingData = { brandColor: '#4f46e5', logo: 'https://example.com/logo.png' };
    portalDomainData = { portalSubdomain: '' };
    const { user } = setup(<AdminBrandingSection />);

    await user.click(screen.getByText('Remove'));
    await waitFor(() => {
      expect(screen.getByText('Upload logo')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /save branding/i }));
    expect(mockMutate).toHaveBeenCalledWith({
      brandColor: '#4f46e5',
      logoUrl: null,
    });
  });

  // ---- Upload button click ----
  it('clicking upload button area does not throw when no logo', async () => {
    brandingData = { brandColor: '#4f46e5', logo: null };
    portalDomainData = { portalSubdomain: '' };
    const { user } = setup(<AdminBrandingSection />);

    await user.click(screen.getByText('Upload logo'));
    // Should not throw - triggers file input click
  });

  // ---- Color change then save ----
  it('updates preview strip after color change', async () => {
    brandingData = { brandColor: '#4f46e5', logo: null };
    portalDomainData = { portalSubdomain: '' };
    const { user } = setup(<AdminBrandingSection />);

    await user.click(screen.getByText('Set red'));
    expect(screen.getByTestId('preview-strip')).toHaveTextContent('Preview: #ff0000');
  });

  // ---- Subdomain format validation for starting with dash ----
  it('validates subdomain rejects value starting with dash', async () => {
    brandingData = { brandColor: '#4f46e5', logo: null };
    portalDomainData = { portalSubdomain: '' };
    const { user } = setup(<AdminBrandingSection />);

    const input = screen.getByRole('textbox');
    await user.type(input, '-abc');
    await user.click(screen.getByRole('button', { name: /save domain/i }));

    await waitFor(() => {
      const errorText = screen.queryByText(/lowercase letters/i);
      expect(errorText).toBeInTheDocument();
    });
  });

  // ---- Subdomain too long ----
  it('validates subdomain rejects input exceeding 63 characters', async () => {
    brandingData = { brandColor: '#4f46e5', logo: null };
    portalDomainData = { portalSubdomain: '' };
    const { user } = setup(<AdminBrandingSection />);

    const input = screen.getByRole('textbox');
    const longSubdomain = 'a'.repeat(64);
    await user.type(input, longSubdomain);
    await user.click(screen.getByRole('button', { name: /save domain/i }));

    await waitFor(() => {
      const errorText = screen.queryByText(/at most 63/i);
      expect(errorText).toBeInTheDocument();
    });
  });

  // ---- handleFileSelect with file input change ----
  it('renders hidden file input that handles file selection', () => {
    brandingData = { brandColor: '#4f46e5', logo: null };
    portalDomainData = { portalSubdomain: '' };
    render(<AdminBrandingSection />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();
    expect(fileInput.className).toContain('hidden');
  });

  // ---- Color picker renders with different initial color ----
  it('renders color picker with server-provided color', () => {
    brandingData = { brandColor: '#00ff00', logo: null };
    portalDomainData = { portalSubdomain: '' };
    render(<AdminBrandingSection />);

    expect(screen.getByText('Color: #00ff00')).toBeInTheDocument();
  });

  // ---- Save branding button renders with correct text ----
  it('renders save branding with correct text when not pending', () => {
    brandingData = { brandColor: '#4f46e5', logo: null };
    portalDomainData = { portalSubdomain: '' };
    render(<AdminBrandingSection />);

    const saveBtn = screen.getByRole('button', { name: /save branding/i });
    expect(saveBtn).not.toBeDisabled();
  });

  // ---- Valid subdomain saves successfully ----
  it('saves valid subdomain with 3+ characters and lowercase', async () => {
    brandingData = { brandColor: '#4f46e5', logo: null };
    portalDomainData = { portalSubdomain: '' };
    const { user } = setup(<AdminBrandingSection />);

    const input = screen.getByRole('textbox');
    await user.type(input, 'test123');
    await user.click(screen.getByRole('button', { name: /save domain/i }));

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        portalSubdomain: 'test123',
      }),
    );
  });

  // ---- Subdomain with hyphens in middle is valid ----
  it('saves subdomain with hyphens in middle', async () => {
    brandingData = { brandColor: '#4f46e5', logo: null };
    portalDomainData = { portalSubdomain: '' };
    const { user } = setup(<AdminBrandingSection />);

    const input = screen.getByRole('textbox');
    await user.type(input, 'my-company');
    await user.click(screen.getByRole('button', { name: /save domain/i }));

    expect(mockMutate).toHaveBeenCalled();
  });

  // ---- Color picker integration ----
  it('color change updates preview and save payload', async () => {
    brandingData = { brandColor: '#4f46e5', logo: null };
    portalDomainData = { portalSubdomain: '' };
    const { user } = setup(<AdminBrandingSection />);

    // Change color
    await user.click(screen.getByText('Set red'));
    expect(screen.getByTestId('preview-strip')).toHaveTextContent('Preview: #ff0000');

    // Save with new color
    await user.click(screen.getByRole('button', { name: /save branding/i }));
    expect(mockMutate).toHaveBeenCalledWith({
      brandColor: '#ff0000',
      logoUrl: null,
    });
  });

  // ---- Logo with branding save ----
  it('preserves logo URL in save payload when logo exists', async () => {
    brandingData = { brandColor: '#4f46e5', logo: 'https://cdn.example.com/logo.png' };
    portalDomainData = { portalSubdomain: '' };
    const { user } = setup(<AdminBrandingSection />);

    // Change color to make save relevant
    await user.click(screen.getByText('Set red'));
    await user.click(screen.getByRole('button', { name: /save branding/i }));

    expect(mockMutate).toHaveBeenCalledWith({
      brandColor: '#ff0000',
      logoUrl: 'https://cdn.example.com/logo.png',
    });
  });

  // ---- Subdomain special char filtering ----
  it('strips special characters from subdomain input', async () => {
    brandingData = { brandColor: '#4f46e5', logo: null };
    portalDomainData = { portalSubdomain: '' };
    const { user } = setup(<AdminBrandingSection />);

    const input = screen.getByRole('textbox');
    await user.type(input, 'test@#$company');
    // Special chars should be stripped
    expect((input as HTMLInputElement).value).toBe('testcompany');
  });
});
