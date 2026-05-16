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
 * Cookie attributes mirroring the theme cookie's contract — see
 * `apps/web/src/components/theme/theme-cookie-sync.tsx` for the rationale on
 * each flag. Kept inline (rather than imported) so the zustand store has no
 * cross-package dependency on React component code.
 */
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

/**
 * Zustand store for information density preference.
 * Persisted to localStorage AND mirrored to a `density` cookie so the Server
 * Component reader in `apps/web/src/lib/get-theme-attributes.ts` can emit
 * `density-compact` on the SSR `<html>` and avoid a layout-shift FOUC for
 * returning users. Applied via CSS class "density-compact" on <html>.
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
          // Mirror to cookie so SSR theme reader picks it up on next request.
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
        // Sync DOM class on rehydration
        if (state?.density === 'compact' && typeof document !== 'undefined') {
          document.documentElement.classList.add('density-compact');
        }
        // One-time migration: existing users only have a localStorage entry
        // from before cookie mirroring landed. Seed the cookie if it's
        // missing so the SSR theme reader works on the very next request.
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
