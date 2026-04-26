import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTemplateMutations } from '../use-template-mutations';

// Mock trpc
vi.mock('@/trpc/init', () => ({
  trpc: {
    workflow: {
      updateTemplate: {
        mutationOptions: () => ({
          mutationFn: vi.fn().mockResolvedValue({}),
        }),
      },
      deleteTemplate: {
        mutationOptions: () => ({
          mutationFn: vi.fn().mockResolvedValue({}),
        }),
      },
      duplicateTemplate: {
        mutationOptions: () => ({
          mutationFn: vi.fn().mockResolvedValue({}),
        }),
      },
    },
  },
}));

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useTemplateMutations', () => {
  const mockT = vi.fn((key: string) => key);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts with isPending = false', () => {
    const { result } = renderHook(() => useTemplateMutations(mockT), {
      wrapper: createWrapper(),
    });
    expect(result.current.isPending).toBe(false);
  });

  it('exposes activate, archive, duplicate, deleteTemplate', () => {
    const { result } = renderHook(() => useTemplateMutations(mockT), {
      wrapper: createWrapper(),
    });
    expect(typeof result.current.activate).toBe('function');
    expect(typeof result.current.archive).toBe('function');
    expect(typeof result.current.duplicate).toBe('function');
    expect(typeof result.current.deleteTemplate).toBe('function');
  });

  it('activate can be called without error', () => {
    const { result } = renderHook(() => useTemplateMutations(mockT), {
      wrapper: createWrapper(),
    });
    act(() => {
      void result.current.activate('tpl-1');
    });
  });

  it('archive can be called without error', () => {
    const { result } = renderHook(() => useTemplateMutations(mockT), {
      wrapper: createWrapper(),
    });
    act(() => {
      void result.current.archive('tpl-1');
    });
  });

  it('duplicate can be called without error', () => {
    const { result } = renderHook(() => useTemplateMutations(mockT), {
      wrapper: createWrapper(),
    });
    act(() => {
      void result.current.duplicate('tpl-1');
    });
  });

  it('deleteTemplate can be called without error', () => {
    const { result } = renderHook(() => useTemplateMutations(mockT), {
      wrapper: createWrapper(),
    });
    act(() => {
      void result.current.deleteTemplate('tpl-1');
    });
  });
});
