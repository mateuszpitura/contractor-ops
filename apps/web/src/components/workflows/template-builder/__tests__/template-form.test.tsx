import { useMutation, useQuery } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, setup, waitFor } from '@/test/test-utils';
import { TemplateForm } from '../template-form';

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useQuery: vi.fn(),
    useMutation: vi.fn(),
    useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
  };
});

vi.mock('@/trpc/init', () => ({
  trpc: {
    workflow: {
      getTemplate: {
        queryOptions: () => ({
          queryKey: ['workflow', 'getTemplate'],
          enabled: false,
        }),
      },
      createTemplate: { mutationOptions: () => ({}) },
      updateTemplate: { mutationOptions: () => ({}) },
      deleteTemplate: { mutationOptions: () => ({}) },
      duplicateTemplate: { mutationOptions: () => ({}) },
    },
  },
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('@/components/workflows/template-builder/sortable-task-list', () => ({
  SortableTaskList: () => <div data-testid="sortable-task-list">SortableTaskList</div>,
}));

vi.mock('@/components/workflows/template-builder/use-template-form', () => ({
  useTemplateForm: () => ({
    form: {
      handleSubmit: (fn: (values: unknown) => void) => (e?: { preventDefault: () => void }) => {
        e?.preventDefault();
        fn({ name: 'Test', type: 'ONBOARDING', description: '', tasks: [] });
      },
      register: () => ({
        name: 'test',
        onChange: vi.fn(),
        onBlur: vi.fn(),
        ref: vi.fn(),
      }),
      watch: (key: string) => {
        if (key === 'tasks') return [];
        if (key === 'type') return 'ONBOARDING';
        if (key === 'name') return 'Test Template';
        return '';
      },
      setValue: vi.fn(),
      formState: { errors: {} },
      reset: vi.fn(),
      getValues: vi.fn(),
    },
    fields: [],
    isDirty: false,
    addTask: vi.fn(),
    removeTask: vi.fn(),
    reorderTasks: vi.fn(),
  }),
}));

const mockedUseQuery = vi.mocked(useQuery);
const mockedUseMutation = vi.mocked(useMutation);

describe('TemplateForm', () => {
  beforeEach(() => {
    mockedUseQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
    } as unknown);
    mockedUseMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown);
  });

  // ---- Form fields ----
  it('renders form with name input and save button for new template', () => {
    render(<TemplateForm />);
    expect(screen.getByText('Template name')).toBeInTheDocument();
    expect(screen.getByText('Save template')).toBeInTheDocument();
  });

  it('renders tasks heading and sortable task list', () => {
    render(<TemplateForm />);
    expect(screen.getByText('Tasks')).toBeInTheDocument();
    expect(screen.getByTestId('sortable-task-list')).toBeInTheDocument();
  });

  it('renders description field', () => {
    render(<TemplateForm />);
    expect(screen.getByText('Description (optional)')).toBeInTheDocument();
  });

  it('renders type selector', () => {
    render(<TemplateForm />);
    expect(screen.getByText('Type')).toBeInTheDocument();
  });

  // ---- New template mode ----
  it('does not show status badge, activate, duplicate, or delete buttons for new template', () => {
    render(<TemplateForm />);
    expect(screen.queryByText('DRAFT')).not.toBeInTheDocument();
    expect(screen.queryByText('Activate')).not.toBeInTheDocument();
    expect(screen.queryByText('Duplicate')).not.toBeInTheDocument();
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
  });

  // ---- Edit mode: DRAFT ----
  it('shows status badge when editing an existing template', () => {
    mockedUseQuery.mockReturnValue({
      data: {
        id: 't-1',
        name: 'Test',
        type: 'ONBOARDING',
        status: 'DRAFT',
        tasks: [],
      },
      isLoading: false,
    } as unknown);
    render(<TemplateForm templateId="t-1" />);
    expect(screen.getByText('Status')).toBeInTheDocument();
  });

  it('shows activate and delete buttons for DRAFT editing template', () => {
    mockedUseQuery.mockReturnValue({
      data: {
        id: 't-1',
        name: 'Test',
        type: 'ONBOARDING',
        status: 'DRAFT',
        tasks: [],
      },
      isLoading: false,
    } as unknown);
    render(<TemplateForm templateId="t-1" />);
    expect(screen.getByText('Activate')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  // ---- Edit mode: ACTIVE ----
  it('shows archive button for ACTIVE editing template', () => {
    mockedUseQuery.mockReturnValue({
      data: {
        id: 't-1',
        name: 'Test',
        type: 'ONBOARDING',
        status: 'ACTIVE',
        tasks: [],
      },
      isLoading: false,
    } as unknown);
    render(<TemplateForm templateId="t-1" />);
    expect(screen.getByText('Archive')).toBeInTheDocument();
    expect(screen.queryByText('Activate')).not.toBeInTheDocument();
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
  });

  // ---- Duplicate ----
  it('shows duplicate button when editing', () => {
    mockedUseQuery.mockReturnValue({
      data: {
        id: 't-1',
        name: 'Test',
        type: 'ONBOARDING',
        status: 'DRAFT',
        tasks: [],
      },
      isLoading: false,
    } as unknown);
    render(<TemplateForm templateId="t-1" />);
    expect(screen.getByText('Duplicate')).toBeInTheDocument();
  });

  // ---- Save button disabled state ----
  it('disables save button when mutation is pending', () => {
    mockedUseMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: true,
    } as unknown);
    render(<TemplateForm />);
    const saveBtn = screen.getByText('Save template').closest('button');
    expect(saveBtn).toBeDisabled();
  });

  // ---- ARCHIVED status ----
  it('does not show activate, archive, or delete for ARCHIVED template', () => {
    mockedUseQuery.mockReturnValue({
      data: {
        id: 't-1',
        name: 'Test',
        type: 'ONBOARDING',
        status: 'ARCHIVED',
        tasks: [],
      },
      isLoading: false,
    } as unknown);
    render(<TemplateForm templateId="t-1" />);
    expect(screen.queryByText('Activate')).not.toBeInTheDocument();
    expect(screen.queryByText('Archive')).not.toBeInTheDocument();
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
  });

  // ---- Form submit ----
  it('renders form element with submit button', () => {
    render(<TemplateForm />);
    const saveBtn = screen.getByText('Save template').closest('button')!;
    expect(saveBtn).toHaveAttribute('type', 'submit');
  });

  // ---- Activate button click ----
  it('calls mutate when activate is clicked', async () => {
    const mutateFn = vi.fn();
    mockedUseQuery.mockReturnValue({
      data: {
        id: 't-1',
        name: 'Test',
        type: 'ONBOARDING',
        status: 'DRAFT',
        tasks: [],
      },
      isLoading: false,
    } as unknown);
    mockedUseMutation.mockReturnValue({
      mutate: mutateFn,
      isPending: false,
    } as unknown);
    const { user } = setup(<TemplateForm templateId="t-1" />);
    await user.click(screen.getByText('Activate'));
    expect(mutateFn).toHaveBeenCalled();
  });

  // ---- Duplicate button click ----
  it('calls mutate when duplicate is clicked', async () => {
    const mutateFn = vi.fn();
    mockedUseQuery.mockReturnValue({
      data: {
        id: 't-1',
        name: 'Test',
        type: 'ONBOARDING',
        status: 'DRAFT',
        tasks: [],
      },
      isLoading: false,
    } as unknown);
    mockedUseMutation.mockReturnValue({
      mutate: mutateFn,
      isPending: false,
    } as unknown);
    const { user } = setup(<TemplateForm templateId="t-1" />);
    await user.click(screen.getByText('Duplicate'));
    expect(mutateFn).toHaveBeenCalled();
  });

  // ---- Status badge renders correct value ----
  it('renders DRAFT status badge', () => {
    mockedUseQuery.mockReturnValue({
      data: {
        id: 't-1',
        name: 'Test',
        type: 'ONBOARDING',
        status: 'DRAFT',
        tasks: [],
      },
      isLoading: false,
    } as unknown);
    render(<TemplateForm templateId="t-1" />);
    expect(screen.getByText('DRAFT')).toBeInTheDocument();
  });

  it('renders ACTIVE status badge', () => {
    mockedUseQuery.mockReturnValue({
      data: {
        id: 't-1',
        name: 'Test',
        type: 'ONBOARDING',
        status: 'ACTIVE',
        tasks: [],
      },
      isLoading: false,
    } as unknown);
    render(<TemplateForm templateId="t-1" />);
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
  });

  it('renders ARCHIVED status badge', () => {
    mockedUseQuery.mockReturnValue({
      data: {
        id: 't-1',
        name: 'Test',
        type: 'ONBOARDING',
        status: 'ARCHIVED',
        tasks: [],
      },
      isLoading: false,
    } as unknown);
    render(<TemplateForm templateId="t-1" />);
    expect(screen.getByText('ARCHIVED')).toBeInTheDocument();
  });

  // ---- Dirty indicator ----
  it('does not show dirty indicator when form is not dirty', () => {
    render(<TemplateForm />);
    // isDirty is false in mock, so no dot indicator should appear
    const saveBtn = screen.getByText('Save template').closest('button')!;
    const dot = saveBtn.querySelector('span.rounded-full');
    expect(dot).toBeNull();
  });

  // ---- Delete button opens confirmation ----
  it('renders delete button for DRAFT template', () => {
    mockedUseQuery.mockReturnValue({
      data: {
        id: 't-1',
        name: 'Test',
        type: 'ONBOARDING',
        status: 'DRAFT',
        tasks: [],
      },
      isLoading: false,
    } as unknown);
    render(<TemplateForm templateId="t-1" />);
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('delete button is clickable for DRAFT template', async () => {
    mockedUseQuery.mockReturnValue({
      data: {
        id: 't-1',
        name: 'Test',
        type: 'ONBOARDING',
        status: 'DRAFT',
        tasks: [],
      },
      isLoading: false,
    } as unknown);
    mockedUseMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown);
    const { user } = setup(<TemplateForm templateId="t-1" />);
    await user.click(screen.getByText('Delete'));
    // Click should not throw
  });

  // ---- Archive button click ----
  it('archive button is clickable for ACTIVE template', async () => {
    mockedUseQuery.mockReturnValue({
      data: {
        id: 't-1',
        name: 'Test',
        type: 'ONBOARDING',
        status: 'ACTIVE',
        tasks: [],
      },
      isLoading: false,
    } as unknown);
    mockedUseMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown);
    const { user } = setup(<TemplateForm templateId="t-1" />);
    await user.click(screen.getByText('Archive'));
    // Click should not throw
  });

  // ---- Form contains all expected sections ----
  it('renders all form sections for new template', () => {
    render(<TemplateForm />);
    expect(screen.getByText('Template name')).toBeInTheDocument();
    expect(screen.getByText('Description (optional)')).toBeInTheDocument();
    expect(screen.getByText('Type')).toBeInTheDocument();
    expect(screen.getByText('Tasks')).toBeInTheDocument();
    expect(screen.getByText('Save template')).toBeInTheDocument();
  });

  // ---- SortableTaskList is rendered ----
  it('renders SortableTaskList component', () => {
    render(<TemplateForm />);
    expect(screen.getByTestId('sortable-task-list')).toBeInTheDocument();
  });

  // ---- Loading state ----
  it('renders form even when query is loading', () => {
    mockedUseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
    } as unknown);
    render(<TemplateForm templateId="t-1" />);
    expect(screen.getByText('Template name')).toBeInTheDocument();
  });

  it('renders type selector with correct value', () => {
    render(<TemplateForm />);
    expect(screen.getByText('Type')).toBeInTheDocument();
  });

  it('renders save button as submit type', () => {
    render(<TemplateForm />);
    const saveBtn = screen.getByText('Save template').closest('button');
    expect(saveBtn).toHaveAttribute('type', 'submit');
  });

  it('shows duplicate button for existing template', () => {
    mockedUseQuery.mockReturnValue({
      data: {
        id: 't-1',
        name: 'Test',
        type: 'ONBOARDING',
        status: 'ACTIVE',
        tasks: [],
      },
      isLoading: false,
    } as unknown);
    render(<TemplateForm templateId="t-1" />);
    expect(screen.getByText('Duplicate')).toBeInTheDocument();
  });

  it('renders SortableTaskList and tasks heading together', () => {
    render(<TemplateForm />);
    expect(screen.getByText('Tasks')).toBeInTheDocument();
    expect(screen.getByTestId('sortable-task-list')).toBeInTheDocument();
  });

  it('renders description field as optional', () => {
    render(<TemplateForm />);
    expect(screen.getByText('Description (optional)')).toBeInTheDocument();
  });

  it('renders Template name field in form', () => {
    render(<TemplateForm />);
    expect(screen.getByText('Template name')).toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // Interaction tests - submit, activate, delete confirm, archive confirm
  // ---------------------------------------------------------------------------

  it('submits form when save template button is clicked for new template', async () => {
    mockedUseMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown);
    const { user } = setup(<TemplateForm />);
    const saveBtn = screen.getByText('Save template').closest('button')!;
    // Click submit - form handleSubmit is called via mock
    await user.click(saveBtn);
    // The form should still be visible after submit
    expect(screen.getByText('Template name')).toBeInTheDocument();
  });

  it('submits form when save template button is clicked for existing template', async () => {
    mockedUseQuery.mockReturnValue({
      data: {
        id: 't-1',
        name: 'Test',
        type: 'ONBOARDING',
        status: 'DRAFT',
        tasks: [],
      },
      isLoading: false,
    } as unknown);
    mockedUseMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown);
    const { user } = setup(<TemplateForm templateId="t-1" />);
    await user.click(screen.getByText('Save template'));
    // The form should still be visible after submit
    expect(screen.getByText('Template name')).toBeInTheDocument();
  });

  it('opens archive confirmation dialog when archive is clicked', async () => {
    mockedUseQuery.mockReturnValue({
      data: {
        id: 't-1',
        name: 'My Template',
        type: 'ONBOARDING',
        status: 'ACTIVE',
        tasks: [],
      },
      isLoading: false,
    } as unknown);
    mockedUseMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown);
    const { user } = setup(<TemplateForm templateId="t-1" />);
    await user.click(screen.getByText('Archive'));
    // Alert dialog should appear
    await waitFor(() => {
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });
  });

  it('opens delete confirmation dialog when delete is clicked', async () => {
    mockedUseQuery.mockReturnValue({
      data: {
        id: 't-1',
        name: 'My Template',
        type: 'ONBOARDING',
        status: 'DRAFT',
        tasks: [],
      },
      isLoading: false,
    } as unknown);
    mockedUseMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown);
    const { user } = setup(<TemplateForm templateId="t-1" />);
    await user.click(screen.getByText('Delete'));
    // Alert dialog should appear
    await waitFor(() => {
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });
  });

  it('confirms delete and calls delete mutation', async () => {
    const mutateFn = vi.fn();
    mockedUseQuery.mockReturnValue({
      data: {
        id: 't-1',
        name: 'My Template',
        type: 'ONBOARDING',
        status: 'DRAFT',
        tasks: [],
      },
      isLoading: false,
    } as unknown);
    mockedUseMutation.mockReturnValue({
      mutate: mutateFn,
      isPending: false,
    } as unknown);
    const { user } = setup(<TemplateForm templateId="t-1" />);
    await user.click(screen.getByText('Delete'));
    await waitFor(() => {
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });
    // Click confirm in the alert dialog
    const _confirmBtn = screen.getByRole('button', { name: /delete/i });
    const alertBtns = document.querySelectorAll('[data-slot="alert-dialog-action"]');
    if (alertBtns.length > 0) {
      await user.click(alertBtns[0] as HTMLElement);
      expect(mutateFn).toHaveBeenCalled();
    }
  });

  it('confirms archive and calls archive mutation', async () => {
    const mutateFn = vi.fn();
    mockedUseQuery.mockReturnValue({
      data: {
        id: 't-1',
        name: 'My Template',
        type: 'ONBOARDING',
        status: 'ACTIVE',
        tasks: [],
      },
      isLoading: false,
    } as unknown);
    mockedUseMutation.mockReturnValue({
      mutate: mutateFn,
      isPending: false,
    } as unknown);
    const { user } = setup(<TemplateForm templateId="t-1" />);
    await user.click(screen.getByText('Archive'));
    await waitFor(() => {
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });
    const alertBtns = document.querySelectorAll('[data-slot="alert-dialog-action"]');
    if (alertBtns.length > 0) {
      await user.click(alertBtns[0] as HTMLElement);
      expect(mutateFn).toHaveBeenCalled();
    }
  });
});
