import { useQuery } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { useTRPC } from '../../../providers/trpc-provider.js';

/**
 * Top-bar data + ephemeral UI state.
 *
 * The "New Contractor" and "Upload Invoice" quick-action buttons used to
 * navigate to the relevant list page with `?action=…` so the list page
 * itself could open its wizard / upload dialog. That worked but it ripped
 * the user out of whatever page they were on, which is jarring when the
 * sibling "New Contract" button opens the wizard in place. Host the same
 * dialogs at the top-bar surface and open them locally instead. The list
 * pages keep the `?action=…` deep-link path for direct URL hits.
 */
export function useTopBar() {
  const trpc = useTRPC();

  const contractorCountQuery = useQuery(
    trpc.contractor.list.queryOptions({ page: 1, pageSize: 10 }),
  );

  const hasContractors = (contractorCountQuery.data?.total ?? 0) > 0;

  const [contractorWizardOpen, setContractorWizardOpen] = useState(false);
  const [invoiceUploadOpen, setInvoiceUploadOpen] = useState(false);

  const openContractorWizard = useCallback(() => {
    setContractorWizardOpen(true);
  }, []);

  const openInvoiceUpload = useCallback(() => {
    setInvoiceUploadOpen(true);
  }, []);

  return {
    hasContractors,
    contractorWizardOpen,
    setContractorWizardOpen,
    openContractorWizard,
    invoiceUploadOpen,
    setInvoiceUploadOpen,
    openInvoiceUpload,
  } as const;
}
