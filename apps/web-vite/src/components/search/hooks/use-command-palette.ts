/**
 * `useCommandPalette` — composition hook for the global command palette
 * (`Cmd/Ctrl + K`). Owns the debounced query, persisted pinned items
 * (`localStorage`), derived "matched pages / matched actions" lists, and
 * navigation callbacks. Returns a props bag the presentational view
 * (`CommandPaletteView`) consumes verbatim — no React Query, no
 * `useTRPC`, and no `useState` in the leaf component.
 *
 * Sources:
 *   - `useSearch` (recent items + open state) — context, no tRPC.
 *   - `useCommandPaletteSearch` — the only tRPC boundary (entity + doc
 *     search). Returns `{ searchResults, docResults, isSearching, isLoading,
 *     isDocLoading }`.
 *   - `useFlagBag` — gates jurisdiction-locked nav items.
 *
 * Pinned items live in `localStorage` (not session) — they're user
 * preferences, not PII. The recent-items list (PII) stays in
 * `sessionStorage` inside `SearchProvider`.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useRouter } from '../../../i18n/navigation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { navigationItems } from '../../../lib/navigation.js';
import { useFlagBag } from '../../layout/feature-flag-context.js';
import type { RecentItem } from '../search-provider.js';
import { useSearch } from '../search-provider.js';
import type { DocSearchResultItem, SearchResultItem } from './use-command-palette-search.js';
import { useCommandPaletteSearch } from './use-command-palette-search.js';

const DEBOUNCE_MS = 200;
const PINNED_STORAGE_KEY = 'contractor-ops:pinned-items';

export type PinnedItem = { type: string; id: string; name: string };

export type QuickAction = {
  key: string;
  labelKey:
    | 'actions.newContractor'
    | 'actions.newContract'
    | 'actions.uploadInvoice'
    | 'actions.startWorkflow';
  href: string;
  iconKey: 'plus' | 'upload' | 'play';
};

export const QUICK_ACTIONS: readonly QuickAction[] = [
  {
    key: 'new-contractor',
    labelKey: 'actions.newContractor',
    href: '/contractors?action=new',
    iconKey: 'plus',
  },
  {
    key: 'new-contract',
    labelKey: 'actions.newContract',
    href: '/contracts?action=new',
    iconKey: 'plus',
  },
  {
    key: 'upload-invoice',
    labelKey: 'actions.uploadInvoice',
    href: '/invoices?action=upload',
    iconKey: 'upload',
  },
  {
    key: 'start-workflow',
    labelKey: 'actions.startWorkflow',
    href: '/workflows?action=start',
    iconKey: 'play',
  },
] as const;

function readPinned(): PinnedItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PINNED_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PinnedItem[]) : [];
  } catch {
    return [];
  }
}

function writePinned(items: PinnedItem[]): void {
  try {
    localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Storage full or unavailable — silently ignore (best-effort persistence).
  }
}

export function entityDetailUrl(type: string, id: string): string {
  switch (type) {
    case 'contractor':
      return `/contractors/${id}`;
    case 'contract':
      return `/contracts/${id}`;
    case 'invoice':
      return `/invoices/${id}`;
    default:
      return '/';
  }
}

export interface CommandPaletteViewModel {
  open: boolean;
  setOpen: (open: boolean) => void;
  query: string;
  onQueryChange: (value: string) => void;
  searchResults: SearchResultItem[];
  docResults: DocSearchResultItem[];
  isSearching: boolean;
  isLoading: boolean;
  isDocLoading: boolean;
  recentItems: RecentItem[];
  pinnedItems: PinnedItem[];
  visibleNavItems: typeof navigationItems;
  matchedPages: typeof navigationItems;
  matchedActions: readonly QuickAction[];
  quickActions: readonly QuickAction[];
  onRecentSelect: (item: RecentItem) => void;
  onEntityClick: (item: SearchResultItem) => void;
  onPageNavigate: (item: (typeof navigationItems)[number], label: string) => void;
  onNavigate: (href: string) => void;
  togglePin: (item: PinnedItem) => void;
  isPinned: (type: string, id: string) => boolean;
}

export function useCommandPalette(): CommandPaletteViewModel {
  const { open, setOpen, recentItems, addRecentItem } = useSearch();
  const router = useRouter();
  const flagBag = useFlagBag();
  const tNav = useTranslations('Navigation');

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [pinnedItems, setPinnedItems] = useState<PinnedItem[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setDebouncedQuery('');
    }
  }, [open]);

  useEffect(() => {
    setPinnedItems(readPinned());
  }, []);

  const { searchResults, docResults, isSearching, isLoading, isDocLoading } =
    useCommandPaletteSearch(debouncedQuery, open);

  const visibleNavItems = useMemo(
    () => navigationItems.filter(item => !item.flag || flagBag[item.flag]),
    [flagBag],
  );

  const matchedPages = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) return [] as typeof navigationItems;
    const q = trimmed.toLowerCase();
    return visibleNavItems.filter(
      item => tNav(item.key).toLowerCase().includes(q) || item.label.toLowerCase().includes(q),
    );
  }, [query, tNav, visibleNavItems]);

  const tSearch = useTranslations('Search');
  const matchedActions = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) return QUICK_ACTIONS.slice();
    const q = trimmed.toLowerCase();
    return QUICK_ACTIONS.filter(a => tSearch(a.labelKey).toLowerCase().includes(q));
  }, [query, tSearch]);

  const onNavigate = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router, setOpen],
  );

  const onEntityClick = useCallback(
    (item: SearchResultItem) => {
      addRecentItem({ id: item.id, type: item.type, name: item.name });
      onNavigate(entityDetailUrl(item.type, item.id));
    },
    [addRecentItem, onNavigate],
  );

  const onRecentSelect = useCallback(
    (item: RecentItem) => {
      if (item.type === 'page') {
        onNavigate(item.id);
        return;
      }
      addRecentItem({ id: item.id, type: item.type, name: item.name });
      onNavigate(entityDetailUrl(item.type, item.id));
    },
    [addRecentItem, onNavigate],
  );

  const onPageNavigate = useCallback(
    (item: (typeof navigationItems)[number], label: string) => {
      addRecentItem({ id: item.href, type: 'page', name: label });
      onNavigate(item.href);
    },
    [addRecentItem, onNavigate],
  );

  const togglePin = useCallback((item: PinnedItem) => {
    setPinnedItems(prev => {
      const exists = prev.some(p => p.type === item.type && p.id === item.id);
      const next = exists
        ? prev.filter(p => !(p.type === item.type && p.id === item.id))
        : [...prev, item];
      writePinned(next);
      return next;
    });
  }, []);

  const isPinned = useCallback(
    (type: string, id: string) => pinnedItems.some(p => p.type === type && p.id === id),
    [pinnedItems],
  );

  return {
    open,
    setOpen,
    query,
    onQueryChange: setQuery,
    searchResults,
    docResults,
    isSearching,
    isLoading,
    isDocLoading,
    recentItems,
    pinnedItems,
    visibleNavItems,
    matchedPages,
    matchedActions,
    quickActions: QUICK_ACTIONS,
    onRecentSelect,
    onEntityClick,
    onPageNavigate,
    onNavigate,
    togglePin,
    isPinned,
  };
}
