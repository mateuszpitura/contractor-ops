import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@contractor-ops/ui/components/shadcn/command';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { ArrowRight, Clock, Play, Plus, Star, Upload } from 'lucide-react';
import { useCallback } from 'react';
import type { LooseTranslator } from '../../i18n/typed-keys.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import type { navigationItems } from '../../lib/navigation.js';
import { ConfluenceIcon, NotionIcon } from '../integrations/provider-icons.js';
import type {
  CommandPaletteViewModel,
  PinnedItem,
  QuickAction,
} from './hooks/use-command-palette.js';
import type { DocSearchResultItem, SearchResultItem } from './hooks/use-command-palette-search.js';
import type { RecentItem } from './search-provider.js';

const TYPE_BADGE_CLASSES: Record<string, string> = {
  contractor: 'bg-primary/10 text-primary border-transparent',
  contract: 'bg-chart-2/10 text-chart-2 border-transparent',
  invoice: 'bg-warning/10 text-warning border-transparent',
  doc: 'bg-chart-3/10 text-chart-3 border-transparent',
};

const QUICK_ACTION_ICON = {
  plus: Plus,
  upload: Upload,
  play: Play,
} as const;

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
      <span className="text-xs text-muted-foreground">{tTime(key, params)}</span>
    </CommandItem>
  );
}

function PinnedCommandItem({
  item,
  onNavigate,
}: {
  item: PinnedItem;
  onNavigate: (href: string) => void;
}) {
  const handleSelect = useCallback(() => {
    const href =
      item.type === 'contractor'
        ? `/contractors/${item.id}`
        : item.type === 'contract'
          ? `/contracts/${item.id}`
          : item.type === 'invoice'
            ? `/invoices/${item.id}`
            : '/';
    onNavigate(href);
  }, [onNavigate, item.type, item.id]);

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
  onNavigate,
  label,
}: {
  action: QuickAction;
  onNavigate: (href: string) => void;
  label: string;
}) {
  const Icon = QUICK_ACTION_ICON[action.iconKey];
  const handleSelect = useCallback(() => onNavigate(action.href), [onNavigate, action.href]);

  return (
    <CommandItem key={action.key} onSelect={handleSelect}>
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm">{label}</span>
    </CommandItem>
  );
}

function PageNavigationCommandItem({
  item,
  label,
  onPageNavigate,
}: {
  item: (typeof navigationItems)[number];
  label: string;
  onPageNavigate: (item: (typeof navigationItems)[number], label: string) => void;
}) {
  const handleSelect = useCallback(
    () => onPageNavigate(item, label),
    [onPageNavigate, item, label],
  );

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
  togglePin: (item: PinnedItem) => void;
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
  onNavigate,
}: {
  item: (typeof navigationItems)[number];
  label: string;
  onNavigate: (href: string) => void;
}) {
  const handleSelect = useCallback(() => onNavigate(item.href), [onNavigate, item.href]);

  return (
    <CommandItem key={`page-${item.key}`} onSelect={handleSelect}>
      <ArrowRight className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm">{label}</span>
    </CommandItem>
  );
}

export type CommandPaletteViewProps = CommandPaletteViewModel;

export function CommandPaletteView({
  open,
  setOpen,
  query,
  onQueryChange,
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
  quickActions,
  onRecentSelect,
  onEntityClick,
  onPageNavigate,
  onNavigate,
  togglePin,
  isPinned,
}: CommandPaletteViewProps) {
  const t = useTranslations('Search');
  const tTime = useTranslations('Search.time');
  const tNav = useTranslations('Navigation');

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title={t('commandPaletteTitle')}
      description={t('commandPaletteDescription')}
      className="w-[560px]"
      shouldFilter={!isSearching}>
      <CommandInput placeholder={t('placeholder')} value={query} onValueChange={onQueryChange} />
      {isSearching && !isLoading && (
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {searchResults.length > 0
            ? t('resultsFound', { count: searchResults.length })
            : t('noResultsFound')}
        </div>
      )}
      <CommandList>
        <CommandEmpty>{t('noResults')}</CommandEmpty>

        {!!isLoading && (
          <div className="space-y-2 p-2">
            {Array.from({ length: 4 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
              <Skeleton key={`skel-${i}`} className="h-8 w-full rounded-md" />
            ))}
          </div>
        )}

        {!(isSearching || isLoading) && (
          <>
            {recentItems.length > 0 && (
              <CommandGroup heading={t('sections.recent')}>
                {recentItems.map(item => (
                  <RecentCommandItem
                    key={`recent-${item.type}-${item.id}`}
                    item={item}
                    onSelect={onRecentSelect}
                    tTime={tTime}
                  />
                ))}
              </CommandGroup>
            )}

            {pinnedItems.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading={t('sections.pinned')}>
                  {pinnedItems.map(item => (
                    <PinnedCommandItem
                      key={`pinned-${item.type}-${item.id}`}
                      item={item}
                      onNavigate={onNavigate}
                    />
                  ))}
                </CommandGroup>
              </>
            )}

            <CommandSeparator />
            <CommandGroup heading={t('sections.actions')}>
              {quickActions.map(action => (
                <QuickActionCommandItem
                  key={action.key}
                  action={action}
                  onNavigate={onNavigate}
                  label={t(action.labelKey)}
                />
              ))}
            </CommandGroup>

            <CommandSeparator />
            <CommandGroup heading={t('sections.pages')}>
              {visibleNavItems.map(item => (
                <PageNavigationCommandItem
                  key={`page-${item.key}`}
                  item={item}
                  label={tNav(item.key)}
                  onPageNavigate={onPageNavigate}
                />
              ))}
            </CommandGroup>
          </>
        )}

        {isSearching && !isLoading && (
          <>
            {searchResults.length > 0 && (
              <CommandGroup heading={t('sections.results')}>
                {searchResults.map(item => (
                  <SearchResultCommandItem
                    key={`result-${item.type}-${item.id}`}
                    item={item}
                    onEntityClick={onEntityClick}
                    togglePin={togglePin}
                    isPinned={isPinned(item.type, item.id)}
                    pinLabel={t('pin')}
                    unpinLabel={t('unpin')}
                  />
                ))}
              </CommandGroup>
            )}

            {!!isDocLoading && (
              <CommandGroup heading="Docs">
                <div className="space-y-2 p-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
                    <Skeleton key={`skel-${i}`} className="h-8 w-full rounded-md" />
                  ))}
                </div>
              </CommandGroup>
            )}
            {!isDocLoading && docResults.length > 0 && (
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

            {matchedPages.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading={t('sections.pages')}>
                  {matchedPages.map(item => (
                    <MatchedPageCommandItem
                      key={`page-${item.key}`}
                      item={item}
                      label={tNav(item.key)}
                      onNavigate={onNavigate}
                    />
                  ))}
                </CommandGroup>
              </>
            )}

            {matchedActions.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading={t('sections.actions')}>
                  {matchedActions.map(action => (
                    <QuickActionCommandItem
                      key={action.key}
                      action={action}
                      onNavigate={onNavigate}
                      label={t(action.labelKey)}
                    />
                  ))}
                </CommandGroup>
              </>
            )}
          </>
        )}
      </CommandList>

      <div className="flex items-center gap-4 border-t border-border/40 px-3 py-2">
        <span className="text-xs font-mono text-muted-foreground/70">{t('footer.select')}</span>
        <span className="text-xs font-mono text-muted-foreground/70">{t('footer.navigate')}</span>
        <span className="text-xs font-mono text-muted-foreground/70">{t('footer.close')}</span>
      </div>
    </CommandDialog>
  );
}
