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
import type {
  RuleUserPickerProps as RuleUserPickerInputProps,
  useRuleUserPicker,
} from './hooks/use-rule-user-picker.js';

export type { RuleUserPickerInputProps as RuleUserPickerProps };

export type RuleUserPickerViewProps = RuleUserPickerInputProps &
  ReturnType<typeof useRuleUserPicker>;

export function RuleUserPicker({
  value,
  t,
  pickerOpen,
  setPickerOpen,
  search,
  setSearch,
  selectedUser,
  filteredUsers,
  handleSelect,
}: RuleUserPickerViewProps) {
  return (
    <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
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
          <span className="text-muted-foreground">{t('reminderRules.editor.userPlaceholder')}</span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t('reminderRules.editor.userPlaceholder')}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>{t('reminderRules.editor.noUsersFound')}</CommandEmpty>
            <CommandGroup>
              {filteredUsers.map(user => (
                <CommandItem
                  key={user.id}
                  value={user.id}
                  // biome-ignore lint/nursery/noJsxPropsBind: menu item handler
                  onSelect={() => handleSelect(user.id)}
                  data-checked={user.id === value || undefined}>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{user.name}</span>
                    <span className="text-xs text-muted-foreground">{user.email}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
