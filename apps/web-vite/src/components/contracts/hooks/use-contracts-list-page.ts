import { parseAsString, useQueryState } from 'nuqs';
import { useCallback, useEffect, useState } from 'react';

import type { ContractRow } from '../contract-table/columns.js';
import { useContractList } from './use-contract-list.js';

/**
 * Drives the contracts list page: owns side-panel + wizard + import-wizard
 * dialog state, the `?action=new` deep-link, row-click selection, and
 * delegates data + filters to `useContractList`.
 *
 * Returned shape is a flat props bag for the container — no React Query
 * primitives leak out.
 */
export function useContractsListPage() {
  const [selectedContract, setSelectedContract] = useState<ContractRow | null>(null);
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [importWizardOpen, setImportWizardOpen] = useState(false);
  const [action, setAction] = useQueryState('action', parseAsString);

  const openWizard = useCallback(() => setWizardOpen(true), []);
  const openImportWizard = useCallback(() => setImportWizardOpen(true), []);

  const list = useContractList({
    onNewContract: openWizard,
    onImport: openImportWizard,
  });

  useEffect(() => {
    if (action === 'new') {
      setWizardOpen(true);
      void setAction(null);
    }
  }, [action, setAction]);

  const handleRowClick = useCallback((contract: ContractRow) => {
    setSelectedContract(contract);
    setSidePanelOpen(true);
  }, []);

  return {
    list,
    selectedContract,
    sidePanelOpen,
    setSidePanelOpen,
    wizardOpen,
    setWizardOpen,
    importWizardOpen,
    setImportWizardOpen,
    openWizard,
    openImportWizard,
    handleRowClick,
  } as const;
}
