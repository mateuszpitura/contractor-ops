/**
 * Spec for `useEquipmentAssign` + `useAssignmentDialog`. Covers
 * contractor list search (gated <2 chars), selection lifecycle, assign
 * mutation toast + invalidation, and dialog open/reset semantics.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../providers/trpc-provider.js', () => ({
  useTRPC: () => trpcProxy,
  usePortalTRPC: () => trpcProxy,
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

import {
  act,
  createTRPCProxy,
  renderHookWithProviders,
  setTRPCMock,
  waitFor,
} from '../../../../test-utils/render-hook.js';
import { useAssignmentDialog, useEquipmentAssign } from '../use-equipment-assignment.js';

const trpcProxy = createTRPCProxy();

describe('useEquipmentAssign', () => {
  it('assigns and emits success toast on success', async () => {
    toastSuccess.mockClear();
    const onSuccess = vi.fn();
    setTRPCMock({
      'equipment.assign': () => ({ id: 'a1' }),
    });
    const { result } = renderHookWithProviders(() =>
      useEquipmentAssign({
        equipmentId: 'eq1',
        selectedContractorName: 'Acme',
        onSuccess,
      }),
    );
    act(() => result.current.assign('c1'));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(onSuccess).toHaveBeenCalled();
  });

  it('emits error toast and skips onSuccess on failure', async () => {
    toastError.mockClear();
    const onSuccess = vi.fn();
    setTRPCMock({
      'equipment.assign': () => {
        throw new Error('conflict');
      },
    });
    const { result } = renderHookWithProviders(() =>
      useEquipmentAssign({
        equipmentId: 'eq1',
        selectedContractorName: 'Acme',
        onSuccess,
      }),
    );
    act(() => result.current.assign('c1'));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(onSuccess).not.toHaveBeenCalled();
  });
});

describe('useAssignmentDialog', () => {
  it('initial state — empty search/selection + empty contractors', () => {
    setTRPCMock({
      'contractor.list': () => ({ items: [] }),
    });
    const { result } = renderHookWithProviders(() =>
      useAssignmentDialog({ equipmentId: 'eq1', onOpenChange: vi.fn() }),
    );
    expect(result.current.search).toBe('');
    expect(result.current.selectedContractorId).toBeNull();
    expect(result.current.selectedContractorName).toBe('');
    expect(result.current.contractors).toEqual([]);
  });

  it('updates search + selection state', async () => {
    setTRPCMock({
      'contractor.list': () => ({
        items: [{ id: 'c1', displayName: 'Acme', legalName: 'Acme Sp z o.o.' }],
      }),
    });
    const { result } = renderHookWithProviders(() =>
      useAssignmentDialog({ equipmentId: 'eq1', onOpenChange: vi.fn() }),
    );
    act(() => result.current.setSearch('ac'));
    expect(result.current.search).toBe('ac');
    await waitFor(() => expect(result.current.contractors.length).toBeGreaterThan(0));
    act(() => result.current.setSelectedContractorId('c1'));
    act(() => result.current.setSelectedContractorName('Acme'));
    expect(result.current.selectedContractorId).toBe('c1');
    expect(result.current.selectedContractorName).toBe('Acme');
  });

  it('handleAssign no-ops without a selected contractor', () => {
    const onOpenChange = vi.fn();
    const assignSpy = vi.fn();
    setTRPCMock({
      'contractor.list': () => ({ items: [] }),
      'equipment.assign': assignSpy,
    });
    const { result } = renderHookWithProviders(() =>
      useAssignmentDialog({ equipmentId: 'eq1', onOpenChange }),
    );
    act(() => result.current.handleAssign());
    expect(assignSpy).not.toHaveBeenCalled();
  });

  it('handleAssign invokes the assign mutation and closes the dialog on success', async () => {
    toastSuccess.mockClear();
    const onOpenChange = vi.fn();
    setTRPCMock({
      'contractor.list': () => ({ items: [{ id: 'c1', displayName: 'Acme', legalName: 'Acme' }] }),
      'equipment.assign': () => ({ id: 'a1' }),
    });
    const { result } = renderHookWithProviders(() =>
      useAssignmentDialog({ equipmentId: 'eq1', onOpenChange }),
    );
    act(() => result.current.setSelectedContractorId('c1'));
    act(() => result.current.setSelectedContractorName('Acme'));
    act(() => result.current.handleAssign());
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(result.current.selectedContractorId).toBeNull();
  });

  it('handleOpenChange(false) resets selection state', () => {
    const onOpenChange = vi.fn();
    setTRPCMock({
      'contractor.list': () => ({ items: [] }),
    });
    const { result } = renderHookWithProviders(() =>
      useAssignmentDialog({ equipmentId: 'eq1', onOpenChange }),
    );
    act(() => result.current.setSelectedContractorId('c1'));
    act(() => result.current.setSelectedContractorName('Acme'));
    act(() => result.current.handleOpenChange(false));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(result.current.selectedContractorId).toBeNull();
    expect(result.current.selectedContractorName).toBe('');
    expect(result.current.search).toBe('');
  });
});
