'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Clock, Play, Plus, Star, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ConfluenceIcon, NotionIcon } from '@/components/integrations/provider-icons';
import { useFlagBag } from '@/components/layout/feature-flag-context';
import { Badge } from '@/components/ui/badge';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from '@/i18n/navigation';
import { navigationItems } from '@/lib/navigation';
import { trpc } from '@/trpc/init';
import type { RecentItem } from './search-provider';
import { useSearch } from './search-provider';
import type { LooseTranslator } from '@/i18n/typed-keys';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PINNED_STORAGE_KEY = 'contractor-ops:pinned-items';
const DEBOUNCE_MS = 200;

type PinnedItem = { type: string; id: string; name: string };

type SearchResultItem = {
  id: string;
  name: string;
  subtitle: string;
  type: 'contractor' | 'contract' | 'invoice';
};

type DocSearchResultItem = {
  id: string;
  title: string;
  icon?: string | null;
  subtitle: string;
  url: string;
  provider: 'notion' | 'confluence';
};

// ---------------------------------------------------------------------------
// Type badge color mapping (per UI-SPEC)
// ---------------------------------------------------------------------------

const TYPE_BADGE_CLASSES: Record<string, string> = {
  contractor: 'bg-primary/10 text-primary border-transparent',
  contract: 'bg-chart-2/10 text-chart-2 border-transparent',
  invoice: 'bg-warning/10 text-warning border-transparent',
  doc: 'bg-chart-3/10 text-chart-3 border-transparent',
};

// ---------------------------------------------------------------------------
// Quick actions
// ---------------------------------------------------------------------------

const QUICK_ACTIONS = [
  {
    key: 'new-contractor',
    labelKey: 'actions.newContractor' as const,
    icon: Plus,
    href: '/contractors?action=new',
  },
  {
    key: 'new-contract',
    labelKey: 'actions.newContract' as const,
    icon: Plus,
    href: '/contracts?action=new',
  },
  {
    key: 'upload-invoice',
    labelKey: 'actions.uploadInvoice' as const,
    icon: Upload,
    href: '/invoices?action=upload',
  },
  {
    key: 'start-workflow',
    labelKey: 'actions.startWorkflow' as const,
    icon: Play,
    href: '/workflows?action=start',
  },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
    // Silently ignore storage errors
  }
}

function formatRelativeTimeData(timestamp: number): {
  key: string;
  params?: Record<string, number>;
} {
  const diff = Math.floor((Date.now() - timestamp) / 1000);
  if (diff < 60) return { key: 'justNow' };
  if (diff < 3600) return { key: 'minutesAgo', params: { minutes: Math.floor(diff / 60) } };
  if (diff < 86400) return { key: 'hoursAgo', params: { hours: Math.floor(diff / 3600) } };
  return { key: 'daysAgo', params: { days: Math.floor(diff / 86400) } };
}

