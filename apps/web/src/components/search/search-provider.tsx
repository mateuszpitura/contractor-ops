'use client';

import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RecentItem = {
  id: string;
  type: 'contractor' | 'contract' | 'invoice' | 'page';
  name: string;
  viewedAt: number;
};

type SearchContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  recentItems: RecentItem[];
  addRecentItem: (item: Omit<RecentItem, 'viewedAt'>) => void;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'contractor-ops:recent-items';
const MAX_RECENT = 8;

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const SearchContext = createContext<SearchContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

function readRecent(): RecentItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, MAX_RECENT) as RecentItem[];
  } catch {
    return [];
  }
}

function writeRecent(items: RecentItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Storage full or unavailable - silently ignore
  }
}

export function SearchProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);

  // Hydrate from localStorage on mount
  useEffect(() => {
    setRecentItems(readRecent());
  }, []);

  // Global Cmd+K / Ctrl+K listener
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const addRecentItem = useCallback((item: Omit<RecentItem, 'viewedAt'>) => {
    setRecentItems(prev => {
      const deduped = prev.filter(r => !(r.type === item.type && r.id === item.id));
      const next = [{ ...item, viewedAt: Date.now() }, ...deduped].slice(0, MAX_RECENT);
      writeRecent(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ open, setOpen, recentItems, addRecentItem }),
    [open, recentItems, addRecentItem],
  );

  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSearch(): SearchContextValue {
  const ctx = useContext(SearchContext);
  if (!ctx) {
    throw new Error('useSearch must be used within a SearchProvider');
  }
  return ctx;
}
