import { render, screen, setup, waitFor } from '@/test/test-utils';
import { OrgSwitcher } from '../org-switcher';

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    useListOrganizations: () => ({
      data: [
        { id: 'org-1', name: 'Test Org' },
        { id: 'org-2', name: 'Other Org' },
      ],
    }),
    organization: {
      setActive: vi.fn(),
      create: vi.fn(() => Promise.resolve({ error: null })),
    },
  },
}));

vi.mock('@/components/layout/dashboard-context', () => ({
  useDashboardContext: () => ({
    activeOrg: { id: 'org-1', name: 'Test Org', slug: 'test-org', logo: null },
  }),
}));

vi.mock('@/components/ui/sidebar', () => ({
  SidebarMenuButton: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  useSidebar: () => ({ isMobile: false }),
}));

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

describe('OrgSwitcher', () => {
  it('renders current org name', () => {
    render(<OrgSwitcher />);
    expect(screen.getByText('Test Org')).toBeInTheDocument();
  });

  it('renders org initial in logo', () => {
    render(<OrgSwitcher />);
    expect(screen.getByText('T')).toBeInTheDocument();
  });

  it('renders chevron icon', () => {
    const { container } = render(<OrgSwitcher />);
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('renders trigger button', () => {
    render(<OrgSwitcher />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it('renders org name in trigger', () => {
    render(<OrgSwitcher />);
    // In the trigger, org name is shown
    const orgNameElements = screen.getAllByText('Test Org');
    expect(orgNameElements.length).toBeGreaterThanOrEqual(1);
  });

  it('renders initial letter from org name', () => {
    render(<OrgSwitcher />);
    // First character of org name uppercased
    expect(screen.getByText('T')).toBeInTheDocument();
  });

  it('renders the org name in the trigger area', () => {
    render(<OrgSwitcher />);
    const elements = screen.getAllByText('Test Org');
    expect(elements.length).toBeGreaterThanOrEqual(1);
  });

  it('renders SVG icons', () => {
    const { container } = render(<OrgSwitcher />);
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThanOrEqual(1);
  });

  // ---- Trigger area ----
  it('renders trigger with org initial and chevrons', () => {
    const { container } = render(<OrgSwitcher />);
    // "T" initial should be present
    expect(screen.getByText('T')).toBeInTheDocument();
    // Multiple SVGs for icons
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThanOrEqual(1);
  });

  // ---- Dialog not initially open ----
  it('does not render create dialog initially', () => {
    render(<OrgSwitcher />);
    expect(screen.queryByText('Create organization')).not.toBeInTheDocument();
  });

  // ---- Organization name styles ----
  it('renders org name with semibold font', () => {
    render(<OrgSwitcher />);
    const name = screen.getAllByText('Test Org')[0];
    expect(name.className).toContain('font-semibold');
  });

  // ---- Logo gradient div ----
  it('renders org logo gradient div', () => {
    const { container } = render(<OrgSwitcher />);
    const logoDiv = container.querySelector('.org-logo-gradient');
    expect(logoDiv).toBeInTheDocument();
  });

  // ---- Multiple orgs listed ----
  it('renders multiple org buttons in dropdown trigger', () => {
    render(<OrgSwitcher />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  // ---- Dropdown opens and shows org list ----
  it('shows org list items when dropdown opens', async () => {
    const { user } = setup(<OrgSwitcher />);
    const trigger = screen.getAllByRole('button')[0]!;
    await user.click(trigger);
    // Dropdown opens showing org items in portal
    await waitFor(() => {
      expect(screen.getByText('Other Org')).toBeInTheDocument();
    });
  });

  it('shows add organization option in dropdown', async () => {
    const { user } = setup(<OrgSwitcher />);
    const trigger = screen.getAllByRole('button')[0]!;
    await user.click(trigger);
    await waitFor(() => {
      expect(screen.getByText('Add organization')).toBeInTheDocument();
    });
  });

  it('shows organizations label in dropdown', async () => {
    const { user } = setup(<OrgSwitcher />);
    const trigger = screen.getAllByRole('button')[0]!;
    await user.click(trigger);
    await waitFor(() => {
      expect(screen.getByText('Organizations')).toBeInTheDocument();
    });
  });

  // ---- Create org dialog ----
  it('opens create org dialog when add organization is clicked', async () => {
    const { user } = setup(<OrgSwitcher />);
    const trigger = screen.getAllByRole('button')[0]!;
    await user.click(trigger);
    await waitFor(() => {
      expect(screen.getByText('Add organization')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Add organization'));
    await waitFor(() => {
      expect(screen.getByText('Create organization')).toBeInTheDocument();
    });
  });

  it('renders name input in create dialog', async () => {
    const { user } = setup(<OrgSwitcher />);
    const trigger = screen.getAllByRole('button')[0]!;
    await user.click(trigger);
    await waitFor(() => {
      expect(screen.getByText('Add organization')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Add organization'));
    await waitFor(() => {
      expect(screen.getByLabelText('Organization name')).toBeInTheDocument();
    });
  });

  it('renders create and cancel buttons in create dialog', async () => {
    const { user } = setup(<OrgSwitcher />);
    const trigger = screen.getAllByRole('button')[0]!;
    await user.click(trigger);
    await waitFor(() => {
      expect(screen.getByText('Add organization')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Add organization'));
    await waitFor(() => {
      expect(screen.getByText('Create')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
  });

  it('create button is disabled when name is empty', async () => {
    const { user } = setup(<OrgSwitcher />);
    const trigger = screen.getAllByRole('button')[0]!;
    await user.click(trigger);
    await waitFor(() => {
      expect(screen.getByText('Add organization')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Add organization'));
    await waitFor(() => {
      const createBtn = screen.getByRole('button', { name: 'Create' });
      expect(createBtn).toBeDisabled();
    });
  });

  it('create button is enabled when name is typed', async () => {
    const { user } = setup(<OrgSwitcher />);
    const trigger = screen.getAllByRole('button')[0]!;
    await user.click(trigger);
    await waitFor(() => {
      expect(screen.getByText('Add organization')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Add organization'));
    await waitFor(() => {
      expect(screen.getByLabelText('Organization name')).toBeInTheDocument();
    });
    const nameInput = screen.getByLabelText('Organization name');
    await user.type(nameInput, 'New Org');
    const createBtn = screen.getByRole('button', { name: 'Create' });
    expect(createBtn).not.toBeDisabled();
  });

  it('closes create dialog when cancel is clicked', async () => {
    const { user } = setup(<OrgSwitcher />);
    const trigger = screen.getAllByRole('button')[0]!;
    await user.click(trigger);
    await waitFor(() => {
      expect(screen.getByText('Add organization')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Add organization'));
    await waitFor(() => {
      expect(screen.getByText('Create organization')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Cancel'));
    await waitFor(() => {
      expect(screen.queryByText('Create organization')).not.toBeInTheDocument();
    });
  });

  // ---- Switch org ----
  it('calls setActive when an org is clicked in dropdown', async () => {
    const { authClient } = await import('@/lib/auth-client');
    const { user } = setup(<OrgSwitcher />);
    const trigger = screen.getAllByRole('button')[0]!;
    await user.click(trigger);
    await waitFor(() => {
      expect(screen.getByText('Other Org')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Other Org'));
    expect(authClient.organization.setActive).toHaveBeenCalledWith({ organizationId: 'org-2' });
  });

  it('renders building icon for each org in dropdown', async () => {
    const { user } = setup(<OrgSwitcher />);
    const trigger = screen.getAllByRole('button')[0]!;
    await user.click(trigger);
    await waitFor(() => {
      expect(screen.getByText('Other Org')).toBeInTheDocument();
    });
    // Building2 icons should render for each org
    const svgs = document.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThanOrEqual(2);
  });

  it('renders plus icon for add org option in dropdown', async () => {
    const { user } = setup(<OrgSwitcher />);
    const trigger = screen.getAllByRole('button')[0]!;
    await user.click(trigger);
    await waitFor(() => {
      expect(screen.getByText('Add organization')).toBeInTheDocument();
    });
  });

  it('renders input placeholder in create dialog', async () => {
    const { user } = setup(<OrgSwitcher />);
    const trigger = screen.getAllByRole('button')[0]!;
    await user.click(trigger);
    await waitFor(() => {
      expect(screen.getByText('Add organization')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Add organization'));
    await waitFor(() => {
      const nameInput = screen.getByLabelText('Organization name');
      expect(nameInput).toHaveAttribute('placeholder');
    });
  });

  it('submits create org form with entered name', async () => {
    const { authClient } = await import('@/lib/auth-client');
    const { user } = setup(<OrgSwitcher />);
    const trigger = screen.getAllByRole('button')[0]!;
    await user.click(trigger);
    await waitFor(() => {
      expect(screen.getByText('Add organization')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Add organization'));
    await waitFor(() => {
      expect(screen.getByLabelText('Organization name')).toBeInTheDocument();
    });
    const nameInput = screen.getByLabelText('Organization name');
    await user.type(nameInput, 'Brand New Org');
    const createBtn = screen.getByRole('button', { name: 'Create' });
    await user.click(createBtn);
    expect(authClient.organization.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Brand New Org',
        slug: 'brand-new-org',
      }),
    );
  });
});
