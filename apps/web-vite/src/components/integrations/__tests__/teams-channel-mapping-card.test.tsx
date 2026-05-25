/**
 * Tests target `TeamsChannelMappingCardView` with shaped props. Verifies the
 * card heading, the team picker (visible when >1 team), per-category channel
 * selects, save handler, and refresh/error states.
 */

import type * as React from 'react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TranslateFn } from '@/i18n/useTranslations';
import { render, screen, setup } from '@/test/test-utils';
import type { TeamsChannelMappingCardViewProps } from '../teams-channel-mapping-card';
import { TeamsChannelMappingCardView } from '../teams-channel-mapping-card';

vi.mock('../../billing/feature-gate-container', () => ({
  FeatureGateContainer: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@contractor-ops/ui/components/shadcn/select', () => ({
  Select: ({
    children,
    onValueChange,
    value,
  }: {
    children: React.ReactNode;
    value?: string;
    onValueChange?: (v: string) => void;
  }) => (
    <select
      aria-label="select"
      value={value ?? ''}
      // biome-ignore lint/nursery/noJsxPropsBind: test stub
      onChange={e => onValueChange?.(e.target.value)}>
      {children}
    </select>
  ),
  SelectTrigger: ({
    children,
    'aria-label': ariaLabel,
  }: {
    children: React.ReactNode;
    'aria-label'?: string;
  }) => <div aria-label={ariaLabel}>{children}</div>,
  SelectValue: ({
    children,
    placeholder,
  }: {
    children?: React.ReactNode;
    placeholder?: string;
  }) => <>{children ?? placeholder}</>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}));

const mockTeams = [
  { id: 't-1', displayName: 'Engineering' },
  { id: 't-2', displayName: 'Design' },
];

const mockChannels = [
  { id: 'c-1', displayName: 'General' },
  { id: 'c-2', displayName: 'Approvals' },
];

interface BuildOpts {
  teams?: typeof mockTeams;
  channels?: typeof mockChannels;
  selectedTeamId?: string | null;
  localMapping?: Record<string, string>;
  isLoadingChannels?: boolean;
  isChannelError?: boolean;
  isSavePending?: boolean;
  setSelectedTeamId?: Dispatch<SetStateAction<string | null>>;
  handleChannelSelect?: (category: string, channelId: string) => void;
  handleSave?: () => void;
  handleRefresh?: () => void;
}

function buildProps(overrides: BuildOpts = {}): TeamsChannelMappingCardViewProps {
  const {
    teams = mockTeams,
    channels = mockChannels,
    selectedTeamId = 't-1',
    localMapping = {},
    isLoadingChannels = false,
    isChannelError = false,
    isSavePending = false,
    setSelectedTeamId = vi.fn(),
    handleChannelSelect = vi.fn(),
    handleSave = vi.fn(),
    handleRefresh = vi.fn(),
  } = overrides;

  const t = ((key: string): string => {
    const messages: Record<string, string> = {
      channelMappingHeading: 'Channel mapping',
      channelMappingDescription:
        'Pick a Teams channel for each notification category. Approval requests, task reminders, and contract alerts are delivered there.',
      noChannels: 'No channels visible in this team — check installation scope.',
      channelFetchError: 'Could not load Teams channels. Refresh to retry.',
      selectChannel: 'Select a channel',
      saveMapping: 'Save channel mapping',
      refreshChannels: 'Refresh channels',
      'channels.approvals': 'Approvals',
      'channels.tasks': 'Tasks',
      'channels.contracts': 'Contracts',
      'channels.timesheets': 'Timesheets',
      'channels.invoices': 'Invoices',
    };
    return messages[key] ?? key;
  }) as TranslateFn;

  return {
    selectedTeamId,
    setSelectedTeamId,
    teams,
    channels,
    localMapping,
    handleChannelSelect,
    handleSave,
    handleRefresh,
    isLoadingChannels,
    isChannelError,
    saveMutation: { isPending: isSavePending } as never,
    t,
  };
}

describe('TeamsChannelMappingCardView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the heading and description', () => {
    render(<TeamsChannelMappingCardView {...buildProps()} />);
    expect(screen.getByText('Channel mapping')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Pick a Teams channel for each notification category. Approval requests, task reminders, and contract alerts are delivered there.',
      ),
    ).toBeInTheDocument();
  });

  it('renders the team picker only when multiple teams exist', () => {
    const { rerender } = render(
      <TeamsChannelMappingCardView {...buildProps({ teams: [mockTeams[0]] })} />,
    );
    // With one team there's still the per-category selects, but no top-level team picker.
    // We assert by counting the team option text: with one team it should appear only as
    // the selected value, not as a picker option.
    expect(screen.queryByRole('option', { name: 'Design' })).not.toBeInTheDocument();

    rerender(<TeamsChannelMappingCardView {...buildProps()} />);
    expect(screen.getByRole('option', { name: 'Design' })).toBeInTheDocument();
  });

  it('renders the channel error message when isChannelError is true', () => {
    render(<TeamsChannelMappingCardView {...buildProps({ isChannelError: true })} />);
    expect(
      screen.getByText('Could not load Teams channels. Refresh to retry.'),
    ).toBeInTheDocument();
  });

  it('shows the "no channels" hint when team selected but channels list is empty', () => {
    render(<TeamsChannelMappingCardView {...buildProps({ channels: [] })} />);
    expect(
      screen.getByText('No channels visible in this team — check installation scope.'),
    ).toBeInTheDocument();
  });

  it('renders a save button when channels are present', () => {
    render(<TeamsChannelMappingCardView {...buildProps()} />);
    expect(screen.getByRole('button', { name: 'Save channel mapping' })).toBeInTheDocument();
  });

  it('calls handleSave when the save button is clicked', async () => {
    const handleSave = vi.fn();
    const { user } = setup(<TeamsChannelMappingCardView {...buildProps({ handleSave })} />);
    await user.click(screen.getByRole('button', { name: 'Save channel mapping' }));
    expect(handleSave).toHaveBeenCalledTimes(1);
  });

  it('calls handleRefresh when the refresh button is clicked', async () => {
    const handleRefresh = vi.fn();
    const { user } = setup(<TeamsChannelMappingCardView {...buildProps({ handleRefresh })} />);
    await user.click(screen.getByRole('button', { name: 'Refresh channels' }));
    expect(handleRefresh).toHaveBeenCalledTimes(1);
  });
});
