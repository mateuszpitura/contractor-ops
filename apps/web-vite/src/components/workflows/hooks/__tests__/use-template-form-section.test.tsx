/**
 * `useTemplateFormSection` — drives the template-builder form container.
 * Covers: create mode (no templateId), edit mode (loads + resets),
 * save dispatches create/update mutations, status-change actions
 * (activate, archive, duplicate, delete) call the right mutation,
 * toast-on-error path.
 */

import { describe, expect, it, vi } from 'vitest';

import {
  act,
  clearTRPCMock,
  createTRPCProxy,
  renderHookWithProviders,
  setTRPCMock,
  waitFor,
} from '../../../../test-utils/render-hook.js';

const toastSuccess = vi.fn();
const toastError = vi.fn();
const routerPush = vi.fn();

vi.mock('sonner', () => ({
  toast: { success: toastSuccess, error: toastError },
}));

vi.mock('../../../../i18n/navigation.js', () => ({
  useRouter: () => ({ push: routerPush }),
}));

vi.mock('../../../../providers/trpc-provider.js', () => {
  const trpc = createTRPCProxy();
  return { useTRPC: () => trpc, usePortalTRPC: () => trpc };
});

const { useTemplateFormSection } = await import('../use-template-form-section.js');

const sampleTemplate = {
  id: 'tmpl-1',
  name: 'Onboarding',
  type: 'ONBOARDING',
  status: 'DRAFT',
  description: 'desc',
  tasks: [
    {
      id: 'task-1',
      title: 'Collect NDA',
      taskType: 'DOCUMENT_COLLECTION',
      description: '',
      sortOrder: 0,
      required: true,
      assigneeMode: 'ROLE_BASED',
      assigneeRole: 'OPS',
      assigneeUserId: null,
      dueOffsetDays: 1,
      dueOffsetHours: 0,
      dependsOnTaskTemplateId: null,
      externalUrl: '',
      configJson: null,
    },
  ],
};

describe('useTemplateFormSection', () => {
  it('initializes in create mode when no templateId is provided', () => {
    setTRPCMock({});
    const { result } = renderHookWithProviders(() => useTemplateFormSection());
    expect(result.current.isEditing).toBe(false);
    expect(result.current.templateStatus).toBe('DRAFT');
    expect(result.current.tasks).toEqual([]);
    clearTRPCMock();
  });

  it('loads the template in edit mode and exposes its status', async () => {
    setTRPCMock({
      'workflow.getTemplate': () => sampleTemplate,
    });
    const { result } = renderHookWithProviders(() => useTemplateFormSection('tmpl-1'));
    await waitFor(() => expect(result.current.templateStatus).toBe('DRAFT'));
    expect(result.current.isEditing).toBe(true);
    clearTRPCMock();
  });

  it('handleSave dispatches createTemplate in create mode', async () => {
    toastSuccess.mockClear();
    let createCalls = 0;
    setTRPCMock({
      'workflow.createTemplate': () => {
        createCalls += 1;
        return { id: 'new-1' };
      },
    });
    const { result } = renderHookWithProviders(() => useTemplateFormSection());
    await act(async () => {
      result.current.handleSave({
        name: 'New',
        type: 'CUSTOM',
        description: '',
        tasks: [],
      });
    });
    await waitFor(() => expect(createCalls).toBe(1));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    clearTRPCMock();
  });

  it('handleSave dispatches updateTemplate in edit mode', async () => {
    let updateCalls = 0;
    setTRPCMock({
      'workflow.getTemplate': () => sampleTemplate,
      'workflow.updateTemplate': () => {
        updateCalls += 1;
        return { id: 'tmpl-1' };
      },
    });
    const { result } = renderHookWithProviders(() => useTemplateFormSection('tmpl-1'));
    await waitFor(() => expect(result.current.isEditing).toBe(true));
    await act(async () => {
      result.current.handleSave({
        name: 'Updated',
        type: 'ONBOARDING',
        description: '',
        tasks: [],
      });
    });
    await waitFor(() => expect(updateCalls).toBe(1));
    clearTRPCMock();
  });

  it('handleActivate / handleArchive call updateTemplate with the right status', async () => {
    const updateCalls: unknown[] = [];
    setTRPCMock({
      'workflow.getTemplate': () => sampleTemplate,
      'workflow.updateTemplate': (input?: unknown) => {
        updateCalls.push(input);
        return { id: 'tmpl-1' };
      },
    });
    const { result } = renderHookWithProviders(() => useTemplateFormSection('tmpl-1'));
    await waitFor(() => expect(result.current.isEditing).toBe(true));
    await act(async () => {
      result.current.handleActivate();
    });
    await waitFor(() => expect(updateCalls.length).toBe(1));
    expect(updateCalls[0]).toEqual({ id: 'tmpl-1', status: 'ACTIVE' });

    await act(async () => {
      result.current.handleArchive();
    });
    await waitFor(() => expect(updateCalls.length).toBe(2));
    expect(updateCalls[1]).toEqual({ id: 'tmpl-1', status: 'ARCHIVED' });
    clearTRPCMock();
  });

  it('handleDuplicate calls duplicateTemplate', async () => {
    let duplicateCalls = 0;
    setTRPCMock({
      'workflow.getTemplate': () => sampleTemplate,
      'workflow.duplicateTemplate': () => {
        duplicateCalls += 1;
        return { id: 'tmpl-2' };
      },
    });
    const { result } = renderHookWithProviders(() => useTemplateFormSection('tmpl-1'));
    await waitFor(() => expect(result.current.isEditing).toBe(true));
    await act(async () => {
      result.current.handleDuplicate();
    });
    await waitFor(() => expect(duplicateCalls).toBe(1));
    clearTRPCMock();
  });

  it('handleDelete calls deleteTemplate', async () => {
    let deleteCalls = 0;
    setTRPCMock({
      'workflow.getTemplate': () => sampleTemplate,
      'workflow.deleteTemplate': () => {
        deleteCalls += 1;
        return;
      },
    });
    const { result } = renderHookWithProviders(() => useTemplateFormSection('tmpl-1'));
    await waitFor(() => expect(result.current.isEditing).toBe(true));
    await act(async () => {
      result.current.handleDelete();
    });
    await waitFor(() => expect(deleteCalls).toBe(1));
    clearTRPCMock();
  });

  it('toasts an error when the save mutation fails', async () => {
    toastError.mockClear();
    setTRPCMock({
      'workflow.createTemplate': () => {
        throw new Error('save boom');
      },
    });
    const { result } = renderHookWithProviders(() => useTemplateFormSection());
    await act(async () => {
      result.current.handleSave({
        name: 'New',
        type: 'CUSTOM',
        description: '',
        tasks: [],
      });
    });
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    clearTRPCMock();
  });
});
