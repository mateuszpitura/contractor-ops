import { vi } from 'vitest';

type QueryKey = unknown[];

function keyToString(key: QueryKey | undefined) {
  return JSON.stringify(key ?? []);
}

export interface ReactQueryMockController {
  queryClient: {
    invalidateQueries: ReturnType<typeof vi.fn>;
  };
  setQueryResult: (queryKey: QueryKey, result: Record<string, unknown>) => void;
  setDefaultQueryResult: (result: Record<string, unknown>) => void;
  setUseMutationImpl: (
    impl: (
      options?: object,
    ) => { mutate: (vars?: unknown) => void; isPending: boolean; status: 'idle' } & object,
  ) => void;
  factory: () => Promise<Record<string, unknown>>;
}

/**
 * Helper for tests migrating to canonical tRPC v11 usage:
 * components call `useQuery(trpc.x.y.queryOptions(...))` and `useMutation(...)`.
 *
 * This creates a per-test controller you can use inside `vi.mock('@tanstack/react-query', ...)`.
 */
export function createReactQueryMockController(): ReactQueryMockController {
  const queryResults = new Map<string, Record<string, unknown>>();
  let defaultQueryResult: Record<string, unknown> = { data: undefined, isLoading: false };

  const queryClient = {
    invalidateQueries: vi.fn(),
  };

  let useMutationImpl = <T extends object>(options?: T) => {
    return {
      mutate: (_vars?: unknown) => {
        // Common pattern: tests want onSuccess side-effects
        (options as { onSuccess?: (...args: unknown[]) => void } | undefined)?.onSuccess?.();
      },
      isPending: false,
      status: 'idle' as const,
      ...(options ?? ({} as T)),
    };
  };

  const factory = async () => {
    const actual = await vi.importActual<Record<string, unknown>>('@tanstack/react-query');
    return {
      ...actual,
      useQuery: (opts: { queryKey?: QueryKey }) => {
        const hit = queryResults.get(keyToString(opts?.queryKey));
        return hit ?? defaultQueryResult;
      },
      useMutation: (options?: object) => useMutationImpl(options),
      useQueryClient: () => queryClient,
    };
  };

  return {
    queryClient,
    setQueryResult: (queryKey, result) => queryResults.set(keyToString(queryKey), result),
    setDefaultQueryResult: result => {
      defaultQueryResult = result;
    },
    setUseMutationImpl: impl => {
      useMutationImpl = impl as unknown as typeof useMutationImpl;
    },
    factory,
  };
}
