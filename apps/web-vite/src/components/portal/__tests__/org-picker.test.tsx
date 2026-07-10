/**
 * Pure presentational tests against shaped props.
 */

import { render, screen, setup } from '@/test/test-utils';

import { OrgPicker } from '../org-picker';

const orgs = [
  {
    subjectType: 'CONTRACTOR' as const,
    subjectId: 'c-1',
    contractorId: 'c-1',
    organizationId: 'org-1',
    orgName: 'Acme Corp',
    orgLogo: null,
  },
  {
    subjectType: 'CONTRACTOR' as const,
    subjectId: 'c-2',
    contractorId: 'c-2',
    organizationId: 'org-2',
    orgName: 'Beta LLC',
    orgLogo: null,
  },
];

describe('OrgPicker', () => {
  it('renders title, description, and signed-in email', () => {
    render(<OrgPicker orgs={orgs} email="user@example.com" onSelect={vi.fn()} />);
    expect(screen.getByText(/user@example.com/)).toBeInTheDocument();
  });

  it('renders one card per org with the org name', () => {
    render(<OrgPicker orgs={orgs} email="user@example.com" onSelect={vi.fn()} />);
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('Beta LLC')).toBeInTheDocument();
  });

  it('invokes onSelect with both ids when an org is clicked', async () => {
    const onSelect = vi.fn();
    const { user } = setup(<OrgPicker orgs={orgs} email="user@example.com" onSelect={onSelect} />);
    await user.click(screen.getByText('Acme Corp'));
    expect(onSelect).toHaveBeenCalledWith(orgs[0]);
  });

  it('disables non-selected cards while loading', async () => {
    const { user } = setup(
      <OrgPicker orgs={orgs} email="user@example.com" onSelect={vi.fn()} loading />,
    );
    await user.click(screen.getByText('Acme Corp'));
    // After selection the Beta card should become disabled because loading
    const betaBtn = screen.getByText('Beta LLC').closest('button');
    expect(betaBtn).toBeDisabled();
  });

  it('renders the orgs logo letter fallback when no logo URL is supplied', () => {
    render(<OrgPicker orgs={orgs} email="user@example.com" onSelect={vi.fn()} />);
    // First letter of each org name
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
  });
});
