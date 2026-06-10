import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
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
import type { useChainEditorUserPicker as UseChainEditorUserPicker } from './hooks/use-chain-editor-dialog.js';
import { useChainEditorUserPicker } from './hooks/use-chain-editor-dialog.js';

interface ChainEditorUserPickerShellProps {
  value: string | null | undefined;
  onChange: (userId: string | null) => void;
}

export type ChainEditorUserPickerViewProps = ReturnType<typeof UseChainEditorUserPicker>;

type UserRow = ChainEditorUserPickerViewProps['filteredUsers'][number];

interface UserItemProps {
  user: UserRow;
  roleLabel: string;
  isChecked: boolean;
  onSelect: (id: string) => void;
}

function UserItem({ user, roleLabel, isChecked, onSelect }: UserItemProps) {
  const handleSelect = useCallback(() => onSelect(user.id), [onSelect, user.id]);
  return (
    <CommandItem value={user.id} onSelect={handleSelect} data-checked={isChecked || undefined}>
      <div className="flex flex-col">
        <span className="text-sm font-medium">{user.name}</span>
        <span className="text-xs text-muted-foreground">{user.email}</span>
      </div>
      <Badge variant="secondary" className="ms-auto">
        {roleLabel}
      </Badge>
    </CommandItem>
  );
}

export function ChainEditorUserPickerView({
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
}: ChainEditorUserPickerViewProps) {
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={formControlPopoverRender(undefined, { size: 'sm' })}>
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
                <UserItem
                  key={user.id}
                  user={user}
                  roleLabel={roleLabels[user.role] ?? user.role}
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

export function ChainEditorUserPicker(props: ChainEditorUserPickerShellProps) {
  const picker = useChainEditorUserPicker(props);
  return <ChainEditorUserPickerView {...picker} />;
}
