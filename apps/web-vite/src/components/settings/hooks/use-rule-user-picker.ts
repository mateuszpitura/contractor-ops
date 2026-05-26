import { useMemo, useState } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useSettingsUsers } from './use-settings-users.js';

export interface RuleUserPickerProps {
  value: string | undefined;
  onChange: (userId: string) => void;
}

export function useRuleUserPicker({ value, onChange }: RuleUserPickerProps) {
  const t = useTranslations('Settings');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { users: rawMembers } = useSettingsUsers();

  const users = useMemo(
    () =>
      rawMembers.map(m => ({
        id: (m.userId ?? m.id) as string,
        name: (m.name ?? 'Unknown') as string,
        email: (m.email ?? '') as string,
      })),
    [rawMembers],
  );

  const selectedUser = users.find(u => u.id === value);

  const filteredUsers = search
    ? users.filter(
        u =>
          u.name.toLowerCase().includes(search.toLowerCase()) ||
          u.email.toLowerCase().includes(search.toLowerCase()),
      )
    : users;

  const handleSelect = (userId: string) => {
    onChange(userId);
    setPickerOpen(false);
    setSearch('');
  };

  return {
    t,
    pickerOpen,
    setPickerOpen,
    search,
    setSearch,
    selectedUser,
    filteredUsers,
    value,
    handleSelect,
  } as const;
}