function entityDetailUrl(type: string, id: string): string {
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

// ---------------------------------------------------------------------------
// Sub-components (stable onSelect/onClick — avoids inline arrows in .map())
// ---------------------------------------------------------------------------

function RecentCommandItem({
  item,
  onSelect,
  tTime,
}: {
  item: RecentItem;
  onSelect: (item: RecentItem) => void;
  tTime: LooseTranslator;
}) {
  const handleSelect = useCallback(() => onSelect(item), [onSelect, item]);
  const { key, params } = formatRelativeTimeData(item.viewedAt);

  return (
    <CommandItem key={`recent-${item.type}-${item.id}`} onSelect={handleSelect}>
      <Clock className="h-4 w-4 text-muted-foreground" />
      <span className="flex-1 truncate text-sm font-medium">{item.name}</span>
      {item.type !== 'page' && (
        <Badge variant="secondary" className={TYPE_BADGE_CLASSES[item.type] ?? ''}>
          {item.type}
        </Badge>
      )}
      <span className="text-xs text-muted-foreground">
        {tTime(key, params)}
      </span>
    </CommandItem>
  );
}

function PinnedCommandItem({
  item,
  navigate,
}: {
  item: PinnedItem;
  navigate: (href: string) => void;
}) {
  const handleSelect = useCallback(
    () => navigate(entityDetailUrl(item.type, item.id)),
    [navigate, item.type, item.id],
  );

  return (
    <CommandItem key={`pinned-${item.type}-${item.id}`} onSelect={handleSelect}>
      <Star className="h-4 w-4 text-warning" />
      <span className="flex-1 truncate text-sm font-medium">{item.name}</span>
      <Badge variant="secondary" className={TYPE_BADGE_CLASSES[item.type] ?? ''}>
        {item.type}
      </Badge>
    </CommandItem>
  );
}

function QuickActionCommandItem({
  action,
  navigate,
  label,
}: {
  action: (typeof QUICK_ACTIONS)[number];
  navigate: (href: string) => void;
  label: string;
}) {
  const handleSelect = useCallback(() => navigate(action.href), [navigate, action.href]);

  return (
    <CommandItem key={action.key} onSelect={handleSelect}>
      <action.icon className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm">{label}</span>
    </CommandItem>
  );
}

function PageNavigationCommandItem({
  item,
  label,
  navigate,
  addRecentItem,
}: {
  item: (typeof navigationItems)[number];
  label: string;
  navigate: (href: string) => void;
  addRecentItem: (item: Omit<RecentItem, 'viewedAt'>) => void;
}) {
  const handleSelect = useCallback(() => {
    addRecentItem({
      id: item.href,
      type: 'page',
      name: label,
    });
    navigate(item.href);
  }, [addRecentItem, navigate, item.href, label]);

  return (
    <CommandItem key={`page-${item.key}`} onSelect={handleSelect}>
      <item.icon className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm">{label}</span>
    </CommandItem>
  );
}

function SearchResultCommandItem({
  item,
  onEntityClick,
  togglePin,
  isPinned,
  pinLabel,
  unpinLabel,
}: {
  item: SearchResultItem;
  onEntityClick: (item: SearchResultItem) => void;
  togglePin: (item: { type: string; id: string; name: string }) => void;
  isPinned: boolean;
  pinLabel: string;
  unpinLabel: string;
}) {
  const handleSelect = useCallback(() => onEntityClick(item), [onEntityClick, item]);
  const handlePinClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      togglePin({ type: item.type, id: item.id, name: item.name });
    },
    [togglePin, item.type, item.id, item.name],
  );

  return (
    <CommandItem key={`result-${item.type}-${item.id}`} onSelect={handleSelect} className="group">
      <Badge variant="secondary" className={TYPE_BADGE_CLASSES[item.type] ?? ''}>
        {item.type}
      </Badge>
      <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
        <span className="truncate text-sm font-semibold">{item.name}</span>
        <span className="truncate text-sm text-muted-foreground">{item.subtitle}</span>
      </div>
      <button
        type="button"
        className="opacity-0 transition-opacity group-hover:opacity-100"
        onClick={handlePinClick}
        aria-label={isPinned ? unpinLabel : pinLabel}>
        <Star
          className={`h-4 w-4 ${isPinned ? 'fill-warning text-warning' : 'text-muted-foreground'}`}
        />
      </button>
    </CommandItem>
  );
}

function DocResultCommandItem({ result }: { result: DocSearchResultItem }) {
  const handleSelect = useCallback(() => window.open(result.url, '_blank'), [result.url]);
  const ProviderIcon = result.provider === 'notion' ? NotionIcon : ConfluenceIcon;

  return (
    <CommandItem key={`doc-${result.provider}-${result.id}`} onSelect={handleSelect}>
      <ProviderIcon className="h-3.5 w-3.5 shrink-0" />
      <span className="flex-1 truncate text-sm font-medium">{result.title}</span>
      <span className="text-xs text-muted-foreground shrink-0">{result.subtitle}</span>
      <Badge variant="secondary" className={TYPE_BADGE_CLASSES.doc}>
        doc
      </Badge>
    </CommandItem>
  );
}

