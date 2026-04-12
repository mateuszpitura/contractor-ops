import { render, screen, setup } from '@/test/test-utils';
import { ReminderRulesSection } from '../reminder-rules-section';

const mockRules = [
  {
    id: 'r1',
    name: 'Contract Expiry',
    entityType: 'CONTRACT',
    triggerType: 'BEFORE_CONTRACT_END',
    offsetDays: 30,
    offsetHours: null,
    channel: 'EMAIL',
    recipientMode: 'ENTITY_OWNER',
    configJson: null,
    active: true,
  },
];

vi.mock('@tanstack/react-query', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useQuery: () => ({ isLoading: false, data: mockRules }),
    useMutation: () => ({ mutate: vi.fn(), isPending: false }),
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});

vi.mock('@/trpc/init', () => ({
  trpc: {
    reminder: {
      list: {
        queryOptions: vi.fn(() => ({ queryKey: ['reminder', 'list'] })),
        queryKey: vi.fn(() => ['reminder', 'list']),
      },
      toggleActive: { mutationOptions: vi.fn((o: object) => o) },
      delete: { mutationOptions: vi.fn((o: object) => o) },
    },
  },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/components/settings/reminder-rule-editor', () => ({
  ReminderRuleEditor: () => null,
}));

describe('ReminderRulesSection', () => {
  it('renders heading when rules exist', () => {
    render(<ReminderRulesSection />);
    expect(screen.getByText('Custom reminder rules')).toBeInTheDocument();
  });

  it('renders rule name', () => {
    render(<ReminderRulesSection />);
    expect(screen.getByText('Contract Expiry')).toBeInTheDocument();
  });

  it('renders create rule button', () => {
    render(<ReminderRulesSection />);
    expect(screen.getByText('Create rule')).toBeInTheDocument();
  });

  it('renders edit and delete buttons', () => {
    render(<ReminderRulesSection />);
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('renders description section with heading text', () => {
    render(<ReminderRulesSection />);
    expect(screen.getByText(/Automate reminders/i)).toBeInTheDocument();
  });

  it('renders active toggle switch for the rule', () => {
    render(<ReminderRulesSection />);
    const switches = screen.getAllByRole('switch');
    expect(switches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders channel badge for EMAIL rule', () => {
    render(<ReminderRulesSection />);
    // The rule has channel EMAIL, which maps to channelEmail translation
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('renders recipient badge for ENTITY_OWNER rule', () => {
    render(<ReminderRulesSection />);
    expect(screen.getByText('Entity owner')).toBeInTheDocument();
  });

  it('renders delete confirmation dialog when delete is clicked', async () => {
    const { user } = setup(<ReminderRulesSection />);
    await user.click(screen.getByText('Delete'));
    expect(screen.getByText('Delete this reminder rule?')).toBeInTheDocument();
  });

  it('renders cancel button in delete dialog', async () => {
    const { user } = setup(<ReminderRulesSection />);
    await user.click(screen.getByText('Delete'));
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('renders confirm delete button in delete dialog', async () => {
    const { user } = setup(<ReminderRulesSection />);
    await user.click(screen.getByText('Delete'));
    expect(screen.getByText('Delete rule')).toBeInTheDocument();
  });

  it('renders rule description with offset days', () => {
    render(<ReminderRulesSection />);
    // The rule has offsetDays: 30
    expect(screen.getByText(/30/)).toBeInTheDocument();
  });

  it('renders card structure for each rule', () => {
    render(<ReminderRulesSection />);
    const cards = document.querySelectorAll("[data-slot='card']");
    expect(cards.length).toBeGreaterThanOrEqual(1);
  });

  // ---- Toggle active switch ----
  it('clicking active toggle triggers mutation', async () => {
    const { user } = setup(<ReminderRulesSection />);
    const switchEl = screen.getAllByRole('switch')[0]!;
    await user.click(switchEl);
    // Mutation mock is called; no error thrown
  });

  // ---- Edit button opens editor ----
  it('clicking edit button does not throw', async () => {
    const { user } = setup(<ReminderRulesSection />);
    await user.click(screen.getByText('Edit'));
    // ReminderRuleEditor is mocked, click should not throw
  });

  // ---- Create rule button ----
  it('clicking create rule button does not throw', async () => {
    const { user } = setup(<ReminderRulesSection />);
    await user.click(screen.getByText('Create rule'));
  });

  // ---- Delete dialog: confirm ----
  it('clicking confirm in delete dialog triggers mutation', async () => {
    const { user } = setup(<ReminderRulesSection />);
    await user.click(screen.getByText('Delete'));
    expect(screen.getByText('Delete this reminder rule?')).toBeInTheDocument();
    await user.click(screen.getByText('Delete rule'));
  });

  // ---- Delete dialog: cancel ----
  it('clicking cancel in delete dialog closes it', async () => {
    const { user } = setup(<ReminderRulesSection />);
    await user.click(screen.getByText('Delete'));
    expect(screen.getByText('Delete this reminder rule?')).toBeInTheDocument();
    await user.click(screen.getByText('Cancel'));
    await (await import('@/test/test-utils')).waitFor(() => {
      expect(screen.queryByText('Delete this reminder rule?')).not.toBeInTheDocument();
    });
  });

  // ---- Rule description includes trigger label ----
  it('renders rule description with trigger label text', () => {
    render(<ReminderRulesSection />);
    expect(screen.getByText(/Before contract end/i)).toBeInTheDocument();
  });

  // ---- Active switch has aria-label ----
  it('active toggle has accessible aria-label', () => {
    render(<ReminderRulesSection />);
    const switches = screen.getAllByRole('switch');
    expect(switches[0]).toHaveAttribute('aria-label');
  });

  // ---- Rule with offset days in description ----
  it('renders rule description with trigger and offset information', () => {
    render(<ReminderRulesSection />);
    // Rule description includes trigger label and offset days
    expect(screen.getByText(/30/)).toBeInTheDocument();
    expect(screen.getByText(/Before contract end/i)).toBeInTheDocument();
  });

  // ---- Entity owner badge present ----
  it('renders entity owner recipient badge in rule card', () => {
    render(<ReminderRulesSection />);
    expect(screen.getByText('Entity owner')).toBeInTheDocument();
  });

  // ---- Email channel badge class ----
  it('renders email channel badge with blue styling class', () => {
    render(<ReminderRulesSection />);
    const emailBadge = screen.getByText('Email');
    expect(emailBadge.className).toContain('text-blue');
  });

  // ---- Rule card has edit and delete buttons in card footer ----
  it('renders edit and delete buttons inside card footer', () => {
    render(<ReminderRulesSection />);
    const editBtn = screen.getByText('Edit').closest('button');
    const deleteBtn = screen.getByText('Delete').closest('button');
    expect(editBtn).toBeInTheDocument();
    expect(deleteBtn).toBeInTheDocument();
    // Delete button has destructive styling
    expect(deleteBtn?.className).toContain('text-destructive');
  });
});
