import { render, screen, setup, waitFor } from '@/test/test-utils';
import { AdminBrandingSection } from '../admin-branding-section';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let brandingData: unknown = null;
let brandingLoading = false;
const { mockMutate, mockMutateAsync } = vi.hoisted(() => ({
  mockMutate: vi.fn(),
  mockMutateAsync: vi.fn(),
}));

vi.mock('@tanstack/react-query', async importOriginal => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: (opts: { select?: (data: unknown) => unknown }) => {
      if (opts?.select && brandingData) {
        opts.select(brandingData);
      }
      return { data: brandingData, isLoading: brandingLoading };
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
  });

  it('renders loading skeleton when branding data is loading', () => {
    brandingLoading = true;
    const { container } = render(<AdminBrandingSection />);

    const skeletons = container.querySelectorAll("[data-slot='skeleton']");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders branding section heading when loaded', () => {
    brandingData = { brandColor: '#4f46e5', logo: null };
    render(<AdminBrandingSection />);

    expect(screen.getByText('Portal Branding')).toBeInTheDocument();
    expect(screen.getByText(/customize/i)).toBeInTheDocument();
  });

  it('renders logo upload button when no logo', () => {
    brandingData = { brandColor: '#4f46e5', logo: null };
    render(<AdminBrandingSection />);

    expect(screen.getByText('Upload logo')).toBeInTheDocument();
  });

  it('renders color picker with current color', () => {
    brandingData = { brandColor: '#4f46e5', logo: null };
    render(<AdminBrandingSection />);

    expect(screen.getByTestId('color-picker')).toBeInTheDocument();
    expect(screen.getByText('Color: #4f46e5')).toBeInTheDocument();
  });

  it('renders preview strip', () => {
    brandingData = { brandColor: '#4f46e5', logo: null };
    render(<AdminBrandingSection />);

    expect(screen.getByTestId('preview-strip')).toBeInTheDocument();
  });

  it('renders save branding button', () => {
    brandingData = { brandColor: '#4f46e5', logo: null };
    render(<AdminBrandingSection />);

    expect(screen.getByRole('button', { name: /save branding/i })).toBeInTheDocument();
  });

  it('calls updateBranding mutation on save', async () => {
    brandingData = { brandColor: '#4f46e5', logo: null };
    const { user } = setup(<AdminBrandingSection />);

    await user.click(screen.getByRole('button', { name: /save branding/i }));

    expect(mockMutate).toHaveBeenCalledWith({
      brandColor: '#4f46e5',
      logoUrl: null,
    });
  });

  it('updates color when color picker changes', async () => {
    brandingData = { brandColor: '#4f46e5', logo: null };
    const { user } = setup(<AdminBrandingSection />);

    await user.click(screen.getByText('Set red'));

    await waitFor(() => {
      expect(screen.getByText('Color: #ff0000')).toBeInTheDocument();
    });
  });

  it('renders logo label and hint text', () => {
    brandingData = { brandColor: '#4f46e5', logo: null };
    render(<AdminBrandingSection />);

    expect(screen.getByText('Logo')).toBeInTheDocument();
    expect(screen.getByText(/png.*jpg.*svg/i)).toBeInTheDocument();
  });

  it('renders accent color label', () => {
    brandingData = { brandColor: '#4f46e5', logo: null };
    render(<AdminBrandingSection />);

    expect(screen.getByText('Accent Color')).toBeInTheDocument();
  });

  it('renders logo preview when logo URL exists', () => {
    brandingData = { brandColor: '#4f46e5', logo: 'https://example.com/logo.png' };
    render(<AdminBrandingSection />);

    const img = screen.getByAltText('Organization logo');
    expect(img).toBeInTheDocument();
    expect(screen.getByText('Remove')).toBeInTheDocument();
  });

  it('removes logo when remove button is clicked', async () => {
    brandingData = { brandColor: '#4f46e5', logo: 'https://example.com/logo.png' };
    const { user } = setup(<AdminBrandingSection />);

    await user.click(screen.getByText('Remove'));

    await waitFor(() => {
      expect(screen.getByText('Upload logo')).toBeInTheDocument();
    });
  });

  it('renders hidden file input for logo upload', () => {
    brandingData = { brandColor: '#4f46e5', logo: null };
    render(<AdminBrandingSection />);

    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).toBeInTheDocument();
    expect(fileInput).toHaveAttribute('accept', 'image/png,image/jpeg,image/svg+xml');
  });

  it('saves branding with updated color after color change', async () => {
    brandingData = { brandColor: '#4f46e5', logo: null };
    const { user } = setup(<AdminBrandingSection />);

    await user.click(screen.getByText('Set red'));
    await user.click(screen.getByRole('button', { name: /save branding/i }));

    expect(mockMutate).toHaveBeenCalledWith({
      brandColor: '#ff0000',
      logoUrl: null,
    });
  });

  it('renders preview strip with correct color value', () => {
    brandingData = { brandColor: '#ff5722', logo: null };
    render(<AdminBrandingSection />);

    expect(screen.getByTestId('preview-strip')).toHaveTextContent('Preview: #ff5722');
  });

  it('renders branding description text', () => {
    brandingData = { brandColor: '#4f46e5', logo: null };
    render(<AdminBrandingSection />);

    expect(screen.getByText(/customize/i)).toBeInTheDocument();
  });

  it('renders logo section with upload button when no logo present', () => {
    brandingData = { brandColor: '#4f46e5', logo: null };
    render(<AdminBrandingSection />);

    expect(screen.getByText('Logo')).toBeInTheDocument();
    expect(screen.getByText('Upload logo')).toBeInTheDocument();
    expect(screen.queryByAltText('Organization logo')).not.toBeInTheDocument();
  });

  it('saves branding with logo URL when logo is present', async () => {
    brandingData = { brandColor: '#4f46e5', logo: 'https://example.com/logo.png' };
    const { user } = setup(<AdminBrandingSection />);

    await user.click(screen.getByRole('button', { name: /save branding/i }));

    expect(mockMutate).toHaveBeenCalledWith({
      brandColor: '#4f46e5',
      logoUrl: 'https://example.com/logo.png',
    });
  });

  it('renders color picker and allows color change before save', async () => {
    brandingData = { brandColor: '#000000', logo: null };
    const { user } = setup(<AdminBrandingSection />);

    expect(screen.getByText('Color: #000000')).toBeInTheDocument();
    await user.click(screen.getByText('Set red'));
    await waitFor(() => {
      expect(screen.getByText('Color: #ff0000')).toBeInTheDocument();
    });
    expect(screen.getByTestId('preview-strip')).toHaveTextContent('Preview: #ff0000');
  });

  it('renders remove button and removes logo on click', async () => {
    brandingData = { brandColor: '#4f46e5', logo: 'https://example.com/logo.png' };
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
    render(<AdminBrandingSection />);

    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).toHaveAttribute('accept', 'image/png,image/jpeg,image/svg+xml');
  });

  it('clicking upload button area does not throw when no logo', async () => {
    brandingData = { brandColor: '#4f46e5', logo: null };
    const { user } = setup(<AdminBrandingSection />);

    await user.click(screen.getByText('Upload logo'));
  });

  it('updates preview strip after color change', async () => {
    brandingData = { brandColor: '#4f46e5', logo: null };
    const { user } = setup(<AdminBrandingSection />);

    await user.click(screen.getByText('Set red'));
    expect(screen.getByTestId('preview-strip')).toHaveTextContent('Preview: #ff0000');
  });

  it('renders hidden file input that handles file selection', () => {
    brandingData = { brandColor: '#4f46e5', logo: null };
    render(<AdminBrandingSection />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();
    expect(fileInput.className).toContain('hidden');
  });

  it('renders color picker with server-provided color', () => {
    brandingData = { brandColor: '#00ff00', logo: null };
    render(<AdminBrandingSection />);

    expect(screen.getByText('Color: #00ff00')).toBeInTheDocument();
  });

  it('renders save branding with correct text when not pending', () => {
    brandingData = { brandColor: '#4f46e5', logo: null };
    render(<AdminBrandingSection />);

    const saveBtn = screen.getByRole('button', { name: /save branding/i });
    expect(saveBtn).not.toBeDisabled();
  });

  it('color change updates preview and save payload', async () => {
    brandingData = { brandColor: '#4f46e5', logo: null };
    const { user } = setup(<AdminBrandingSection />);

    await user.click(screen.getByText('Set red'));
    expect(screen.getByTestId('preview-strip')).toHaveTextContent('Preview: #ff0000');

    await user.click(screen.getByRole('button', { name: /save branding/i }));
    expect(mockMutate).toHaveBeenCalledWith({
      brandColor: '#ff0000',
      logoUrl: null,
    });
  });

  it('preserves logo URL in save payload when logo exists', async () => {
    brandingData = { brandColor: '#4f46e5', logo: 'https://cdn.example.com/logo.png' };
    const { user } = setup(<AdminBrandingSection />);

    await user.click(screen.getByText('Set red'));
    await user.click(screen.getByRole('button', { name: /save branding/i }));

    expect(mockMutate).toHaveBeenCalledWith({
      brandColor: '#ff0000',
      logoUrl: 'https://cdn.example.com/logo.png',
    });
  });

  it('saves branding with null logo after removal', async () => {
    brandingData = { brandColor: '#4f46e5', logo: 'https://example.com/logo.png' };
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
});
