/**
 * Tests target `DirectoryImportWizardView` with shaped props. Sibling
 * step components are stubbed so we focus on the dialog branch, step
 * indicator, and the empty/error/data states of step 1.
 */

import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TranslateFn } from '@/i18n/useTranslations';
import { render, screen } from '@/test/test-utils';
import type { DirectoryImportWizardViewProps } from '../directory-import-wizard';
import { DirectoryImportWizardView } from '../directory-import-wizard';
import type { WizardStep } from '../hooks/use-directory-import-wizard';

vi.mock('../../../billing/feature-gate-container', () => ({
  FeatureGateContainer: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('../directory-preview-table', () => ({
  DirectoryPreviewTable: () => <div data-testid="preview-table" />,
}));

vi.mock('../directory-summary-bar', () => ({
  DirectorySummaryBar: () => <div data-testid="summary-bar" />,
}));

vi.mock('../role-assignment-controls', () => ({
  RoleAssignmentControls: () => <div data-testid="role-controls" />,
}));

vi.mock('../group-role-mapping-step', () => ({
  GroupRoleMappingStep: () => <div data-testid="group-mapping" />,
}));

vi.mock('../import-confirm-step', () => ({
  ImportConfirmStep: () => <div data-testid="confirm-step" />,
}));

interface BuildOpts {
  open?: boolean;
  step?: 1 | 2 | 3;
  directoryLoading?: boolean;
  directoryError?: boolean;
  stats?: { total: number; alreadyImported: number; new: number } | null;
  selectedEmailsSize?: number;
  importPending?: boolean;
  handleOpenChange?: (open: boolean) => void;
  setStep?: Dispatch<SetStateAction<WizardStep>>;
}

function buildProps(overrides: BuildOpts = {}): DirectoryImportWizardViewProps {
  const {
    open = true,
    step = 1,
    directoryLoading = false,
    directoryError = false,
    stats = { total: 10, alreadyImported: 2, new: 8 },
    selectedEmailsSize = 0,
    importPending = false,
    handleOpenChange = vi.fn(),
    setStep = vi.fn(),
  } = overrides;

  const t = ((key: string): string => {
    const messages: Record<string, string> = {
      title: 'Import Google Workspace Users',
      step1Title: 'Preview directory',
      step2Title: 'Assign roles',
      step3Title: 'Review and import',
      nextRoles: 'Next: Roles',
      nextReview: 'Next: Review',
      back: 'Back',
      emptyNoUsers: 'No users found',
      emptyNoUsersBody:
        'The connected Google Workspace directory has no users, or the admin account lacks directory access.',
      emptyAllImported: 'All users imported',
      emptyAllImportedBody:
        'Every user in the Google Workspace directory is already a member of this organization.',
      fetchError:
        'Could not load the directory. Verify that the connected account has Admin SDK access and try again.',
    };
    return messages[key] ?? key;
  }) as TranslateFn;

  return {
    open,
    handleOpenChange,
    step,
    setStep,
    selectedEmails: new Set<string>(
      selectedEmailsSize > 0
        ? Array.from({ length: selectedEmailsSize }, (_, i) => `u${i}@x.com`)
        : [],
    ),
    setSelectedEmails: vi.fn(),
    defaultRole: 'readonly',
    setDefaultRole: vi.fn(),
    groupMappings: {},
    handleGroupMappingChange: vi.fn(),
    directoryQuery: {
      isLoading: directoryLoading,
      isError: directoryError,
      data: stats ? { users: [], stats } : undefined,
    } as never,
    directoryData: stats ? { users: [], stats } : undefined,
    users: [],
    stats,
    listGroupsMutation: { isPending: false } as never,
    handleGoToStep2: vi.fn(),
    groups: [],
    selectedUsers: [],
    roleBreakdown: [],
    importMutation: { isPending: importPending } as never,
    handleConfirmImport: vi.fn(),
    stepsConfig: [
      { step: 1 as const, label: 'Preview directory' },
      { step: 2 as const, label: 'Assign roles' },
      { step: 3 as const, label: 'Review and import' },
    ],
    t,
  } as unknown as DirectoryImportWizardViewProps;
}

describe('DirectoryImportWizardView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dialog title when open', () => {
    render(<DirectoryImportWizardView {...buildProps()} />);
    expect(screen.getByText('Import Google Workspace Users')).toBeInTheDocument();
  });

  it('does not render dialog content when closed', () => {
    render(<DirectoryImportWizardView {...buildProps({ open: false })} />);
    expect(screen.queryByText('Import Google Workspace Users')).not.toBeInTheDocument();
  });

  it('renders the three-step indicator labels', () => {
    render(<DirectoryImportWizardView {...buildProps()} />);
    expect(screen.getByText(/Preview directory/)).toBeInTheDocument();
    expect(screen.getByText(/Assign roles/)).toBeInTheDocument();
    expect(screen.getByText(/Review and import/)).toBeInTheDocument();
  });

  it('shows the directory fetch error when directoryQuery.isError is true', () => {
    render(<DirectoryImportWizardView {...buildProps({ directoryError: true })} />);
    expect(screen.getByText(/Could not load the directory/)).toBeInTheDocument();
  });

  it('shows the empty-no-users branch when stats.total is 0', () => {
    render(
      <DirectoryImportWizardView
        {...buildProps({ stats: { total: 0, alreadyImported: 0, new: 0 } })}
      />,
    );
    expect(screen.getByText('No users found')).toBeInTheDocument();
  });

  it('shows the all-imported branch when total > 0 but stats.new is 0', () => {
    render(
      <DirectoryImportWizardView
        {...buildProps({ stats: { total: 10, alreadyImported: 10, new: 0 } })}
      />,
    );
    expect(screen.getByText('All users imported')).toBeInTheDocument();
  });

  it('renders summary bar + preview table when stats.new > 0', () => {
    render(<DirectoryImportWizardView {...buildProps()} />);
    expect(screen.getByTestId('summary-bar')).toBeInTheDocument();
    expect(screen.getByTestId('preview-table')).toBeInTheDocument();
  });

  it('disables the Next: Roles button until at least one email is selected', () => {
    render(<DirectoryImportWizardView {...buildProps()} />);
    expect(screen.getByRole('button', { name: 'Next: Roles' })).toBeDisabled();
  });

  it('enables Next: Roles when at least one email is selected', () => {
    render(<DirectoryImportWizardView {...buildProps({ selectedEmailsSize: 2 })} />);
    expect(screen.getByRole('button', { name: 'Next: Roles' })).not.toBeDisabled();
  });

  it('renders the role-assignment + group-mapping steps when step is 2', () => {
    render(<DirectoryImportWizardView {...buildProps({ step: 2 })} />);
    expect(screen.getByTestId('role-controls')).toBeInTheDocument();
    expect(screen.getByTestId('group-mapping')).toBeInTheDocument();
  });

  it('renders the confirm step when step is 3', () => {
    render(<DirectoryImportWizardView {...buildProps({ step: 3 })} />);
    expect(screen.getByTestId('confirm-step')).toBeInTheDocument();
  });
});
