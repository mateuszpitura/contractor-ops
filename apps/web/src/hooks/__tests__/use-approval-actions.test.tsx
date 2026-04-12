import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useApprovalActions } from "../use-approval-actions";

// Mock trpc
vi.mock("@/trpc/init", () => ({
  trpc: {
    approval: {
      approve: {
        mutationOptions: (opts?: Record<string, unknown>) => ({
          mutationFn: vi.fn().mockResolvedValue({}),
          ...opts,
        }),
      },
      reject: {
        mutationOptions: (opts?: Record<string, unknown>) => ({
          mutationFn: vi.fn().mockResolvedValue({}),
          ...opts,
        }),
      },
      requestClarification: {
        mutationOptions: (opts?: Record<string, unknown>) => ({
          mutationFn: vi.fn().mockResolvedValue({}),
          ...opts,
        }),
      },
      delegate: {
        mutationOptions: (opts?: Record<string, unknown>) => ({
          mutationFn: vi.fn().mockResolvedValue({}),
          ...opts,
        }),
      },
    },
  },
}));

// Mock sonner
vi.mock("sonner", () => ({
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

describe("useApprovalActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts with isPending = false", () => {
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useApprovalActions("step-1", onSuccess), {
      wrapper: createWrapper(),
    });
    expect(result.current.isPending).toBe(false);
  });

  it("exposes approve, reject, delegate, requestClarification functions", () => {
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useApprovalActions("step-1", onSuccess), {
      wrapper: createWrapper(),
    });
    expect(typeof result.current.approve).toBe("function");
    expect(typeof result.current.reject).toBe("function");
    expect(typeof result.current.delegate).toBe("function");
    expect(typeof result.current.requestClarification).toBe("function");
  });

  it("approve can be called without error", () => {
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useApprovalActions("step-1", onSuccess), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.approve();
    });
    // No error thrown = pass
  });

  it("reject can be called with a comment", () => {
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useApprovalActions("step-1", onSuccess), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.reject("Not acceptable");
    });
  });

  it("delegate can be called with userId and comment", () => {
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useApprovalActions("step-1", onSuccess), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.delegate("user-2", "Please review");
    });
  });

  it("requestClarification can be called with a comment", () => {
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useApprovalActions("step-1", onSuccess), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.requestClarification("Need more details");
    });
  });
});
