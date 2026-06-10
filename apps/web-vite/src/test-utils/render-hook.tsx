/**
 * renderHook harness for web-vite domain hooks.
 *
 * Pattern: each test file calls `vi.mock('../../../providers/trpc-provider.js')`
 * before any import, then imports `setTRPCMock` from this module to register
 * a `useTRPC` proxy that satisfies `trpc.<router>.<procedure>.queryOptions(...)`
 * / `.mutationOptions(...)` / `.queryKey()` / `.pathFilter()` shapes used by
 * the hooks. Tests do NOT hit the network — they let React Query call the
 * `queryFn` returned by `queryOptions(...)` against an in-test handler map.
 *
 * `renderHookWithProviders` wraps the hook in a fresh `QueryClient`
 * (retry:false, gcTime:0), `MemoryRouter`, `I18nextProvider`, and a
 * `NuqsTestingAdapter` so nuqs URL state resolves without a browser router.
 *
 * Each spec runs in <1s and stays hermetic: no real tRPC client, no fetch.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { RenderHookOptions, RenderHookResult } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import type { ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { applyLocale, i18next, initI18n } from '../i18n/index.js';

export type TRPCHandler = (input?: unknown) => unknown;

export type TRPCMock = Record<string, TRPCHandler>;

let currentMock: TRPCMock = {};

/**
 * Register the active tRPC handler map for the next renderHook call(s).
 * Keys are dot-paths such as `"contractor.list"` or `"audit.export"`.
 */
export function setTRPCMock(mock: TRPCMock): void {
  currentMock = mock;
}

export function clearTRPCMock(): void {
  currentMock = {};
}

interface ProcedureLeaf {
  queryOptions: (input?: unknown) => {
    queryKey: readonly unknown[];
    queryFn: () => Promise<unknown> | unknown;
  };
  mutationOptions: (opts?: {
    onSuccess?: (data: unknown, vars: unknown) => void | Promise<void>;
    onError?: (err: Error, vars: unknown) => void;
    onSettled?: () => void;
  }) => {
    mutationKey: readonly unknown[];
    mutationFn: (vars: unknown) => Promise<unknown>;
    onSuccess?: (data: unknown, vars: unknown) => void | Promise<void>;
    onError?: (err: Error, vars: unknown) => void;
    onSettled?: () => void;
  };
  queryKey: (input?: unknown) => readonly unknown[];
  pathFilter: () => { queryKey: readonly unknown[] };
}

function buildLeaf(path: string): ProcedureLeaf {
  return {
    queryOptions: (input?: unknown) => ({
      queryKey: [path, input],
      queryFn: () => {
        const handler = currentMock[path];
        if (!handler) {
          return {};
        }
        return handler(input);
      },
    }),
    mutationOptions: (opts = {}) => ({
      mutationKey: [path],
      mutationFn: async (vars: unknown) => {
        const handler = currentMock[path];
        if (!handler) {
          return {};
        }
        return handler(vars);
      },
      ...opts,
    }),
    queryKey: (input?: unknown) => [path, input],
    pathFilter: () => ({ queryKey: [path] }),
  };
}

/**
 * Build a recursive proxy mirroring the tRPC v11 client surface
 * (`trpc.<router>.<procedure>.queryOptions(...)`).
 */
export function createTRPCProxy(): Record<string, unknown> {
  const cache = new Map<string, unknown>();

  function makeNode(path: string): unknown {
    if (cache.has(path)) return cache.get(path);
    const leaf = path === '' ? null : buildLeaf(path);
    const target = function noop() {
      return;
    };
    const proxy = new Proxy(target, {
      get(_target, prop: string | symbol) {
        if (typeof prop === 'symbol') return;
        if (leaf && prop in leaf) {
          return (leaf as unknown as Record<string, unknown>)[prop];
        }
        const next = path ? `${path}.${prop}` : prop;
        return makeNode(next);
      },
    });
    cache.set(path, proxy);
    return proxy;
  }

  return makeNode('') as Record<string, unknown>;
}

interface WrapperOptions {
  locale?: 'en' | 'pl' | 'de' | 'ar';
  initialPath?: string;
}

let i18nReady: Promise<void> | undefined;
function ensureI18n(locale: 'en' | 'pl' | 'de' | 'ar'): Promise<void> {
  if (!i18nReady) {
    i18nReady = (async () => {
      await initI18n();
    })();
  }
  return i18nReady.then(() => applyLocale(locale));
}

function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

export interface RenderHookWithProvidersOptions<TProps>
  extends Omit<RenderHookOptions<TProps>, 'wrapper'>,
    WrapperOptions {
  queryClient?: QueryClient;
}

export interface RenderHookWithProvidersResult<TResult, TProps>
  extends RenderHookResult<TResult, TProps> {
  queryClient: QueryClient;
}

export function renderHookWithProviders<TResult, TProps = unknown>(
  callback: (initialProps: TProps) => TResult,
  options: RenderHookWithProvidersOptions<TProps> = {},
): RenderHookWithProvidersResult<TResult, TProps> {
  const { locale = 'en', initialPath = `/${'en'}`, queryClient: provided, ...rest } = options;
  void ensureI18n(locale);
  const queryClient = provided ?? createTestQueryClient();
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <NuqsTestingAdapter>
          <MemoryRouter initialEntries={[initialPath]}>
            <Routes>
              <Route
                path="/:locale/*"
                element={<I18nextProvider i18n={i18next}>{children}</I18nextProvider>}
              />
              <Route
                path="*"
                element={<I18nextProvider i18n={i18next}>{children}</I18nextProvider>}
              />
            </Routes>
          </MemoryRouter>
        </NuqsTestingAdapter>
      </QueryClientProvider>
    );
  }
  const result = renderHook(callback, { wrapper: Wrapper, ...rest });
  return { ...result, queryClient };
}

// biome-ignore lint/performance/noBarrelFile: tiny test-utils re-export, scope-limited
export { act, waitFor } from '@testing-library/react';
