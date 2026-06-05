/**
 * TemplateForm takes the full `useTemplateFormSection` bag
 * as props. We mock SortableTaskList so the test focuses on the chrome
 * (name field, type select, save button) without dragging dnd-kit context.
 */

import { useForm } from 'react-hook-form';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../sortable-task-list.js', () => {
  const React = require('react');
  return {
    SortableTaskList: () => React.createElement('div', { 'data-testid': 'task-list' }),
  };
});

import { click, findButton, findByText, mount, type } from '../../__tests__/_render.js';
import { TemplateForm } from '../template-form.js';
import type { TemplateFormValues } from '../use-template-form.js';

afterEach(() => {
  document.body.innerHTML = '';
});

type Props = Parameters<typeof TemplateForm>[0];

function StubForm({
  templateStatus = 'DRAFT',
  isEditing = false,
  isSaving = false,
  isUpdatePending = false,
  isDuplicatePending = false,
  isDeletePending = false,
  isDirty = false,
  name = 'My template',
  handleSave = vi.fn(),
  handleActivate = vi.fn(),
  handleArchive = vi.fn(),
  handleDuplicate = vi.fn(),
  handleDelete = vi.fn(),
}: Partial<Props> & { name?: string } = {}) {
  const form = useForm<TemplateFormValues>({
    defaultValues: {
      name,
      type: 'ONBOARDING' as TemplateFormValues['type'],
      description: '',
      tasks: [],
    } as TemplateFormValues,
  });

  const props: Props = {
    form,
    fields: [],
    tasks: [],
    isDirty,
    addTask: vi.fn(),
    removeTask: vi.fn(),
    reorderTasks: vi.fn(),
    templateStatus,
    isEditing,
    isSaving,
    isUpdatePending,
    isDuplicatePending,
    isDeletePending,
    handleSave,
    handleActivate,
    handleArchive,
    handleDuplicate,
    handleDelete,
    showActivateCta: isEditing && templateStatus === 'DRAFT',
    showArchiveCta: isEditing && templateStatus === 'ACTIVE',
    showDuplicateCta: isEditing,
    showDeleteCta: isEditing && templateStatus === 'DRAFT',
    showStatusBadge: isEditing,
  } as Props;

  return <TemplateForm {...props} />;
}

describe('TemplateForm (web-vite)', () => {
  it('renders the template name input pre-filled', async () => {
    await mount(<StubForm name="Onboarding flow" />);
    const input = document.body.querySelector('input[id*="template-name"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.value).toBe('Onboarding flow');
  });

  it('renders the type field label', async () => {
    await mount(<StubForm />);
    // Workflows.columns.templateType → "Type"
    expect(findByText(document.body, /^type$/i)).not.toBeNull();
  });

  it('renders the description textarea', async () => {
    await mount(<StubForm />);
    expect(document.body.querySelector('textarea')).not.toBeNull();
  });

  it('renders the save button', async () => {
    await mount(<StubForm />);
    expect(findButton(document.body, /save template/i)).not.toBeNull();
  });

  it('disables the save button when the name is empty', async () => {
    await mount(<StubForm name="" />);
    const saveBtn = findButton(document.body, /save template/i);
    expect(saveBtn?.disabled).toBe(true);
  });

  it('renders the Activate CTA when isEditing && status === DRAFT', async () => {
    await mount(<StubForm isEditing={true} templateStatus="DRAFT" />);
    expect(findButton(document.body, /^activate$/i)).not.toBeNull();
  });

  it('renders the Archive CTA when isEditing && status === ACTIVE', async () => {
    await mount(<StubForm isEditing={true} templateStatus="ACTIVE" />);
    expect(findButton(document.body, /^archive$/i)).not.toBeNull();
  });

  it('renders the Duplicate CTA when isEditing', async () => {
    await mount(<StubForm isEditing={true} templateStatus="DRAFT" />);
    expect(findButton(document.body, /duplicate/i)).not.toBeNull();
  });

  it('renders the Delete CTA when isEditing && status === DRAFT', async () => {
    await mount(<StubForm isEditing={true} templateStatus="DRAFT" />);
    // i18n key Workflows.deleteTemplate → "Delete"
    expect(findButton(document.body, /^delete$/i)).not.toBeNull();
  });

  it('renders the embedded task list section', async () => {
    await mount(<StubForm />);
    expect(document.body.querySelector("[data-testid='task-list']")).not.toBeNull();
  });

  it('invokes handleActivate when the Activate button is clicked', async () => {
    const handleActivate = vi.fn();
    await mount(
      <StubForm isEditing={true} templateStatus="DRAFT" handleActivate={handleActivate} />,
    );
    const btn = findButton(document.body, /^activate$/i);
    await click(btn as HTMLButtonElement);
    expect(handleActivate).toHaveBeenCalled();
  });

  it('allows typing into the description textarea', async () => {
    await mount(<StubForm />);
    const textarea = document.body.querySelector('textarea') as HTMLTextAreaElement;
    await type(textarea, 'new description');
    expect(textarea.value).toBe('new description');
  });
});
