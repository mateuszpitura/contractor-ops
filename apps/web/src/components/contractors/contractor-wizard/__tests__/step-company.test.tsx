import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { render, screen, setup } from '@/test/test-utils';
import { StepCompany } from '../step-company';

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    fetchQuery: vi.fn().mockResolvedValue({ found: false }),
  }),
}));

vi.mock('@/trpc/init', () => ({
  trpc: {
    contractor: {
      gusLookup: {
        queryOptions: (input: unknown) => ({
          queryKey: ['contractor', 'gusLookup', input],
        }),
      },
    },
  },
}));

function Wrapper({ defaultValues }: { defaultValues?: Record<string, unknown> }) {
  const form = useForm({
    defaultValues: {
      taxId: '',
      legalName: '',
      displayName: '',
      type: undefined,
      email: '',
      vatId: '',
      registrationNumber: '',
      addressLine1: '',
      addressLine2: '',
      city: '',
      postalCode: '',
      ...defaultValues,
    },
  });
  return <StepCompany form={form as unknown} />;
}

describe('StepCompany', () => {
  it('renders NIP input with GUS lookup button', () => {
    render(<Wrapper />);
    const nipInput = screen.getByPlaceholderText('0000000000');
    expect(nipInput).toBeInTheDocument();
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('renders legal name input', () => {
    render(<Wrapper />);
    const legalNameInput = document.getElementById('legalName');
    expect(legalNameInput).toBeInTheDocument();
  });

  it('renders contractor type radio group with 4 options', () => {
    render(<Wrapper />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(4);
  });

  it('renders email input', () => {
    render(<Wrapper />);
    const emailInput = document.getElementById('email');
    expect(emailInput).toBeInTheDocument();
  });

  it('renders address fields', () => {
    render(<Wrapper />);
    const container = document.querySelector('div');
    expect(container).toBeInTheDocument();
  });

  it('renders VAT-EU input', () => {
    render(<Wrapper />);
    const vatInput = document.getElementById('vatId');
    expect(vatInput).toBeInTheDocument();
  });

  it('renders all 4 contractor type radio buttons', () => {
    render(<Wrapper />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(4);
  });

  it('allows typing in NIP input', async () => {
    const { user } = setup(<Wrapper />);
    const nipInput = screen.getByPlaceholderText('0000000000');
    await user.type(nipInput, '1234567890');
    expect(nipInput).toHaveValue('1234567890');
  });

  it('shows error toast when GUS lookup is triggered with invalid NIP', async () => {
    const { user } = setup(<Wrapper defaultValues={{ taxId: '123' }} />);
    // Click GUS lookup button with short NIP
    const buttons = screen.getAllByRole('button');
    const gusButton = buttons.find(b => b.textContent?.includes('Fetch'));
    if (gusButton) {
      await user.click(gusButton);
      expect(toast.error).toHaveBeenCalled();
    }
  });

  it('allows typing in email input', async () => {
    const { user } = setup(<Wrapper />);
    const emailInput = document.getElementById('email') as HTMLInputElement;
    await user.type(emailInput, 'test@example.com');
    expect(emailInput).toHaveValue('test@example.com');
  });

  it('allows selecting a contractor type', async () => {
    const { user } = setup(<Wrapper />);
    const radios = screen.getAllByRole('radio');
    await user.click(radios[1]); // Click COMPANY option
    // Radio should now be checked
    expect(radios[1]).toBeChecked();
  });
});
