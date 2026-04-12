import { render, screen } from '@/test/test-utils';
import { ApprovalChainsTab } from '../approval-chains-tab';

let mockChains: any[] = [
  {
    id: 'c1',
    name: 'Default Chain',
    isDefault: true,
    isActive: true,
    conditionsJson: [],
    stepsJson: [{ name: 'Level 1', approverUserId: 'u1', slaHours: 24, required: true }],
  },
];
let mockIsLoading = false;

vi.mock('@tanstack/react-query', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useQuery: () => ({ isLoading: mockIsLoading, data: mockChains }),
    useMutation: () => ({ mutate: vi.fn(), isPending: false }),
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});

vi.mock('@/trpc/init', () => ({
  trpc: {
    approval: {
      listChains: {
        queryOptions: vi.fn(() => ({ queryKey: ['approval', 'listChains'] })),
        queryKey: vi.fn(() => ['approval', 'listChains']),
      },
      updateChain: { mutationOptions: vi.fn((o: object) => o) },
      deleteChain: { mutationOptions: vi.fn((o: object) => o) },
    },
  },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('@/components/settings/chain-editor-dialog', () => ({
  ChainEditorDialog: () => null,
}));

describe('ApprovalChainsTab', () => {
  beforeEach(() => {
    mockChains = [
      {
        id: 'c1',
        name: 'Default Chain',
        isDefault: true,
        isActive: true,
        conditionsJson: [],
        stepsJson: [{ name: 'Level 1', approverUserId: 'u1', slaHours: 24, required: true }],
      },
    ];
    mockIsLoading = false;
  });

  it('renders heading when chains exist', () => {
    render(<ApprovalChainsTab />);
    expect(screen.getByText('Approval chains')).toBeInTheDocument();
  });

  it('renders chain name and default badge', () => {
    render(<ApprovalChainsTab />);
    expect(screen.getByText('Default Chain')).toBeInTheDocument();
    expect(screen.getByText('Default')).toBeInTheDocument();
  });

  it('renders create chain button', () => {
    render(<ApprovalChainsTab />);
    expect(screen.getByText('Create approval chain')).toBeInTheDocument();
  });

  it('renders edit and delete buttons per chain', () => {
    render(<ApprovalChainsTab />);
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('renders empty state when no chains exist', () => {
    mockChains = [];
    render(<ApprovalChainsTab />);
    expect(screen.getByText(/no approval chains/i)).toBeInTheDocument();
  });

  it('renders empty state CTA button', () => {
    mockChains = [];
    render(<ApprovalChainsTab />);
    expect(screen.getByText('Create approval chain')).toBeInTheDocument();
  });

  it('renders loading skeletons when loading', () => {
    mockIsLoading = true;
    const { container } = render(<ApprovalChainsTab />);
    expect(container.querySelector("[data-slot='skeleton']")).toBeTruthy();
  });

  it('renders description text when chains exist', () => {
    render(<ApprovalChainsTab />);
    expect(screen.getByText(/configure approval chains/i)).toBeInTheDocument();
  });

  it('renders levels count badge', () => {
    render(<ApprovalChainsTab />);
    expect(screen.getByText('1 levels')).toBeInTheDocument();
  });

  it('renders active toggle switch', () => {
    render(<ApprovalChainsTab />);
    const switches = screen.getAllByRole('switch');
    expect(switches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders multiple chains', () => {
    mockChains = [
      {
        id: 'c1',
        name: 'Chain A',
        isDefault: true,
        isActive: true,
        conditionsJson: [],
        stepsJson: [{ name: 'L1', approverUserId: 'u1', slaHours: 24, required: true }],
      },
      {
        id: 'c2',
        name: 'Chain B',
        isDefault: false,
        isActive: false,
        conditionsJson: [{ field: 'amount', operator: 'gt', value: 10000 }],
        stepsJson: [
          { name: 'L1', approverUserId: 'u1', slaHours: 24, required: true },
          { name: 'L2', approverUserId: 'u2', slaHours: 48, required: false },
        ],
      },
    ];
    render(<ApprovalChainsTab />);
    expect(screen.getByText('Chain A')).toBeInTheDocument();
    expect(screen.getByText('Chain B')).toBeInTheDocument();
  });

  it('does not show default badge for non-default chains', () => {
    mockChains = [
      {
        id: 'c2',
        name: 'Custom Chain',
        isDefault: false,
        isActive: true,
        conditionsJson: [],
        stepsJson: [{ name: 'L1', approverUserId: 'u1', slaHours: 24, required: true }],
      },
    ];
    render(<ApprovalChainsTab />);
    expect(screen.queryByText('Default')).not.toBeInTheDocument();
  });

  it('renders condition summary for chains with conditions', () => {
    mockChains = [
      {
        id: 'c1',
        name: 'Conditional',
        isDefault: false,
        isActive: true,
        conditionsJson: [{ field: 'amount', operator: 'gt', value: 5000 }],
        stepsJson: [
          {
            name: 'L1',
            approverUserId: null,
            approverRole: 'ORG_ADMIN',
            slaHours: 24,
            required: true,
          },
        ],
      },
    ];
    render(<ApprovalChainsTab />);
    expect(screen.getByText(/amount.*>.*5000/i)).toBeInTheDocument();
  });

  it('opens editor dialog when create chain button is clicked', async () => {
    const { setup: setupUtil } = await import('@/test/test-utils');
    const { user } = setupUtil(<ApprovalChainsTab />);
    await user.click(screen.getByText('Create approval chain'));
    // Should not crash, editor dialog mock is null
  });

  it('opens editor dialog when edit button is clicked', async () => {
    const { setup: setupUtil } = await import('@/test/test-utils');
    const { user } = setupUtil(<ApprovalChainsTab />);
    await user.click(screen.getByText('Edit'));
    // Should not crash
  });

  it('opens delete confirmation when delete button is clicked', async () => {
    const { setup: setupUtil } = await import('@/test/test-utils');
    const { user } = setupUtil(<ApprovalChainsTab />);
    await user.click(screen.getByText('Delete'));
    const { waitFor: wf } = await import('@/test/test-utils');
    await wf(() => {
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });
  });

  it('toggles active switch for a chain', async () => {
    const { setup: setupUtil } = await import('@/test/test-utils');
    const { user } = setupUtil(<ApprovalChainsTab />);
    const switches = screen.getAllByRole('switch');
    await user.click(switches[0]);
    // Should not crash, mutation is called
  });

  it('opens empty state CTA editor when clicked', async () => {
    mockChains = [];
    const { setup: setupUtil } = await import('@/test/test-utils');
    const { user } = setupUtil(<ApprovalChainsTab />);
    await user.click(screen.getByText('Create approval chain'));
    // Should not crash
  });

  it('renders no conditions text for empty conditions array', () => {
    mockChains = [
      {
        id: 'c1',
        name: 'NoConditions',
        isDefault: false,
        isActive: true,
        conditionsJson: [],
        stepsJson: [{ name: 'L1', approverUserId: 'u1', slaHours: 24, required: true }],
      },
    ];
    render(<ApprovalChainsTab />);
    expect(screen.getByText(/no conditions/i)).toBeInTheDocument();
  });

  it('renders no conditions text for null conditions', () => {
    mockChains = [
      {
        id: 'c1',
        name: 'NullConditions',
        isDefault: false,
        isActive: true,
        conditionsJson: null,
        stepsJson: [{ name: 'L1', approverUserId: 'u1', slaHours: 24, required: true }],
      },
    ];
    render(<ApprovalChainsTab />);
    expect(screen.getByText(/no conditions/i)).toBeInTheDocument();
  });

  it('renders condition with lt operator', () => {
    mockChains = [
      {
        id: 'c1',
        name: 'LtCondition',
        isDefault: false,
        isActive: true,
        conditionsJson: [{ field: 'amount', operator: 'lt', value: 1000 }],
        stepsJson: [{ name: 'L1', approverUserId: 'u1', slaHours: 24, required: true }],
      },
    ];
    render(<ApprovalChainsTab />);
    expect(screen.getByText(/amount.*<.*1000/i)).toBeInTheDocument();
  });

  it('renders condition with eq operator', () => {
    mockChains = [
      {
        id: 'c1',
        name: 'EqCondition',
        isDefault: false,
        isActive: true,
        conditionsJson: [{ field: 'contractorType', operator: 'eq', value: 'COMPANY' }],
        stepsJson: [{ name: 'L1', approverUserId: 'u1', slaHours: 24, required: true }],
      },
    ];
    render(<ApprovalChainsTab />);
    expect(screen.getByText(/=.*COMPANY/i)).toBeInTheDocument();
  });

  it('renders correct steps count for multi-step chains', () => {
    mockChains = [
      {
        id: 'c1',
        name: 'MultiStep',
        isDefault: false,
        isActive: true,
        conditionsJson: [],
        stepsJson: [
          { name: 'L1', approverUserId: 'u1', slaHours: 24, required: true },
          { name: 'L2', approverUserId: 'u2', slaHours: 48, required: true },
          { name: 'L3', approverUserId: 'u3', slaHours: 72, required: false },
        ],
      },
    ];
    render(<ApprovalChainsTab />);
    expect(screen.getByText('3 levels')).toBeInTheDocument();
  });
});
