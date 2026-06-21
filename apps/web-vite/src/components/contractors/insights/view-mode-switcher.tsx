import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@contractor-ops/ui/components/shadcn/select';
import { LayoutGrid } from 'lucide-react';
import { useCallback } from 'react';
import { tKey } from '../../../i18n/typed-keys.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import type { ContractorListViewMode } from '../hooks/use-contractor-list-view.js';
import {
  CONTRACTOR_LIST_VIEW_MODES,
  isContractorListViewMode,
  useContractorListView,
} from '../hooks/use-contractor-list-view.js';

const MODE_LABEL_KEY: Record<ContractorListViewMode, string> = {
  'visuals-first': 'insights.viewMode.visualsFirst',
  'visuals-last': 'insights.viewMode.visualsLast',
  'data-oriented': 'insights.viewMode.dataOriented',
  tabbed: 'insights.viewMode.tabbed',
  single: 'insights.viewMode.single',
};

/** Mode → label options, shared by the in-page switcher and the Settings select. */
export function useContractorListViewModeOptions() {
  const t = useTranslations('Contractors');
  return CONTRACTOR_LIST_VIEW_MODES.map(mode => ({
    value: mode,
    label: tKey(t, MODE_LABEL_KEY[mode]),
  }));
}

/**
 * Compact in-page view-mode control. Writing the mode persists it (the store IS
 * the default), so switching here is the same as setting the default in Settings.
 */
export function ViewModeSwitcher() {
  const t = useTranslations('Contractors');
  const { mode, setMode } = useContractorListView();
  const options = useContractorListViewModeOptions();
  const handleValueChange = useCallback(
    (value: string | null) => {
      if (isContractorListViewMode(value)) setMode(value);
    },
    [setMode],
  );

  return (
    <Select value={mode} onValueChange={handleValueChange} items={options}>
      <SelectTrigger
        className="h-8 w-auto gap-1.5 text-xs"
        aria-label={t('insights.viewMode.label')}>
        <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map(option => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
