'use client';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@contractor-ops/ui/components/shadcn/popover';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@contractor-ops/ui/components/shadcn/tabs';
import { cn } from '@contractor-ops/ui/lib/utils';
import { Bell, CheckCircle2 } from 'lucide-react';
import { useMemo, useState } from 'react';

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  unread: boolean;
  timestamp: string;
  href?: string;
}

interface NotificationsPopoverProps {
  initialItems?: ReadonlyArray<NotificationItem>;
}

const FALLBACK_ITEMS: ReadonlyArray<NotificationItem> = [
  {
    id: 'inv-1',
    title: 'New invoice awaiting approval',
    body: 'Helix Studios · €1,420 · due in 3 days.',
    unread: true,
    timestamp: '2 min ago',
    href: '/invoices?status=awaiting-approval',
  },
  {
    id: 'cnt-1',
    title: 'Contract expires next week',
    body: 'Nordweg GmbH MSA expires on Friday.',
    unread: true,
    timestamp: '1 h ago',
    href: '/contracts?expiring=true',
  },
  {
    id: 'pay-1',
    title: 'Payment run sent',
    body: 'EUR run · 32 invoices · €48,210.',
    unread: false,
    timestamp: 'Yesterday',
    href: '/payments/runs',
  },
];

export function NotificationsPopover({ initialItems = FALLBACK_ITEMS }: NotificationsPopoverProps) {
  const [items, setItems] = useState(initialItems);
  const unreadCount = useMemo(() => items.filter(i => i.unread).length, [items]);

  const markAllRead = () => setItems(items.map(i => ({ ...i, unread: false })));

  return (
    <Popover>
      <PopoverTrigger
        aria-label="Notifications"
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-background/60 text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground">
        <Bell aria-hidden className="size-4" />
        {unreadCount > 0 ? (
          <span
            aria-label={`${unreadCount} unread`}
            className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
            {unreadCount}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent className="w-[22rem] p-0" align="end">
        <header className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <h3 className="text-sm font-semibold">Notifications</h3>
          <button
            type="button"
            onClick={markAllRead}
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
            <CheckCircle2 aria-hidden className="size-3.5" />
            Mark all read
          </button>
        </header>
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid grid-cols-2 rounded-none border-b border-border/40 bg-transparent">
            <TabsTrigger value="all" className="rounded-none">
              All
            </TabsTrigger>
            <TabsTrigger value="unread" className="rounded-none">
              Unread {unreadCount > 0 ? `(${unreadCount})` : ''}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="all" className="mt-0">
            <NotificationList items={items} />
          </TabsContent>
          <TabsContent value="unread" className="mt-0">
            <NotificationList items={items.filter(i => i.unread)} />
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}

function NotificationList({ items }: { items: ReadonlyArray<NotificationItem> }) {
  if (items.length === 0) {
    return <p className="px-4 py-6 text-center text-sm text-muted-foreground">All caught up.</p>;
  }
  return (
    <ul className="max-h-[26rem] divide-y divide-border/40 overflow-y-auto">
      {items.map(item => (
        <li key={item.id}>
          <a
            href={item.href ?? '#'}
            className={cn(
              'block px-4 py-3 transition-colors hover:bg-muted/40',
              item.unread && 'bg-primary/[0.03]',
            )}>
            <div className="flex items-baseline gap-2">
              {item.unread ? (
                <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-primary" />
              ) : null}
              <p className="text-sm font-medium text-foreground">{item.title}</p>
              <span className="ms-auto shrink-0 text-[11px] text-muted-foreground">
                {item.timestamp}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.body}</p>
          </a>
        </li>
      ))}
    </ul>
  );
}
