import { CommandPalette } from '@contractor-ops/ui/components/reui/command';

import { useTranslations } from '../../i18n/useTranslations.js';
import { useDashboardContext } from '../layout/dashboard-context.js';
import type { CommandPaletteLabels } from './hooks/use-command-palette.js';
import { useCommandPalette } from './hooks/use-command-palette.js';

// Global jump-to-anything palette. Mount once at the app shell.
// `cmd+k` / `ctrl+k` opens; arrow keys + enter navigate.
export function CommandPaletteContainer() {
  const { activeOrg } = useDashboardContext();
  const t = useTranslations('Common.commandPalette');

  if (!activeOrg) return null;
  return <CommandPaletteInner labels={makeLabels(t)} />;
}

type PaletteLabels = CommandPaletteLabels & {
  placeholder: string;
  empty: string;
};

function makeLabels(t: (key: string) => string): PaletteLabels {
  return {
    placeholder: t('placeholder'),
    empty: t('empty'),
    groups: { navigate: t('groups.navigate'), actions: t('groups.actions') },
    items: {
      dashboard: t('items.dashboard'),
      contractors: t('items.contractors'),
      contracts: t('items.contracts'),
      invoices: t('items.invoices'),
      payments: t('items.payments'),
      newContract: t('items.newContract'),
      importContractors: t('items.importContractors'),
    },
  };
}

function CommandPaletteInner({ labels }: { labels: PaletteLabels }) {
  const { open, setOpen, items } = useCommandPalette(labels);

  return (
    <CommandPalette
      open={open}
      onOpenChange={setOpen}
      items={items}
      placeholder={labels.placeholder}
      emptyLabel={labels.empty}
    />
  );
}
