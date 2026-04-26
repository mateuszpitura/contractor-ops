'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Density = 'comfortable' | 'compact';

interface DensityState {
  density: Density;
  setDensity: (density: Density) => void;
  toggleDensity: () => void;
}

/**
 * Zustand store for information density preference.
 * Persisted to localStorage. Applied via CSS class "density-compact" on <html>.
 */
const useDensityStore = create<DensityState>()(
  persist(
    (set, get) => ({
      density: 'comfortable',
      setDensity: (density: Density) => {
        set({ density });
        if (typeof document !== 'undefined') {
          if (density === 'compact') {
            document.documentElement.classList.add('density-compact');
          } else {
            document.documentElement.classList.remove('density-compact');
          }
        }
      },
      toggleDensity: () => {
        const current = get().density;
        const next = current === 'comfortable' ? 'compact' : 'comfortable';
        get().setDensity(next);
      },
    }),
    {
      name: 'density',
      onRehydrateStorage: () => state => {
        // Sync DOM class on rehydration
        if (state?.density === 'compact' && typeof document !== 'undefined') {
          document.documentElement.classList.add('density-compact');
        }
      },
    },
  ),
);

export function useDensity() {
  const density = useDensityStore(s => s.density);
  const setDensity = useDensityStore(s => s.setDensity);
  const toggleDensity = useDensityStore(s => s.toggleDensity);
  return { density, setDensity, toggleDensity };
}
