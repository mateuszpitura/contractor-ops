import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

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

const STORAGE_KEY = 'contractor-ops:recent-items';
const MAX_RECENT = 8;

const SearchContext = createContext<SearchContextValue | null>(null);

// `sessionStorage` (not `localStorage`) so the cached entity names
// (contractor / contract / invoice display names — PII) do not survive a
// tab close. On a shared device the next user's session starts with an
// empty recent list instead of inheriting the previous operator's view
// history.
function readRecent(): RecentItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
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
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    // safe-swallow: best-effort recent-items persistence; storage full/unavailable is non-fatal
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

export function SearchProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);

  useEffect(() => {
    setRecentItems(readRecent());
  }, []);

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

export function useSearch(): SearchContextValue {
  const ctx = useContext(SearchContext);
  if (!ctx) {
    throw new Error('useSearch must be used within a SearchProvider');
  }
  return ctx;
}
