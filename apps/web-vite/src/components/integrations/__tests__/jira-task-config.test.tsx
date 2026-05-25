/**
 * Tests target `JiraTaskConfigView` with shaped props. Sibling dialog
 * container is stubbed so we focus on the toggle + summary branch logic.
 */

import type { Dispatch, SetStateAction } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TranslateFn } from '@/i18n/useTranslations';
import { render, screen, setup } from '@/test/test-utils';
import type { JiraTaskConfigViewProps } from '../jira-task-config';
import { JiraTaskConfigView } from '../jira-task-config';

vi.mock('../jira-project-mapping-dialog-container', () => ({
  JiraProjectMappingDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="project-mapping-dialog" /> : null,
}));

interface BuildOpts {
  connection?: { id: string; status: string };
  jiraEnabled?: boolean;
  hasMappingConfigured?: boolean;
  mappingSummary?: string;
  isSavePending?: boolean;
  dialogOpen?: boolean;
  handleToggle?: (checked: boolean) => void;
  openConfigureDialog?: () => void;
  setDialogOpen?: Dispatch<SetStateAction<boolean>>;
}

function buildProps(overrides: BuildOpts = {}): JiraTaskConfigViewProps {
  const {
    connection = { id: 'c-1', status: 'CONNECTED' },
    jiraEnabled = false,
    hasMappingConfigured = false,
    mappingSummary = 'Not configured',
    isSavePending = false,
    dialogOpen = false,
    handleToggle = vi.fn(),
    openConfigureDialog = vi.fn(),
    setDialogOpen = vi.fn(),
  } = overrides;

  const t = ((key: string): string => {
    const messages: Record<string, string> = {
      enableToggle: 'Create Jira issue when task activates',
      notConfigured: 'Not configured',
      configure: 'Configure Jira',
    };
    return messages[key] ?? key;
  }) as TranslateFn;

  return {
    taskTemplateId: 'tpl-1',
    connection: connection as JiraTaskConfigViewProps['connection'],
    config: undefined,
    jiraEnabled,
    hasMappingConfigured,
    mappingSummary,
    handleToggle,
    saveMutation: { isPending: isSavePending } as never,
    dialogOpen,
    setDialogOpen,
    openConfigureDialog,
    t,
  };
}

describe('JiraTaskConfigView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the enable toggle label', () => {
    render(<JiraTaskConfigView {...buildProps()} />);
    expect(
      screen.getByRole('switch', { name: 'Create Jira issue when task activates' }),
    ).toBeInTheDocument();
  });

  it('toggle is disabled until a mapping is configured', () => {
    render(<JiraTaskConfigView {...buildProps({ hasMappingConfigured: false })} />);
    // Base-ui Switch renders as `<span role="switch">` with `data-disabled=""`.
    const sw = screen.getByRole('switch', { name: 'Create Jira issue when task activates' });
    expect(sw).toHaveAttribute('data-disabled', '');
  });

  it('toggle is enabled once a mapping is configured', () => {
    render(<JiraTaskConfigView {...buildProps({ hasMappingConfigured: true })} />);
    const sw = screen.getByRole('switch', { name: 'Create Jira issue when task activates' });
    expect(sw).not.toHaveAttribute('data-disabled');
  });

  it('renders the mapping summary text', () => {
    render(<JiraTaskConfigView {...buildProps({ mappingSummary: 'WEB / Bug' })} />);
    expect(screen.getByText('WEB / Bug')).toBeInTheDocument();
  });

  it('calls handleToggle when the switch is clicked', async () => {
    const handleToggle = vi.fn();
    const { user } = setup(
      <JiraTaskConfigView {...buildProps({ hasMappingConfigured: true, handleToggle })} />,
    );
    await user.click(screen.getByRole('switch', { name: 'Create Jira issue when task activates' }));
    expect(handleToggle).toHaveBeenCalled();
  });

  it('calls openConfigureDialog when the configure button is clicked', async () => {
    const openConfigureDialog = vi.fn();
    const { user } = setup(<JiraTaskConfigView {...buildProps({ openConfigureDialog })} />);
    await user.click(screen.getByRole('button', { name: 'Configure Jira' }));
    expect(openConfigureDialog).toHaveBeenCalledTimes(1);
  });
});
