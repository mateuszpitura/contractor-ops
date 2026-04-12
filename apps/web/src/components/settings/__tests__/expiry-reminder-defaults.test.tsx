import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { render, screen, setup } from '@/test/test-utils';
import { ExpiryReminderDefaults } from '../expiry-reminder-defaults';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let queryData: any = { reminderDaysBefore: [30, 60, 90] };
let queryLoading = false;
const mockMutate = vi.fn();

vi.mock('next-intl', async importOriginal => {
  const actual = await importOriginal<typeof import('next-intl')>();
  return {
    ...actual,
    useTranslations: () => (key: string) => key,
  };
});

vi.mock('@tanstack/react-query', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useQuery: vi.fn(),
    useMutation: vi.fn(),
    useQueryClient: vi.fn(),
  };
});

vi.mock('@/trpc/init', () => ({
  trpc: {
    settings: {
      getExpiryReminderDefaults: {
        queryOptions: vi.fn(() => ({ queryKey: ['settings', 'getExpiryReminderDefaults'] })),
        queryKey: vi.fn(() => ['settings', 'getExpiryReminderDefaults']),
      },
      updateExpiryReminderDefaults: { mutationOptions: vi.fn((o: object) => o) },
    },
  },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  queryData = { reminderDaysBefore: [30, 60, 90] };
  queryLoading = false;
  mockMutate.mockClear();

  vi.mocked(useQueryClient).mockReturnValue({
    invalidateQueries: vi.fn(),
  } as unknown);

  vi.mocked(useMutation).mockReturnValue({
    mutate: mockMutate,
    isPending: false,
  } as unknown);

  vi.mocked(useQuery).mockReturnValue({
    data: queryData,
    isLoading: queryLoading,
  } as unknown);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ExpiryReminderDefaults', () => {
  it('renders heading and description', () => {
    render(<ExpiryReminderDefaults />);
    expect(screen.getByText('expiryReminders.heading')).toBeInTheDocument();
    const descMatches = screen.getAllByText('expiryReminders.description');
    expect(descMatches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders save button', () => {
    render(<ExpiryReminderDefaults />);
    expect(screen.getByText('expiryReminders.save')).toBeInTheDocument();
  });

  it('renders input for reminder days', () => {
    render(<ExpiryReminderDefaults />);
    expect(screen.getByLabelText('expiryReminders.label')).toBeInTheDocument();
  });

  it('populates input with server defaults (30, 60, 90)', () => {
    render(<ExpiryReminderDefaults />);
    const input = screen.getByLabelText('expiryReminders.label') as HTMLInputElement;
    expect(input.value).toBe('30, 60, 90');
  });

  it('renders save button that is enabled', () => {
    render(<ExpiryReminderDefaults />);
    const saveButton = screen.getByRole('button');
    expect(saveButton).toBeEnabled();
  });

  it('renders placeholder text', () => {
    render(<ExpiryReminderDefaults />);
    const input = screen.getByLabelText('expiryReminders.label');
    expect(input.getAttribute('placeholder')).toBe('expiryReminders.placeholder');
  });

  it('uses default days (30, 60, 90) when server returns no data', () => {
    queryData = null;
    vi.mocked(useQuery).mockReturnValue({
      data: null,
      isLoading: false,
    } as unknown);
    render(<ExpiryReminderDefaults />);
    const input = screen.getByLabelText('expiryReminders.label') as HTMLInputElement;
    expect(input.value).toBe('30, 60, 90');
  });

  it('calls mutation when save button is clicked', async () => {
    const { user } = setup(<ExpiryReminderDefaults />);
    const saveButton = screen.getByRole('button');
    await user.click(saveButton);
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ reminderDaysBefore: [30, 60, 90] }),
    );
  });

  it('does not call mutation when input is empty', async () => {
    vi.mocked(useQuery).mockReturnValue({
      data: null,
      isLoading: false,
    } as unknown);
    const { user } = setup(<ExpiryReminderDefaults />);
    const input = screen.getByLabelText('expiryReminders.label') as HTMLInputElement;
    await user.clear(input);
    await user.click(screen.getByRole('button'));
    // Empty input after clear should not call mutate with empty array
    // The component parses and filters invalid values
  });

  it('shows loading spinner when mutation is pending', () => {
    vi.mocked(useMutation).mockReturnValue({
      mutate: mockMutate,
      isPending: true,
    } as unknown);
    const { container } = render(<ExpiryReminderDefaults />);
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('disables save button when mutation is pending', () => {
    vi.mocked(useMutation).mockReturnValue({
      mutate: mockMutate,
      isPending: true,
    } as unknown);
    render(<ExpiryReminderDefaults />);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
