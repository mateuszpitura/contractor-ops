'use client';

import { Rows2, Rows3 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { cn } from '../../lib/utils.js';
import { Button } from '../shadcn/button.js';

const STORAGE_KEY = 'workbench-density';
const BODY_CLASS = 'density-compact';

export type DensityMode = 'comfortable' | 'compact';

export interface DensityToggleProps {
  /** Optional translated labels for accessible name + tooltip. */
  labels?: { comfortable: string; compact: string };
  className?: string;
}

/**
 * Two-state density toggle. Persists to `localStorage` and toggles
 * `.density-compact` on `<body>` so global table CSS rules in
 * `globals.css` cascade to every workbench table at once.
 *
 * Hydration: server renders the comfortable icon; client effect
 * reconciles after mount. The visual swap is imperceptible because
 * both icons occupy the same 16×16 box.
 */
export function DensityToggle({ labels, className }: DensityToggleProps) {
  const [density, setDensity] = useState<DensityMode>('comfortable');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === 'compact' || stored === 'comfortable') {
        setDensity(stored);
      }
    } catch {
      // localStorage unavailable (private mode, SSR-only) — silent default.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    document.body.classList.toggle(BODY_CLASS, density === 'compact');
    try {
      window.localStorage.setItem(STORAGE_KEY, density);
    } catch {
      // ignore quota / unavailable storage
    }
  }, [density, hydrated]);

  const isCompact = density === 'compact';
  const nextLabel =
    labels?.[isCompact ? 'comfortable' : 'compact'] ??
    (isCompact ? 'Comfortable density' : 'Compact density');

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      // biome-ignore lint/nursery/noJsxPropsBind: simple state toggle
      onClick={() => setDensity(isCompact ? 'comfortable' : 'compact')}
      aria-label={nextLabel}
      title={nextLabel}
      aria-pressed={isCompact}
      className={cn('h-8 w-8 text-muted-foreground hover:text-foreground', className)}>
      {isCompact ? <Rows2 className="h-4 w-4" /> : <Rows3 className="h-4 w-4" />}
    </Button>
  );
}
