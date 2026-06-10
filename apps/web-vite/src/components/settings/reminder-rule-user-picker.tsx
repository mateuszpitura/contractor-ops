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

import {
  useReminderRuleUserPicker,
  type useReminderRuleUserPicker as UseReminderRuleUserPicker,
} from './hooks/use-reminder-rule-editor.js';

interface ReminderRuleUserPickerShellProps {
  value: string | undefined;
  onChange: (userId: string) => void;
}

export type ReminderRuleUserPickerViewProps = ReturnType<typeof UseReminderRuleUserPicker>;

type UserRow = ReminderRuleUserPickerViewProps['filteredUsers'][number];

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

export function ReminderRuleUserPickerView({
  t,
  pickerOpen,
  setPickerOpen,
  search,
  setSearch,
  selectedUser,
  filteredUsers,
  value: selectedValue,
  handleSelect,
}: ReminderRuleUserPickerViewProps) {
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
                  isChecked={user.id === selectedValue}
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

export function ReminderRuleUserPicker(props: ReminderRuleUserPickerShellProps) {
  const picker = useReminderRuleUserPicker(props);
  return <ReminderRuleUserPickerView {...picker} />;
}
