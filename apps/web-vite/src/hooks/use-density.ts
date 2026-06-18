/**
 * Information-density preference store.
 *
 * Persisted to localStorage AND mirrored to a `density` cookie so the
 * SPA's index.html prelude script can apply the class before first paint
 * and avoid a layout-shift FOUC for returning users.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getCookie, setCookie } from '../lib/cookies.js';

type Density = 'comfortable' | 'compact';

interface DensityState {
  density: Density;
  setDensity: (density: Density) => void;
  toggleDensity: () => void;
}

const DENSITY_COOKIE_NAME = 'density';
const DENSITY_COOKIE_MAX_AGE = 31536000;

function writeDensityCookie(value: Density): void {
  setCookie(DENSITY_COOKIE_NAME, value, { maxAge: DENSITY_COOKIE_MAX_AGE });
}

function readDensityCookie(): string | undefined {
  return getCookie(DENSITY_COOKIE_NAME);
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
