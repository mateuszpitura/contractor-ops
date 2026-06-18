import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@contractor-ops/ui/components/shadcn/select';
import { useTranslations } from '../../i18n/useTranslations.js';
import type { ContractorListViewMode } from '../contractors/hooks/use-contractor-list-view.js';
import { useContractorListView } from '../contractors/hooks/use-contractor-list-view.js';
import { useContractorListViewModeOptions } from '../contractors/insights/view-mode-switcher.js';

/**
 * Settings home for the persisted contractor list view-mode default. Writes the
 * same Zustand store the in-page switcher uses — one source of truth.
 */
export function ContractorViewSetting() {
  const t = useTranslations('Settings');
  const { mode, setMode } = useContractorListView();
  const options = useContractorListViewModeOptions();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('contractorListView.label')}</CardTitle>
        <CardDescription>{t('contractorListView.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Select
          value={mode}
          onValueChange={value => setMode(value as ContractorListViewMode)}
          items={options}>
          <SelectTrigger className="w-full max-w-xs">
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
      </CardContent>
    </Card>
  );
}
