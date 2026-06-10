/**
 * Container/component split. The table receives mappings + stats +
 * handlers from `useSlackUserMapping`. We mock the link-user popover
 * container (tRPC-bound) so the test stays scoped to the table surface.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../link-user-popover.js', () => ({
  LinkUserPopover: () => <button type="button">LINK_PLACEHOLDER</button>,
}));

import { render, screen, setup } from '@/test/test-utils';
import type { UserMapping, useSlackUserMapping } from '../hooks/use-slack-user-mapping';
import { SlackUserMappingView, SlackUserMappingSkeleton } from '../slack-user-mapping';

type HookReturn = ReturnType<typeof useSlackUserMapping>;

const tStub = ((key: string) => key) as unknown as HookReturn['t'];

function buildHook(overrides: Partial<HookReturn> = {}): HookReturn {
  return {
    t: tStub,
    isLoading: false,
    mappings: [] as UserMapping[],
    totalUsers: 0,
    matchedUsers: 0,
    handleUnlink: vi.fn(),
    isUnlinkPending: false,
    ...overrides,
  } as HookReturn;
}

const linkedMapping: UserMapping = {
  userId: 'u1',
  user: { id: 'u1', name: 'Alice', email: 'alice@acme.test', image: null },
  role: 'admin',
  slackLink: {
    externalLinkId: 'link-1',
    externalId: 'U001',
    externalUrl: null,
    metadata: { displayName: 'alice.slack', autoMatched: true },
  },
  status: 'linked',
};

const unlinkedMapping: UserMapping = {
  userId: 'u2',
  user: { id: 'u2', name: 'Bob', email: 'bob@acme.test', image: null },
  role: 'manager',
  slackLink: null,
  status: 'unlinked',
};

describe('SlackUserMapping', () => {
  it('renders skeletons via the Skeleton sibling export', () => {
    const { container } = render(<SlackUserMappingSkeleton />);
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
    expect(screen.queryByText('integrations.userMapping.heading')).not.toBeInTheDocument();
  });

  it('renders heading, columns and one row per mapping', () => {
    render(
      <SlackUserMappingView
        {...buildHook({
          mappings: [linkedMapping, unlinkedMapping],
          totalUsers: 2,
          matchedUsers: 1,
        })}
      />,
    );

    expect(screen.getByText('integrations.userMapping.heading')).toBeInTheDocument();
    expect(screen.getByText('integrations.userMapping.columnUser')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('renders the auto-matched status badge for an auto-linked row', () => {
    render(
      <SlackUserMappingView
        {...buildHook({
          mappings: [linkedMapping],
          totalUsers: 1,
          matchedUsers: 1,
        })}
      />,
    );

    expect(screen.getByText('integrations.userMapping.statusAutoMatched')).toBeInTheDocument();
  });

  it('renders the link popover placeholder for unlinked rows', () => {
    render(
      <SlackUserMappingView
        {...buildHook({
          mappings: [unlinkedMapping],
          totalUsers: 1,
          matchedUsers: 0,
        })}
      />,
    );

    expect(screen.getByText('LINK_PLACEHOLDER')).toBeInTheDocument();
    expect(screen.queryByText('integrations.userMapping.unlinkUser')).not.toBeInTheDocument();
  });

  it('fires handleUnlink (after confirm) when the unlink button is clicked', async () => {
    const handleUnlink = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { user } = setup(
      <SlackUserMappingView
        {...buildHook({
          mappings: [linkedMapping],
          totalUsers: 1,
          matchedUsers: 1,
          handleUnlink,
        })}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'integrations.userMapping.unlinkUser' }));
    expect(handleUnlink).toHaveBeenCalledWith('link-1');
    confirmSpy.mockRestore();
  });

  it('skips handleUnlink when the user cancels the confirm dialog', async () => {
    const handleUnlink = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { user } = setup(
      <SlackUserMappingView
        {...buildHook({
          mappings: [linkedMapping],
          totalUsers: 1,
          matchedUsers: 1,
          handleUnlink,
        })}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'integrations.userMapping.unlinkUser' }));
    expect(handleUnlink).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});
