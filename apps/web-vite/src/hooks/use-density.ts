/**
 * Information-density preference store.
 *
 * Persisted to localStorage AND mirrored to a `density` cookie so the
 * SPA's index.html prelude script can apply the class before first paint
 * and avoid a layout-shift FOUC for returning users.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Density = 'comfortable' | 'compact';

interface DensityState {
  density: Density;
  setDensity: (density: Density) => void;
  toggleDensity: () => void;
}

const DENSITY_COOKIE_ATTRS = 'path=/; max-age=31536000; samesite=lax';

function writeDensityCookie(value: Density): void {
  if (typeof document === 'undefined') return;
  document.cookie = `density=${value}; ${DENSITY_COOKIE_ATTRS}`;
}

function readDensityCookie(): string | undefined {
  if (typeof document === 'undefined') return;
  const parts = document.cookie.split('; ');
  for (const part of parts) {
    if (part.startsWith('density=')) {
      return part.slice('density='.length);
    }
  }
  return;
}

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
          writeDensityCookie(density);
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
        if (state?.density === 'compact' && typeof document !== 'undefined') {
          document.documentElement.classList.add('density-compact');
        }
        if (state?.density && typeof document !== 'undefined' && !readDensityCookie()) {
          writeDensityCookie(state.density);
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
