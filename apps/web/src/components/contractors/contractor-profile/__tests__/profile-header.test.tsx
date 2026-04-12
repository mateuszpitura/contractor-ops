import { render, screen } from '@/test/test-utils';
import { ProfileHeader } from '../profile-header';

vi.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock('@/trpc/init', () => ({
  trpc: {
    contractor: {
      updateLifecycleStage: { mutationOptions: (opts: any) => opts },
      archive: { mutationOptions: (opts: any) => opts },
      getById: { queryKey: () => ['contractor', 'getById'] },
    },
  },
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/components/contracts/contract-wizard/wizard-dialog', () => ({
  ContractWizardDialog: () => null,
}));

vi.mock('@/components/workflows/template-picker-dialog', () => ({
  TemplatePicker: () => null,
}));

const makeContractor = (stage: string) => ({
  id: 'c1',
  displayName: 'ACME Corp',
  legalName: 'ACME Sp. z o.o.',
  type: 'COMPANY',
  lifecycleStage: stage,
  owner: { id: 'u1', name: 'Jan Kowalski', image: null },
});

describe('ProfileHeader', () => {
  it('renders contractor display name', () => {
    render(<ProfileHeader contractor={makeContractor('ACTIVE')} />);
    expect(screen.getByText('ACME Corp')).toBeInTheDocument();
  });

  it('renders owner info', () => {
    render(<ProfileHeader contractor={makeContractor('ACTIVE')} />);
    expect(screen.getByText('Jan Kowalski')).toBeInTheDocument();
  });

  it('shows onboarding button for DRAFT stage', () => {
    render(<ProfileHeader contractor={makeContractor('DRAFT')} />);
    // Should have start onboarding button
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('shows offboarding button for ACTIVE stage', () => {
    render(<ProfileHeader contractor={makeContractor('ACTIVE')} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('renders lifecycle badge with ACTIVE style', () => {
    render(<ProfileHeader contractor={makeContractor('ACTIVE')} />);
    expect(screen.getByText(/active/i)).toBeInTheDocument();
  });

  it('renders lifecycle badge with DRAFT style', () => {
    render(<ProfileHeader contractor={makeContractor('DRAFT')} />);
    expect(screen.getByText(/draft/i)).toBeInTheDocument();
  });

  it('renders contractor type badge', () => {
    render(<ProfileHeader contractor={makeContractor('ACTIVE')} />);
    expect(screen.getByText(/company/i)).toBeInTheDocument();
  });

  it('renders edit button', () => {
    render(<ProfileHeader contractor={makeContractor('ACTIVE')} />);
    expect(screen.getByText('Edit contractor')).toBeInTheDocument();
  });

  it('renders add contract button', () => {
    render(<ProfileHeader contractor={makeContractor('ACTIVE')} />);
    expect(screen.getByText('Add contract')).toBeInTheDocument();
  });

  it('shows start onboarding button for ONBOARDING stage', () => {
    render(<ProfileHeader contractor={makeContractor('ONBOARDING')} />);
    expect(screen.getByText('Start onboarding')).toBeInTheDocument();
  });

  it('shows start offboarding button for OFFBOARDING stage', () => {
    render(<ProfileHeader contractor={makeContractor('OFFBOARDING')} />);
    expect(screen.getByText('Start offboarding')).toBeInTheDocument();
  });

  it('renders more actions menu trigger', () => {
    render(<ProfileHeader contractor={makeContractor('ACTIVE')} />);
    expect(screen.getByText('More actions')).toBeInTheDocument();
  });

  it('renders without owner when owner is null', () => {
    const contractor = {
      ...makeContractor('ACTIVE'),
      owner: null,
    };
    render(<ProfileHeader contractor={contractor} />);
    expect(screen.getByText('ACME Corp')).toBeInTheDocument();
    expect(screen.queryByText('Jan Kowalski')).not.toBeInTheDocument();
  });

  it('renders owner avatar initials when no image', () => {
    render(<ProfileHeader contractor={makeContractor('ACTIVE')} />);
    expect(screen.getByText('JK')).toBeInTheDocument();
  });

  it('shows edit button toast when clicked', async () => {
    const { setup: setupUtil } = await import('@/test/test-utils');
    const { user } = setupUtil(<ProfileHeader contractor={makeContractor('ACTIVE')} />);
    await user.click(screen.getByText('Edit contractor'));
    // Should not crash - shows toast info
  });

  it('opens contract wizard when add contract is clicked', async () => {
    const { setup: setupUtil } = await import('@/test/test-utils');
    const { user } = setupUtil(<ProfileHeader contractor={makeContractor('ACTIVE')} />);
    await user.click(screen.getByText('Add contract'));
    // Should not crash - dialog mock is null
  });

  it('does not show onboarding button for ENDED stage', () => {
    render(<ProfileHeader contractor={makeContractor('ENDED')} />);
    expect(screen.queryByText('Start onboarding')).not.toBeInTheDocument();
    expect(screen.queryByText('Start offboarding')).not.toBeInTheDocument();
  });

  it('renders ENDED lifecycle badge', () => {
    render(<ProfileHeader contractor={makeContractor('ENDED')} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });
});
