/**
 * Contractor list view-mode preference.
 *
 * Arranges the list page's two layers — the insight band (visuals) and the
 * data table — per a per-user mode. Persisted to localStorage (Zustand
 * `persist`, mirroring `hooks/use-density.ts`): the stored value IS the
 * default, so switching the in-page control or the Settings select are the
 * same write. Client-only preference — not a tRPC boundary.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const CONTRACTOR_LIST_VIEW_MODES = [
  'visuals-first',
  'visuals-last',
  'data-oriented',
  'tabbed',
  'single',
] as const;

export type ContractorListViewMode = (typeof CONTRACTOR_LIST_VIEW_MODES)[number];

export const DEFAULT_CONTRACTOR_LIST_VIEW_MODE: ContractorListViewMode = 'visuals-first';

/** Narrow an untrusted Select value (`string | null`) to a known view mode. */
export function isContractorListViewMode(value: unknown): value is ContractorListViewMode {
  return (CONTRACTOR_LIST_VIEW_MODES as readonly string[]).includes(value as string);
}

interface ContractorListViewState {
  mode: ContractorListViewMode;
  setMode: (mode: ContractorListViewMode) => void;
}

const useContractorListViewStore = create<ContractorListViewState>()(
  persist(
    set => ({
      mode: DEFAULT_CONTRACTOR_LIST_VIEW_MODE,
      setMode: (mode: ContractorListViewMode) => set({ mode }),
    }),
    { name: 'contractor-list-view' },
  ),
);

export function useContractorListView() {
  const mode = useContractorListViewStore(s => s.mode);
  const setMode = useContractorListViewStore(s => s.setMode);
  return { mode, setMode };
}
