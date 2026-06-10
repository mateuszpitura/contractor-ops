/**
 * Container/component split. The editor is mounted inside a Dialog
 * portal. We mock the user-picker container (tRPC-backed) and build a
 * real `useForm` instance so Controller-bound selects are wired.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../reminder-rule-user-picker', () => ({
  ReminderRuleUserPicker: () => null,
}));

import { useForm } from 'react-hook-form';
import { render, screen } from '@/test/test-utils';
import { ReminderRuleEditorView } from '../reminder-rule-editor';

const tStub = ((key: string) => key) as never;

interface HarnessProps {
  open?: boolean;
  isEditMode?: boolean;
  isPending?: boolean;
  showOffset?: boolean;
  isSlackConnected?: boolean;
  watchedRecipientMode?: string;
  triggerType?: string;
}

function Harness({
  open = true,
  isEditMode = false,
  isPending = false,
  showOffset = false,
  isSlackConnected = false,
  watchedRecipientMode = 'ENTITY_OWNER',
  triggerType = '',
}: HarnessProps) {
  const form = useForm<{
    name: string;
    triggerType: string;
    offsetDays: number | undefined;
    entityType: string;
    channel: string;
    recipientMode: string;
    configUserId: string | undefined;
    configRole: string | undefined;
    active: boolean;
  }>({
    defaultValues: {
      name: '',
      triggerType,
      offsetDays: undefined,
      entityType: 'CONTRACT',
      channel: 'IN_APP',
      recipientMode: watchedRecipientMode,
      configUserId: undefined,
      configRole: undefined,
      active: true,
    },
  });

  return (
    <ReminderRuleEditorView
      open={open}
      onOpenChange={vi.fn()}
      rule={undefined}
      t={tStub}
      form={form as never}
      triggerItems={[{ value: 'BEFORE_CONTRACT_END', label: 'Before contract end' }]}
      entityItems={[{ value: 'CONTRACT', label: 'Contract' }]}
      channelItems={[
        { value: 'IN_APP', label: 'In-app' },
        { value: 'EMAIL', label: 'Email' },
        { value: 'SLACK', label: 'Slack' },
      ]}
      recipientItems={[
        { value: 'ENTITY_OWNER', label: 'Owner' },
        { value: 'SPECIFIC_USER', label: 'Specific user' },
        { value: 'ROLE', label: 'Role' },
      ]}
      isEditMode={isEditMode}
      isPending={isPending}
      isSlackConnected={isSlackConnected}
      showOffset={showOffset}
      watchedRecipientMode={watchedRecipientMode}
      onSubmit={vi.fn()}
    />
  );
}

describe('ReminderRuleEditor', () => {
  it('renders the create-mode title', () => {
    render(<Harness />);
    // Title appears in DialogTitle (h2) AND sr-only DialogDescription — both
    // are intentional. Either presence means the create branch rendered.
    expect(screen.getAllByText('reminderRules.editor.createTitle').length).toBeGreaterThan(0);
  });

  it('renders the edit-mode title when isEditMode', () => {
    render(<Harness isEditMode />);
    expect(screen.getAllByText('reminderRules.editor.editTitle').length).toBeGreaterThan(0);
  });

  it('does not render dialog body when closed', () => {
    render(<Harness open={false} />);
    expect(screen.queryByText('reminderRules.editor.createTitle')).not.toBeInTheDocument();
  });

  it('renders the offset input when showOffset is true', () => {
    render(<Harness showOffset triggerType="BEFORE_CONTRACT_END" />);
    expect(screen.getByLabelText('reminderRules.editor.offset')).toBeInTheDocument();
  });

  it('hides the offset input when showOffset is false', () => {
    render(<Harness showOffset={false} />);
    expect(screen.queryByLabelText('reminderRules.editor.offset')).not.toBeInTheDocument();
  });

  it('disables save + discard while isPending', () => {
    render(<Harness isPending />);
    expect(screen.getByRole('button', { name: 'reminderRules.editor.save' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'reminderRules.editor.discard' })).toBeDisabled();
  });
});
