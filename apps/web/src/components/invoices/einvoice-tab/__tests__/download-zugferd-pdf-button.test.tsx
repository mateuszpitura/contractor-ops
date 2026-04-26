import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — the button exercises only the success path + error path via
// tRPC's mutation hook. We stub the mutation and the toast facade.
// ---------------------------------------------------------------------------

const { mutationState } = vi.hoisted(() => ({
  mutationState: { next: (async () => ({})) as () => Promise<unknown>, isPending: false },
}));

vi.mock('@tanstack/react-query', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useMutation: (options: {
      onSuccess?: (r: unknown) => void;
      onError?: (e: unknown) => void;
    }) => {
      const mutate = vi.fn((input: unknown) => {
        void (async () => {
          try {
            const result = await mutationState.next();
            options.onSuccess?.(result);
          } catch (err) {
            options.onError?.(err);
          }
        })();
        return input;
      });
      return {
        mutate,
        mutateAsync: mutate,
        isPending: mutationState.isPending,
        reset: vi.fn(),
      };
    },
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});

vi.mock('@/trpc/init', () => ({
  trpc: {
    einvoice: {
      generateZugferdPdf: {
        mutationOptions: (opts: unknown) => opts ?? {},
      },
    },
    invoice: {
      getById: {
        queryKey: () => ['invoice', 'getById'],
      },
    },
  },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { toast } from 'sonner';
import { screen, setup, waitFor } from '@/test/test-utils';
import { DownloadZugferdPdfButton } from '../download-zugferd-pdf-button';

beforeEach(() => {
  mutationState.next = async () => ({});
  mutationState.isPending = false;
  (toast.success as unknown as ReturnType<typeof vi.fn>).mockReset?.();
  (toast.error as unknown as ReturnType<typeof vi.fn>).mockReset?.();
});

describe('DownloadZugferdPdfButton', () => {
  it('on success: creates a transient <a download> anchor with the signed URL and toasts success', async () => {
    const clickSpy = vi.fn();
    const createElementOrig = document.createElement.bind(document);
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation(tag => {
      const el = createElementOrig(tag) as HTMLAnchorElement;
      if (tag === 'a') {
        el.click = clickSpy;
      }
      return el;
    });

    mutationState.next = async () => ({
      signedUrl: 'https://r2.example.com/signed/inv_abc/zugferd.pdf',
      expiresInSeconds: 300,
      reused: false,
    });

    const { user } = setup(<DownloadZugferdPdfButton invoiceId="inv_abc" />);
    await user.click(screen.getByTestId('download-zugferd-pdf-button'));

    await waitFor(() => expect(clickSpy).toHaveBeenCalledTimes(1));
    expect(toast.success).toHaveBeenCalled();
    createElementSpy.mockRestore();
  });

  it('on mutation error: toasts the generation-failure message', async () => {
    mutationState.next = async () => {
      throw new Error('ZUGFERD_WRAPPING_FAILED');
    };

    const { user } = setup(<DownloadZugferdPdfButton invoiceId="inv_fail" />);
    await user.click(screen.getByTestId('download-zugferd-pdf-button'));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    const errMessage = (toast.error as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0] as string;
    expect(errMessage).toContain('ZUGFeRD');
  });
});
