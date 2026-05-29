/**
 * Reui-style command palette wrapper around shadcn's cmdk primitive.
 *
 * Stands in for `@reui/command` since reui.io currently exposes no
 * `/r/command.json` payload (probed 2026-05-26). API surface mirrors the
 * patterns reui blocks ship for command menus: a controlled dialog plus
 * a grouped item list.
 */
import * as React from 'react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '../shadcn/command.js';

export interface CommandPaletteItem {
  id: string;
  label: string;
  group: string;
  shortcut?: string;
  onSelect: () => void;
}

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: readonly CommandPaletteItem[];
  placeholder?: string;
  emptyLabel?: string;
}

export function CommandPalette({
  open,
  onOpenChange,
  items,
  placeholder = 'Search...',
  emptyLabel = 'No results.',
}: CommandPaletteProps) {
  const grouped = React.useMemo(() => {
    const out = new Map<string, CommandPaletteItem[]>();
    for (const item of items) {
      const list = out.get(item.group) ?? [];
      list.push(item);
      out.set(item.group, list);
    }
    return Array.from(out.entries());
  }, [items]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder={placeholder} />
      <CommandList>
        <CommandEmpty>{emptyLabel}</CommandEmpty>
        {grouped.map(([group, groupItems], idx) => (
          <React.Fragment key={group}>
            {idx > 0 ? <CommandSeparator /> : null}
            <CommandGroup heading={group}>
              {groupItems.map(item => (
                <CommandPaletteRow key={item.id} item={item} onOpenChange={onOpenChange} />
              ))}
            </CommandGroup>
          </React.Fragment>
        ))}
      </CommandList>
    </CommandDialog>
  );
}

interface CommandPaletteRowProps {
  item: CommandPaletteItem;
  onOpenChange: (open: boolean) => void;
}

const CommandPaletteRow = React.memo(function CommandPaletteRow({
  item,
  onOpenChange,
}: CommandPaletteRowProps) {
  const handleSelect = React.useCallback(() => {
    item.onSelect();
    onOpenChange(false);
  }, [item, onOpenChange]);
  return (
    <CommandItem value={item.label} onSelect={handleSelect}>
      <span>{item.label}</span>
      {item.shortcut ? <CommandShortcut>{item.shortcut}</CommandShortcut> : null}
    </CommandItem>
  );
});
