"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Plus,
  Upload,
  Play,
  Star,
  Clock,
} from "lucide-react";

import { trpc } from "@/trpc/init";
import { useRouter } from "@/i18n/navigation";
import { navigationItems } from "@/lib/navigation";
import { useSearch, type RecentItem } from "./search-provider";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PINNED_STORAGE_KEY = "contractor-ops:pinned-items";
const DEBOUNCE_MS = 200;

type PinnedItem = { type: string; id: string; name: string };

type SearchResultItem = {
  id: string;
  name: string;
  subtitle: string;
  type: "contractor" | "contract" | "invoice";
};

// ---------------------------------------------------------------------------
// Type badge color mapping (per UI-SPEC)
// ---------------------------------------------------------------------------

const TYPE_BADGE_CLASSES: Record<string, string> = {
  contractor: "bg-primary/10 text-primary border-transparent",
  contract: "bg-chart-2/10 text-chart-2 border-transparent",
  invoice: "bg-warning/10 text-warning border-transparent",
};

// ---------------------------------------------------------------------------
// Quick actions
// ---------------------------------------------------------------------------

const QUICK_ACTIONS = [
  { key: "new-contractor", label: "New contractor", icon: Plus, href: "/contractors?action=new" },
  { key: "new-contract", label: "New contract", icon: Plus, href: "/contracts?action=new" },
  { key: "upload-invoice", label: "Upload invoice", icon: Upload, href: "/invoices?action=upload" },
  { key: "start-workflow", label: "Start workflow", icon: Play, href: "/workflows?action=start" },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readPinned(): PinnedItem[] {
  if (typeof window === "undefined") return [];
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

function formatRelativeTime(timestamp: number): string {
  const diff = Math.floor((Date.now() - timestamp) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function entityDetailUrl(type: string, id: string): string {
  switch (type) {
    case "contractor":
      return `/contractors/${id}`;
    case "contract":
      return `/contracts/${id}`;
    case "invoice":
      return `/invoices/${id}`;
    default:
      return "/";
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CommandPalette() {
  const { open, setOpen, recentItems, addRecentItem } = useSearch();
  const router = useRouter();

  // Input / debounce state
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

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
      setQuery("");
      setDebouncedQuery("");
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

  // Client-side page matching
  const matchedPages = useMemo(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) return [];
    const q = debouncedQuery.toLowerCase();
    return navigationItems.filter((item) =>
      item.label.toLowerCase().includes(q),
    );
  }, [debouncedQuery]);

  // Client-side action matching
  const matchedActions = useMemo(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) return QUICK_ACTIONS.slice();
    const q = debouncedQuery.toLowerCase();
    return QUICK_ACTIONS.filter((a) => a.label.toLowerCase().includes(q));
  }, [debouncedQuery]);

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
      if (item.type === "page") {
        navigate(item.id); // For pages, id stores the href
      } else {
        addRecentItem({ id: item.id, type: item.type, name: item.name });
        navigate(entityDetailUrl(item.type, item.id));
      }
    },
    [addRecentItem, navigate],
  );

  // Pin/unpin toggle
  const togglePin = useCallback(
    (item: { type: string; id: string; name: string }) => {
      setPinnedItems((prev) => {
        const exists = prev.some(
          (p) => p.type === item.type && p.id === item.id,
        );
        const next = exists
          ? prev.filter((p) => !(p.type === item.type && p.id === item.id))
          : [...prev, item];
        writePinned(next);
        return next;
      });
    },
    [],
  );

  const isPinned = useCallback(
    (type: string, id: string) =>
      pinnedItems.some((p) => p.type === type && p.id === id),
    [pinnedItems],
  );

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Command Palette"
      description="Search for contractors, contracts, invoices, or navigate to a page"
      className="w-[560px]"
    >
      <CommandInput
        placeholder="Search or type a command..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No results found</CommandEmpty>

        {/* Loading state */}
        {isLoading && (
          <div className="space-y-2 p-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full rounded-md" />
            ))}
          </div>
        )}

        {/* ----- EMPTY QUERY: Show recent, pinned, actions, pages ----- */}
        {!isSearching && !isLoading && (
          <>
            {/* Recent items */}
            {recentItems.length > 0 && (
              <CommandGroup heading="Recent">
                {recentItems.map((item) => (
                  <CommandItem
                    key={`recent-${item.type}-${item.id}`}
                    onSelect={() => handleRecentClick(item)}
                  >
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 truncate text-sm font-medium">
                      {item.name}
                    </span>
                    {item.type !== "page" && (
                      <Badge
                        variant="secondary"
                        className={TYPE_BADGE_CLASSES[item.type] ?? ""}
                      >
                        {item.type}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeTime(item.viewedAt)}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* Pinned items */}
            {pinnedItems.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Pinned">
                  {pinnedItems.map((item) => (
                    <CommandItem
                      key={`pinned-${item.type}-${item.id}`}
                      onSelect={() =>
                        navigate(entityDetailUrl(item.type, item.id))
                      }
                    >
                      <Star className="h-4 w-4 text-warning" />
                      <span className="flex-1 truncate text-sm font-medium">
                        {item.name}
                      </span>
                      <Badge
                        variant="secondary"
                        className={TYPE_BADGE_CLASSES[item.type] ?? ""}
                      >
                        {item.type}
                      </Badge>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}

            {/* Quick actions */}
            <CommandSeparator />
            <CommandGroup heading="Actions">
              {QUICK_ACTIONS.map((action) => (
                <CommandItem
                  key={action.key}
                  onSelect={() => navigate(action.href)}
                >
                  <action.icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{action.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>

            {/* Page navigation */}
            <CommandSeparator />
            <CommandGroup heading="Pages">
              {navigationItems.map((item) => (
                <CommandItem
                  key={`page-${item.key}`}
                  onSelect={() => {
                    addRecentItem({
                      id: item.href,
                      type: "page",
                      name: item.label,
                    });
                    navigate(item.href);
                  }}
                >
                  <item.icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{item.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* ----- WITH QUERY: Show flat search results ----- */}
        {isSearching && !isLoading && (
          <>
            {/* Entity results from tRPC */}
            {searchResults.length > 0 && (
              <CommandGroup heading="Results">
                {searchResults.map((item) => (
                  <CommandItem
                    key={`result-${item.type}-${item.id}`}
                    onSelect={() => handleEntityClick(item)}
                    className="group"
                  >
                    <Badge
                      variant="secondary"
                      className={TYPE_BADGE_CLASSES[item.type] ?? ""}
                    >
                      {item.type}
                    </Badge>
                    <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
                      <span className="truncate text-sm font-semibold">
                        {item.name}
                      </span>
                      <span className="truncate text-sm text-muted-foreground">
                        {item.subtitle}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePin({
                          type: item.type,
                          id: item.id,
                          name: item.name,
                        });
                      }}
                      aria-label={
                        isPinned(item.type, item.id) ? "Unpin" : "Pin"
                      }
                    >
                      <Star
                        className={`h-4 w-4 ${
                          isPinned(item.type, item.id)
                            ? "fill-warning text-warning"
                            : "text-muted-foreground"
                        }`}
                      />
                    </button>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* Matching pages */}
            {matchedPages.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Pages">
                  {matchedPages.map((item) => (
                    <CommandItem
                      key={`page-${item.key}`}
                      onSelect={() => navigate(item.href)}
                    >
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{item.label}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}

            {/* Matching actions */}
            {matchedActions.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Actions">
                  {matchedActions.map((action) => (
                    <CommandItem
                      key={action.key}
                      onSelect={() => navigate(action.href)}
                    >
                      <action.icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{action.label}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </>
        )}
      </CommandList>

      {/* Footer keyboard hints */}
      <div className="flex items-center gap-4 border-t px-3 py-2">
        <span className="text-xs font-mono text-muted-foreground">
          <kbd className="rounded bg-muted px-1 py-0.5">Enter</kbd> to select
        </span>
        <span className="text-xs font-mono text-muted-foreground">
          <kbd className="rounded bg-muted px-1 py-0.5">Arrow keys</kbd> to
          navigate
        </span>
        <span className="text-xs font-mono text-muted-foreground">
          <kbd className="rounded bg-muted px-1 py-0.5">Esc</kbd> to close
        </span>
      </div>
    </CommandDialog>
  );
}
