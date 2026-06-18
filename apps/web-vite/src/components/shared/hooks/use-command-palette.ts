import type { CommandPaletteItem } from '@contractor-ops/ui/components/reui/command';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Local data layer for the global jump-to command palette.
 *
 * Pure presentational components consume `items` + `open` + `setOpen`.
 * Production rev should swap the static catalog for tRPC-fed recent
 * contractors / invoices / contracts.
 */
export interface CommandPaletteLabels {
  groups: { navigate: string; actions: string };
  items: {
    dashboard: string;
    contractors: string;
    contracts: string;
    invoices: string;
    payments: string;
    newContract: string;
    importContractors: string;
  };
}

export function useCommandPalette(labels: CommandPaletteLabels) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const go = useCallback(
    (path: string) => () => {
      void navigate(path);
    },
    [navigate],
  );

  const items: CommandPaletteItem[] = useMemo(
    () => [
      {
        id: 'nav-dashboard',
        group: labels.groups.navigate,
        label: labels.items.dashboard,
        shortcut: 'g d',
        onSelect: go('/'),
      },
      {
        id: 'nav-contractors',
        group: labels.groups.navigate,
        label: labels.items.contractors,
        shortcut: 'g c',
        onSelect: go('/contractors'),
      },
      {
        id: 'nav-contracts',
        group: labels.groups.navigate,
        label: labels.items.contracts,
        shortcut: 'g k',
        onSelect: go('/contracts'),
      },
      {
        id: 'nav-invoices',
        group: labels.groups.navigate,
        label: labels.items.invoices,
        shortcut: 'g i',
        onSelect: go('/invoices'),
      },
      {
        id: 'nav-payments',
        group: labels.groups.navigate,
        label: labels.items.payments,
        shortcut: 'g p',
        onSelect: go('/payments'),
      },
      {
        id: 'action-new-contract',
        group: labels.groups.actions,
        label: labels.items.newContract,
        onSelect: go('/contracts?new=1'),
      },
      {
        id: 'action-import',
        group: labels.groups.actions,
        label: labels.items.importContractors,
        onSelect: go('/onboarding/import'),
      },
    ],
    [go, labels],
  );

  return { open, setOpen, items };
}
