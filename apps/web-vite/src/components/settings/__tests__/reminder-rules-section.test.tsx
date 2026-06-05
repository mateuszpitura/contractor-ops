/**
 * Container/component split. The section receives rule data + handlers
 * from `useReminderRulesSection`. The editor container is mocked since
 * it pulls in tRPC at module-eval.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../reminder-rule-editor-container', () => ({
  ReminderRuleEditorContainer: () => null,
}));

import { render, screen, setup } from '@/test/test-utils';
import type { ReminderRule, useReminderRulesSection } from '../hooks/use-reminder-rules-section';
import { ReminderRulesSection } from '../reminder-rules-section';

type HookReturn = ReturnType<typeof useReminderRulesSection>;

const tStub = ((key: string) => key) as unknown as HookReturn['t'];

function buildHook(overrides: Partial<HookReturn> = {}): HookReturn {
  return {
    t: tStub,
    tAria: tStub,
    rulesQuery: { isLoading: false } as HookReturn['rulesQuery'],
    rules: [] as ReminderRule[],
    editorOpen: false,
    setEditorOpen: vi.fn(),
    editingRule: null,
    deletingRuleId: null,
    setDeletingRuleId: vi.fn(),
    toggleActiveMutation: { isPending: false } as HookReturn['toggleActiveMutation'],
    deleteMutation: { isPending: false } as HookReturn['deleteMutation'],
    handleToggleActive: vi.fn(),
    handleEdit: vi.fn(),
    handleCreate: vi.fn(),
    handleDelete: vi.fn(),
    getRuleDescription: (rule: ReminderRule) => `desc-${rule.id}`,
    CHANNEL_LABEL_KEYS: {
      IN_APP: 'channelInApp',
      EMAIL: 'channelEmail',
      SLACK: 'channelSlack',
    } as Record<string, string>,
    RECIPIENT_LABEL_KEYS: {
      ENTITY_OWNER: 'recipientEntityOwner',
      ASSIGNEE: 'recipientAssignee',
    } as Record<string, string>,
    ...overrides,
  } as HookReturn;
}

const sampleRule: ReminderRule = {
  id: 'rule-1',
  name: 'Contract expiry reminder',
  entityType: 'CONTRACT',
  triggerType: 'BEFORE_CONTRACT_END',
  offsetDays: 30,
  offsetHours: null,
  channel: 'EMAIL',
  recipientMode: 'ENTITY_OWNER',
  configJson: null,
  active: true,
};

describe('ReminderRulesSection', () => {
  it('renders skeletons while loading', () => {
    const { container } = render(
      <ReminderRulesSection
        {...buildHook({ rulesQuery: { isLoading: true } as HookReturn['rulesQuery'] })}
      />,
    );

    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
    expect(screen.queryByText('reminderRules.heading')).not.toBeInTheDocument();
  });

  it('renders the empty state when there are no rules', async () => {
    const handleCreate = vi.fn();
    const { user } = setup(<ReminderRulesSection {...buildHook({ rules: [], handleCreate })} />);

    expect(screen.getByText('reminderRules.emptyHeading')).toBeInTheDocument();
    expect(screen.getByText('reminderRules.emptyBody')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'reminderRules.emptyCta' }));
    expect(handleCreate).toHaveBeenCalledTimes(1);
  });

  it('renders the heading and rule card when rules exist', () => {
    render(<ReminderRulesSection {...buildHook({ rules: [sampleRule] })} />);

    expect(screen.getByText('reminderRules.heading')).toBeInTheDocument();
    expect(screen.getByText('Contract expiry reminder')).toBeInTheDocument();
    expect(screen.getByText('desc-rule-1')).toBeInTheDocument();
    expect(screen.getByText('reminderRules.editor.channelEmail')).toBeInTheDocument();
    expect(screen.getByText('reminderRules.editor.recipientEntityOwner')).toBeInTheDocument();
  });

  it('fires handleToggleActive when the active switch is flipped', async () => {
    const handleToggleActive = vi.fn();
    const { user } = setup(
      <ReminderRulesSection {...buildHook({ rules: [sampleRule], handleToggleActive })} />,
    );

    await user.click(screen.getByRole('switch'));
    expect(handleToggleActive).toHaveBeenCalledWith(sampleRule);
  });

  it('opens the delete confirm dialog with rule body when deletingRuleId is set', () => {
    render(
      <ReminderRulesSection {...buildHook({ rules: [sampleRule], deletingRuleId: 'rule-1' })} />,
    );

    expect(screen.getByText('reminderRules.deleteConfirm.title')).toBeInTheDocument();
    expect(screen.getByText('reminderRules.deleteConfirm.body')).toBeInTheDocument();
  });
});
