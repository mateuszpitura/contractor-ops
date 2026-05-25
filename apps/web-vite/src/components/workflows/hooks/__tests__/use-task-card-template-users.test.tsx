/**
 * `useTaskCardTemplateUsers` — lazily fetches users for FIXED_USER tasks
 * in the template builder. Covers: ROLE_BASED (no fetch / empty users),
 * FIXED_USER loading, FIXED_USER success, FIXED_USER error.
 */

import { describe, expect, it, vi } from 'vitest';

import {
  clearTRPCMock,
  createTRPCProxy,
  renderHookWithProviders,
  setTRPCMock,
  waitFor,
} from '../../../../test-utils/render-hook.js';

vi.mock('../../../../providers/trpc-provider.js', () => {
  const trpc = createTRPCProxy();
  return { useTRPC: () => trpc, usePortalTRPC: () => trpc };
});

const { useTaskCardTemplateUsers } = await import('../use-task-card-template-users.js');

type FakeForm = {
  watch: (path: string) => string | undefined;
};

function makeForm(mode: string | undefined): FakeForm {
  return {
    watch: () => mode,
  };
}

describe('useTaskCardTemplateUsers', () => {
  it('returns an empty user list when assigneeMode is ROLE_BASED (no fetch)', async () => {
    let calls = 0;
    setTRPCMock({
      'user.list': () => {
        calls += 1;
        return [{ id: 'u1', name: 'Ada', email: 'ada@x.com' }];
      },
    });
    const form = makeForm('ROLE_BASED');
    const { result } = renderHookWithProviders(() =>
      useTaskCardTemplateUsers(
        form as unknown as Parameters<typeof useTaskCardTemplateUsers>[0],
        0,
      ),
    );
    await waitFor(() => expect(result.current.usersQuery.isLoading).toBe(false));
    expect(result.current.users).toEqual([]);
    expect(calls).toBe(0);
    clearTRPCMock();
  });

  it('falls back to ROLE_BASED when assigneeMode is undefined', async () => {
    setTRPCMock({
      'user.list': () => [{ id: 'u1' }],
    });
    const form = makeForm(undefined);
    const { result } = renderHookWithProviders(() =>
      useTaskCardTemplateUsers(
        form as unknown as Parameters<typeof useTaskCardTemplateUsers>[0],
        0,
      ),
    );
    await waitFor(() => expect(result.current.usersQuery.isLoading).toBe(false));
    expect(result.current.users).toEqual([]);
    clearTRPCMock();
  });

  it('reports loading while the user query is pending in FIXED_USER mode', () => {
    setTRPCMock({
      'user.list': () => new Promise(() => undefined),
    });
    const form = makeForm('FIXED_USER');
    const { result } = renderHookWithProviders(() =>
      useTaskCardTemplateUsers(
        form as unknown as Parameters<typeof useTaskCardTemplateUsers>[0],
        0,
      ),
    );
    expect(result.current.usersQuery.isLoading).toBe(true);
    expect(result.current.users).toEqual([]);
    clearTRPCMock();
  });

  it('exposes users on success in FIXED_USER mode', async () => {
    setTRPCMock({
      'user.list': () => [
        { id: 'u1', name: 'Ada', email: 'ada@x.com' },
        { id: 'u2', name: 'Linus', email: 'linus@x.com' },
      ],
    });
    const form = makeForm('FIXED_USER');
    const { result } = renderHookWithProviders(() =>
      useTaskCardTemplateUsers(
        form as unknown as Parameters<typeof useTaskCardTemplateUsers>[0],
        0,
      ),
    );
    await waitFor(() => expect(result.current.users.length).toBe(2));
    expect(result.current.users[0]?.name).toBe('Ada');
    clearTRPCMock();
  });

  it('falls back to an empty list when the FIXED_USER query errors', async () => {
    setTRPCMock({
      'user.list': () => {
        throw new Error('boom');
      },
    });
    const form = makeForm('FIXED_USER');
    const { result } = renderHookWithProviders(() =>
      useTaskCardTemplateUsers(
        form as unknown as Parameters<typeof useTaskCardTemplateUsers>[0],
        0,
      ),
    );
    await waitFor(() => expect(result.current.usersQuery.isLoading).toBe(false));
    expect(result.current.users).toEqual([]);
    clearTRPCMock();
  });
});
