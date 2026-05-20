'use client';

import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { CommandItem } from '@contractor-ops/ui/components/shadcn/command';
import { ArrowRight, Clock, Play, Plus, Star, Upload } from 'lucide-react';
import { useCallback } from 'react';
import { ConfluenceIcon, NotionIcon } from '@/components/integrations/provider-icons';
import type { navigationItems } from '@/lib/navigation';
import type { RecentItem } from './search-provider';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type PinnedItem = { type: string; id: string; name: string };

export type SearchResultItem = {
  id: string;
  name: string;
  subtitle: string;
  type: 'contractor' | 'contract' | 'invoice';
};

export type DocSearchResultItem = {
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

export const TYPE_BADGE_CLASSES: Record<string, string> = {
  contractor: 'bg-primary/10 text-primary border-transparent',
  contract: 'bg-chart-2/10 text-chart-2 border-transparent',
  invoice: 'bg-warning/10 text-warning border-transparent',
  doc: 'bg-chart-3/10 text-chart-3 border-transparent',
};

// ---------------------------------------------------------------------------
// Quick actions
// ---------------------------------------------------------------------------

export const QUICK_ACTIONS = [
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

export function formatRelativeTimeData(timestamp: number): {
  key: string;
  params?: Record<string, number>;
} {
  const diff = Math.floor((Date.now() - timestamp) / 1000);
  if (diff < 60) return { key: 'justNow' };
  if (diff < 3600) return { key: 'minutesAgo', params: { minutes: Math.floor(diff / 60) } };
  if (diff < 86400) return { key: 'hoursAgo', params: { hours: Math.floor(diff / 3600) } };
  return { key: 'daysAgo', params: { days: Math.floor(diff / 86400) } };
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

// ---------------------------------------------------------------------------
// Sub-components (stable onSelect/onClick — avoids inline arrows in .map())
// ---------------------------------------------------------------------------

export function RecentCommandItem({
  item,
  onSelect,
  tTime,
}: {
  item: RecentItem;
  onSelect: (item: RecentItem) => void;
  tTime: (key: string, params?: Record<string, number>) => string;
}) {
  const handleSelect = useCallback(() => onSelect(item), [onSelect, item]);
  const { key, params } = formatRelativeTimeData(item.viewedAt);

  return (
    <CommandItem key={`recent-${item.type}-${item.id}`} onSelect={handleSelect}>
      <Clock className="h-4 w-4 text-muted-foreground" />
      <span className="flex-1 truncate text-sm font-medium">{item.name}</span>
      {item.type === 'page' ? null : (
        <Badge variant="secondary" className={TYPE_BADGE_CLASSES[item.type] ?? ''}>
          {item.type}
        </Badge>
      )}
      <span className="text-xs text-muted-foreground">{tTime(key, params)}</span>
    </CommandItem>
  );
}

export function PinnedCommandItem({
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

export function QuickActionCommandItem({
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

export function PageNavigationCommandItem({
  item,
  navigate,
  addRecentItem,
}: {
  item: (typeof navigationItems)[number];
  navigate: (href: string) => void;
  addRecentItem: (item: Omit<RecentItem, 'viewedAt'>) => void;
}) {
  const handleSelect = useCallback(() => {
    addRecentItem({
      id: item.href,
      type: 'page',
      name: item.label,
    });
    navigate(item.href);
  }, [addRecentItem, navigate, item.href, item.label]);

  return (
    <CommandItem key={`page-${item.key}`} onSelect={handleSelect}>
      <item.icon className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm">{item.label}</span>
    </CommandItem>
  );
}

export function SearchResultCommandItem({
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

export function DocResultCommandItem({ result }: { result: DocSearchResultItem }) {
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

export function MatchedPageCommandItem({
  item,
  navigate,
}: {
  item: (typeof navigationItems)[number];
  navigate: (href: string) => void;
}) {
  const handleSelect = useCallback(() => navigate(item.href), [navigate, item.href]);

  return (
    <CommandItem key={`page-${item.key}`} onSelect={handleSelect}>
      <ArrowRight className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm">{item.label}</span>
    </CommandItem>
  );
}