function MatchedPageCommandItem({
  item,
  label,
  navigate,
}: {
  item: (typeof navigationItems)[number];
  label: string;
  navigate: (href: string) => void;
}) {
  const handleSelect = useCallback(() => navigate(item.href), [navigate, item.href]);

  return (
    <CommandItem key={`page-${item.key}`} onSelect={handleSelect}>
      <ArrowRight className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm">{label}</span>
    </CommandItem>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CommandPalette() {
  const t = useTranslations('Search');
  const tTime = useTranslations('Search.time');
  const tNav = useTranslations('Navigation');
  const { open, setOpen, recentItems, addRecentItem } = useSearch();
  const router = useRouter();
  const flagBag = useFlagBag();

  // Filter nav items by feature flag (mirrors sidebar logic in nav-items.tsx).
  const visibleNavItems = useMemo(
    () => navigationItems.filter(item => !item.flag || flagBag[item.flag]),
    [flagBag],
  );

  // Input / debounce state
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Pinned items
  const [pinnedItems, setPinnedItems] = useState<PinnedItem[]>([]);

  // Load pinned from localStorage on mount
  useEffect(() => {
    setPinnedItems(readPinned());
  }, []);

  // Debounce query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  // Reset query when dialog closes
  useEffect(() => {
    if (!open) {
      setQuery('');
      setDebouncedQuery('');
    }
  }, [open]);

  // tRPC search query
  const searchQuery = useQuery({
    ...trpc.search.global.queryOptions({ query: debouncedQuery }),
    enabled: debouncedQuery.length >= 2,
  });

  const searchResults = useMemo(() => {
    if (!searchQuery.data) return [];
    return searchQuery.data as SearchResultItem[];
  }, [searchQuery.data]);

  // Doc search query (runs alongside global search)
  const docSearchQuery = useQuery({
    ...trpc.docs.search.queryOptions({ query: debouncedQuery, provider: 'all' }),
    enabled: open && debouncedQuery.length >= 2,
  });

  const docResults = useMemo(() => {
    if (!docSearchQuery.data) return [];
    return (docSearchQuery.data as DocSearchResultItem[]).slice(0, 5);
  }, [docSearchQuery.data]);

  // Client-side page matching (searches both translated and English labels)
  const matchedPages = useMemo(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) return [];
    const q = debouncedQuery.toLowerCase();
    return visibleNavItems.filter(
      item => tNav(item.key).toLowerCase().includes(q) || item.label.toLowerCase().includes(q),
    );
  }, [debouncedQuery, tNav, visibleNavItems]);

  // Client-side action matching
  const matchedActions = useMemo(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) return QUICK_ACTIONS.slice();
    const q = debouncedQuery.toLowerCase();
    return QUICK_ACTIONS.filter(a =>
      t(a.labelKey)
        .toLowerCase()
        .includes(q),
    );
  }, [debouncedQuery, t]);

  const isSearching = debouncedQuery.length >= 2;
  const isLoading = searchQuery.isLoading && isSearching;

  // Navigation handler
  const navigate = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router, setOpen],
  );

  // Entity click handler
  const handleEntityClick = useCallback(
    (item: SearchResultItem) => {
      addRecentItem({ id: item.id, type: item.type, name: item.name });
      navigate(entityDetailUrl(item.type, item.id));
    },
    [addRecentItem, navigate],
  );

  // Recent item click handler
  const handleRecentClick = useCallback(
    (item: RecentItem) => {
      if (item.type === 'page') {
        navigate(item.id); // For pages, id stores the href
      } else {
        addRecentItem({ id: item.id, type: item.type, name: item.name });
        navigate(entityDetailUrl(item.type, item.id));
      }
    },
    [addRecentItem, navigate],
  );

  // Pin/unpin toggle
  const togglePin = useCallback((item: { type: string; id: string; name: string }) => {
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

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title={t('commandPaletteTitle')}
      description={t('commandPaletteDescription')}
      className="w-[560px]"
      shouldFilter={!isSearching}>
      <CommandInput placeholder={t('placeholder')} value={query} onValueChange={setQuery} />
      {/* Live region for screen reader result announcements */}
      {isSearching && !isLoading && (
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {searchResults.length > 0
            ? t('resultsFound', { count: searchResults.length })
            : t('noResultsFound')}
        </div>
      )}
      <CommandList>
        <CommandEmpty>{t('noResults')}</CommandEmpty>

        {/* Loading state */}
        {!!isLoading && (
          <div className="space-y-2 p-2">
            {Array.from({ length: 4 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
              <Skeleton key={`skel-${i}`} className="h-8 w-full rounded-md" />
            ))}
          </div>
        )}

        {/* ----- EMPTY QUERY: Show recent, pinned, actions, pages ----- */}
        {!(isSearching || isLoading) && (
          <>
            {/* Recent items */}
            {recentItems.length > 0 && (
              <CommandGroup heading={t('sections.recent')}>
                {recentItems.map(item => (
                  <RecentCommandItem
                    key={`recent-${item.type}-${item.id}`}
                    item={item}
                    onSelect={handleRecentClick}
                    tTime={tTime}
                  />
                ))}
              </CommandGroup>
            )}

            {/* Pinned items */}
            {pinnedItems.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading={t('sections.pinned')}>
                  {pinnedItems.map(item => (
                    <PinnedCommandItem
                      key={`pinned-${item.type}-${item.id}`}
                      item={item}
                      navigate={navigate}
                    />
                  ))}
                </CommandGroup>
              </>
            )}

            {/* Quick actions */}
            <CommandSeparator />
            <CommandGroup heading={t('sections.actions')}>
              {QUICK_ACTIONS.map(action => (
                <QuickActionCommandItem
                  key={action.key}
                  action={action}
                  navigate={navigate}
                  label={t(action.labelKey)}
                />
              ))}
            </CommandGroup>

            {/* Page navigation */}
            <CommandSeparator />
            <CommandGroup heading={t('sections.pages')}>
              {visibleNavItems.map(item => (
                <PageNavigationCommandItem
                  key={`page-${item.key}`}
                  item={item}
                  label={tNav(item.key)}
                  navigate={navigate}
                  addRecentItem={addRecentItem}
                />
              ))}
            </CommandGroup>
          </>
        )}

        {/* ----- WITH QUERY: Show flat search results ----- */}
        {isSearching && !isLoading && (
          <>
            {/* Entity results from tRPC */}
            {searchResults.length > 0 && (
              <CommandGroup heading={t('sections.results')}>
                {searchResults.map(item => (
                  <SearchResultCommandItem
                    key={`result-${item.type}-${item.id}`}
                    item={item}
                    onEntityClick={handleEntityClick}
                    togglePin={togglePin}
                    isPinned={isPinned(item.type, item.id)}
                    pinLabel={t('pin')}
                    unpinLabel={t('unpin')}
                  />
                ))}
              </CommandGroup>
            )}

            {/* Doc search results */}
            {!!docSearchQuery.isLoading && (
              <CommandGroup heading="Docs">
                <div className="space-y-2 p-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
                    <Skeleton key={`skel-${i}`} className="h-8 w-full rounded-md" />
                  ))}
                </div>
              </CommandGroup>
            )}
            {!docSearchQuery.isLoading && docResults.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Docs">
                  {docResults.map(result => (
                    <DocResultCommandItem
                      key={`doc-${result.provider}-${result.id}`}
                      result={result}
                    />
                  ))}
                </CommandGroup>
              </>
            )}

            {/* Matching pages */}
            {matchedPages.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading={t('sections.pages')}>
                  {matchedPages.map(item => (
                    <MatchedPageCommandItem
                      key={`page-${item.key}`}
                      item={item}
                      label={tNav(item.key)}
                      navigate={navigate}
                    />
                  ))}
                </CommandGroup>
              </>
            )}

            {/* Matching actions */}
            {matchedActions.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading={t('sections.actions')}>
                  {matchedActions.map(action => (
                    <QuickActionCommandItem
                      key={action.key}
                      action={action}
                      navigate={navigate}
                      label={t(action.labelKey)}
                    />
                  ))}
                </CommandGroup>
              </>
            )}
          </>
        )}
      </CommandList>

      {/* Footer keyboard hints */}
      <div className="flex items-center gap-4 border-t border-border/40 px-3 py-2">
        <span className="text-xs font-mono text-muted-foreground/70">{t('footer.select')}</span>
        <span className="text-xs font-mono text-muted-foreground/70">{t('footer.navigate')}</span>
        <span className="text-xs font-mono text-muted-foreground/70">{t('footer.close')}</span>
      </div>
    </CommandDialog>
  );
}
