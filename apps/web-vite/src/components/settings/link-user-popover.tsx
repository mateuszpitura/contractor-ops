import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@contractor-ops/ui/components/shadcn/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@contractor-ops/ui/components/shadcn/popover';

import type { useLinkUserPopover } from './hooks/use-slack-user-mapping.js';

export type LinkUserPopoverProps = {
  userId: string;
  onLinked: () => void;
} & ReturnType<typeof useLinkUserPopover>;

export function LinkUserPopover({
  t,
  open,
  setOpen,
  search,
  setSearch,
  handleSelect,
  isLinkPending,
}: LinkUserPopoverProps) {
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="ghost" size="sm" type="button" />}>
        {t('integrations.userMapping.linkUser')}
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t('integrations.userMapping.searchPlaceholder')}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>
              {search.length > 0 ? (
                <CommandItem
                  value={search}
                  // biome-ignore lint/nursery/noJsxPropsBind: menu item handler
                  disabled={isLinkPending}
                  onSelect={() => handleSelect(search)}
                  className="cursor-pointer">
                  <span className="text-sm">Link as &quot;{search}&quot;</span>
                </CommandItem>
              ) : (
                <span className="text-sm text-muted-foreground p-2">
                  {t('integrations.userMapping.searchPlaceholder')}
                </span>
              )}
            </CommandEmpty>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
