import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@contractor-ops/ui/components/shadcn/command';
import { formControlPopoverRender } from '@contractor-ops/ui/components/shadcn/form-control-trigger';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@contractor-ops/ui/components/shadcn/popover';
import { useCallback } from 'react';
import type {
  RuleUserPickerProps as RuleUserPickerInputProps,
  useRuleUserPicker,
} from './hooks/use-rule-user-picker.js';

export type { RuleUserPickerInputProps as RuleUserPickerProps };

export type RuleUserPickerViewProps = RuleUserPickerInputProps &
  ReturnType<typeof useRuleUserPicker>;

type UserRow = RuleUserPickerViewProps['filteredUsers'][number];

interface UserItemProps {
  user: UserRow;
  isChecked: boolean;
  onSelect: (id: string) => void;
}

function UserItem({ user, isChecked, onSelect }: UserItemProps) {
  const handleSelect = useCallback(() => onSelect(user.id), [onSelect, user.id]);
  return (
    <CommandItem value={user.id} onSelect={handleSelect} data-checked={isChecked || undefined}>
      <div className="flex flex-col">
        <span className="text-sm font-medium">{user.name}</span>
        <span className="text-xs text-muted-foreground">{user.email}</span>
      </div>
    </CommandItem>
  );
}

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
      <PopoverTrigger render={formControlPopoverRender(undefined, { size: 'sm' })}>
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
                <UserItem
                  key={user.id}
                  user={user}
                  isChecked={user.id === value}
                  onSelect={handleSelect}
                />
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
