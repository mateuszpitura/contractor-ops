import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock layer: TRPC + react-query + next/navigation + sonner so the dialog
// exercises only its UI logic (file validation, error mapping, user flow).
// ---------------------------------------------------------------------------

const mockUploadMutate = vi.fn();
const mockPush = vi.fn();

const { FakeTRPCClientError } = vi.hoisted(() => {
  class FakeTRPCClientError extends Error {
    data?: { code?: string; details?: unknown };
    constructor(message: string, data?: { code?: string; details?: unknown }) {
      super(message);
      this.name = 'TRPCClientError';
      this.data = data;
    }
  }
  return { FakeTRPCClientError };
});

vi.mock('@trpc/client', () => ({
  TRPCClientError: FakeTRPCClientError,
}));

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>(
    '@tanstack/react-query',
  );
  return {
    ...actual,
    useMutation: () => ({
      mutate: mockUploadMutate,
      mutateAsync: mockUploadMutate,
      isPending: false,
      reset: vi.fn(),
    }),
  };
});

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn() }),
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/trpc/init', () => ({
  trpc: {
    invoiceIntake: {
      upload: {
        mutationOptions: (opts: unknown) => opts ?? {},
      },
    },
  },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() },
}));

// Import after mocks so the module picks them up.
import { fireEvent } from '@testing-library/react';
import { setup, screen } from '@/test/test-utils';
import { toast } from 'sonner';
import { IntakeUploadDialog } from '../intake-upload-dialog';

beforeEach(() => {
  mockUploadMutate.mockReset();
  mockPush.mockReset();
  (toast.success as unknown as ReturnType<typeof vi.fn>).mockReset?.();
  (toast.error as unknown as ReturnType<typeof vi.fn>).mockReset?.();
  (toast.message as unknown as ReturnType<typeof vi.fn>).mockReset?.();
});

function makeFile(
  name: string,
  { size = 1024, type = 'application/xml' }: { size?: number; type?: string } = {},
): File {
  const blob = new Blob([new Uint8Array(size)], { type });
  return new File([blob], name, { type });
}

describe('IntakeUploadDialog', () => {
  it('renders the drop-zone with a labelled file input', () => {
    setup(<IntakeUploadDialog open={true} onOpenChange={vi.fn()} />);
    const input = document.getElementById('intake-upload-input') as HTMLInputElement | null;
    expect(input).not.toBeNull();
    expect(input?.type).toBe('file');
    expect(input?.getAttribute('accept')).toContain('.xml');
    expect(input?.getAttribute('accept')).toContain('.pdf');
  });

  it('rejects wrong file types with an inline error and does NOT call the mutation', async () => {
    setup(<IntakeUploadDialog open={true} onOpenChange={vi.fn()} />);
    const input = document.getElementById('intake-upload-input') as HTMLInputElement;
    // Bypass the HTML5 `accept` attribute filter by dispatching the change
    // event directly with a non-matching file. The JS guard in the dialog
    // must still reject it even when the browser didn't pre-filter.
    const bad = makeFile('boot.exe', { type: 'application/octet-stream' });
    Object.defineProperty(input, 'files', { value: [bad], configurable: true });
    fireEvent.change(input);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(mockUploadMutate).not.toHaveBeenCalled();
  });

  it('rejects files > 5 MB with the locked error copy and does NOT call the mutation', async () => {
    const { user } = setup(<IntakeUploadDialog open={true} onOpenChange={vi.fn()} />);
    const input = document.getElementById('intake-upload-input') as HTMLInputElement;
    const big = makeFile('huge.pdf', { size: 5 * 1024 * 1024 + 1, type: 'application/pdf' });
    await user.upload(input, big);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent ?? '').toContain('5 MB');
    expect(mockUploadMutate).not.toHaveBeenCalled();
  });

  it('on successful upload: toasts success, closes dialog, and pushes to the detail route', async () => {
    mockUploadMutate.mockResolvedValueOnce({ kind: 'CREATED', intakeId: 'ck_new' });
    const handleOpen = vi.fn();
    const { user } = setup(<IntakeUploadDialog open={true} onOpenChange={handleOpen} />);
    const input = document.getElementById('intake-upload-input') as HTMLInputElement;
    await user.upload(input, makeFile('x.xml', { type: 'application/xml' }));
    // Drain microtasks.
    await Promise.resolve();
    await Promise.resolve();
    expect(mockUploadMutate).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith('/invoices/intake/ck_new');
    expect(handleOpen).toHaveBeenCalledWith(false);
  });

  it('on DEDUP_RETURNED: toasts the dedup message and still navigates', async () => {
    mockUploadMutate.mockResolvedValueOnce({ kind: 'DEDUP_RETURNED', intakeId: 'ck_existing' });
    const { user } = setup(<IntakeUploadDialog open={true} onOpenChange={vi.fn()} />);
    const input = document.getElementById('intake-upload-input') as HTMLInputElement;
    await user.upload(input, makeFile('y.pdf', { type: 'application/pdf' }));
    await Promise.resolve();
    await Promise.resolve();
    expect(toast.message).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith('/invoices/intake/ck_existing');
  });

  it('on hard-reject (CII_XSD_INVALID): keeps the dialog open and shows inline error + retry button', async () => {
    mockUploadMutate.mockRejectedValueOnce(
      new FakeTRPCClientError('CII_XSD_INVALID', {
        code: 'UNPROCESSABLE_CONTENT',
        details: { errors: ['cvc-complex-type.2.4.a at line 3'] },
      }),
    );
    const handleOpen = vi.fn();
    const { user } = setup(<IntakeUploadDialog open={true} onOpenChange={handleOpen} />);
    const input = document.getElementById('intake-upload-input') as HTMLInputElement;
    await user.upload(input, makeFile('bad.xml', { type: 'application/xml' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert.textContent ?? '').toContain('CII');
    // Dialog stayed open: onOpenChange was NOT called with false.
    expect(handleOpen).not.toHaveBeenCalledWith(false);
    // Retry button present.
    expect(screen.getByRole('button', { name: /try another/i })).toBeInTheDocument();
  });
});
