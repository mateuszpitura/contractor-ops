import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@contractor-ops/ui/components/shadcn/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@contractor-ops/ui/components/shadcn/popover';

import type { useChainEditorUserPicker } from './hooks/use-chain-editor-dialog.js';

export type ChainEditorUserPickerProps = ReturnType<typeof useChainEditorUserPicker>;

export function ChainEditorUserPicker({
  t,
  open,
  setOpen,
  search,
  setSearch,
  selectedUser,
  filteredUsers,
  value: selectedValue,
  handleSelect,
  roleLabels,
}: ChainEditorUserPickerProps) {
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start font-normal"
            type="button"
          />
        }>
        {selectedUser ? (
          <span className="truncate">
            {selectedUser.name} ({selectedUser.email})
          </span>
        ) : (
          <span className="text-muted-foreground">{t('approvals.editor.userPlaceholder')}</span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t('approvals.editor.userPlaceholder')}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>{t('approvals.editor.noUsersFound')}</CommandEmpty>
            <CommandGroup>
              {filteredUsers.map(user => (
                <CommandItem
                  key={user.id}
                  value={user.id}
                  // biome-ignore lint/nursery/noJsxPropsBind: menu item handler
                  onSelect={() => handleSelect(user.id)}
                  data-checked={user.id === selectedValue || undefined}>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{user.name}</span>
                    <span className="text-xs text-muted-foreground">{user.email}</span>
                  </div>
                  <Badge variant="secondary" className="ms-auto">
                    {roleLabels[user.role] ?? user.role}
                  </Badge>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
