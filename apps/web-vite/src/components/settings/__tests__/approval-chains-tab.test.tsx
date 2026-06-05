/**
 * The presentational tab receives chain data + handlers from
 * `useApprovalChainsTab`. It also mounts `ChainEditorDialogContainer`,
 * which pulls in tRPC — mock that container to keep the test scoped to
 * loading / empty / list / delete-confirm branches.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../chain-editor-dialog-container', () => ({
  ChainEditorDialogContainer: () => null,
}));

import { render, screen, setup } from '@/test/test-utils';
import { ApprovalChainsTab } from '../approval-chains-tab';
import type { useApprovalChainsTab } from '../hooks/use-approval-chains-tab';

type HookReturn = ReturnType<typeof useApprovalChainsTab>;
type Chain = HookReturn['chains'][number];

const tStub = ((key: string) => key) as unknown as HookReturn['t'];

function buildHook(overrides: Partial<HookReturn> = {}): HookReturn {
  const base = {
    t: tStub,
    tAria: tStub,
    chainsQuery: { isLoading: false } as HookReturn['chainsQuery'],
    chains: [] as Chain[],
    editorOpen: false,
    setEditorOpen: vi.fn(),
    editingChain: null,
    deletingChainId: null,
    setDeletingChainId: vi.fn(),
    toggleActiveMutation: { isPending: false } as HookReturn['toggleActiveMutation'],
    deleteMutation: { isPending: false } as HookReturn['deleteMutation'],
    handleToggleActive: vi.fn(),
    handleEdit: vi.fn(),
    handleCreate: vi.fn(),
    handleDelete: vi.fn(),
    ...overrides,
  };
  return base as unknown as HookReturn;
}

const sampleChain: Chain = {
  id: 'chain-1',
  name: 'High-value approvals',
  isDefault: true,
  isActive: true,
  conditionsJson: [{ field: 'amount', operator: 'gt', value: 1000 }],
  stepsJson: [{}, {}],
} as unknown as Chain;

describe('ApprovalChainsTab', () => {
  it('renders skeleton placeholders while loading', () => {
    const { container } = render(
      <ApprovalChainsTab
        {...buildHook({
          chainsQuery: { isLoading: true } as HookReturn['chainsQuery'],
        })}
      />,
    );

    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
    expect(screen.queryByText('approvals.heading')).not.toBeInTheDocument();
  });

  it('renders the empty state with a create CTA when no chains exist', async () => {
    const handleCreate = vi.fn();
    const { user } = setup(<ApprovalChainsTab {...buildHook({ chains: [], handleCreate })} />);

    expect(screen.getByText('approvals.empty.heading')).toBeInTheDocument();
    expect(screen.getByText('approvals.empty.body')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'approvals.empty.cta' }));
    expect(handleCreate).toHaveBeenCalledTimes(1);
  });

  it('renders the heading, create CTA and chain cards when chains exist', () => {
    render(<ApprovalChainsTab {...buildHook({ chains: [sampleChain] })} />);

    expect(screen.getByText('approvals.heading')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /approvals\.createChain/i })).toBeInTheDocument();
    expect(screen.getByText('High-value approvals')).toBeInTheDocument();
    expect(screen.getByText('approvals.defaultBadge')).toBeInTheDocument();
  });

  it('fires handleToggleActive when the active switch is flipped', async () => {
    const handleToggleActive = vi.fn();
    const { user } = setup(
      <ApprovalChainsTab {...buildHook({ chains: [sampleChain], handleToggleActive })} />,
    );

    await user.click(screen.getByRole('switch'));
    expect(handleToggleActive).toHaveBeenCalledTimes(1);
    expect(handleToggleActive).toHaveBeenCalledWith(sampleChain);
  });

  it('opens the delete confirm dialog when the trash icon is clicked', async () => {
    const setDeletingChainId = vi.fn();
    const { user } = setup(
      <ApprovalChainsTab {...buildHook({ chains: [sampleChain], setDeletingChainId })} />,
    );

    await user.click(screen.getByRole('button', { name: /approvals\.delete$/i }));
    expect(setDeletingChainId).toHaveBeenCalledWith('chain-1');
  });

  it('renders the delete confirm body when deletingChainId is set', () => {
    render(
      <ApprovalChainsTab {...buildHook({ chains: [sampleChain], deletingChainId: 'chain-1' })} />,
    );

    expect(screen.getByText('approvals.deleteConfirm.title')).toBeInTheDocument();
    expect(screen.getByText('approvals.deleteConfirm.body')).toBeInTheDocument();
  });
});
