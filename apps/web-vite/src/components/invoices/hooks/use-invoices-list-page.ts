import { parseAsString, useQueryState } from 'nuqs';
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useRouter } from '../../../i18n/navigation.js';
import type { InvoiceRow } from '../invoice-table/columns.js';
import { useInvoiceList } from './use-invoice-list.js';

const EMAIL_COPIED_RESET_MS = 2000;
const COMPLIANCE_REVIEW_FILTER = 'invalid,failed';
const INVOICES_TABLE_REGION_SELECTOR = '[data-slot=invoices-table-region]';

/**
 * Returns the email address inbound invoices can be forwarded to.
 *
 * Hard-coded today (matches legacy `apps/web` parity); routed through a hook
 * so a future tRPC-backed lookup ships without touching the container.
 */
function useInvoiceEmail(): string {
  return 'invoices@your-org.contractorhub.io';
}

/**
 * Page-level orchestration for the invoices list screen — composes the list
 * data hook with side-panel selection, upload toggle, email copy UX, and the
 * `?action=upload` deep-link effect so `pages/dashboard/invoices.tsx` stays JSX-only.
 */
export function useInvoicesListPage() {
  const router = useRouter();
  const [searchParams] = useSearchParams();
  const invoiceEmail = useInvoiceEmail();

  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRow | null>(null);
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);
  const [action, setAction] = useQueryState('action', parseAsString);

  const handleUpload = useCallback(() => {
    setUploadOpen(prev => !prev);
  }, []);

  const list = useInvoiceList({ onUpload: handleUpload });

  useEffect(() => {
    if (action === 'upload') {
      setUploadOpen(true);
      void setAction(null);
    }
  }, [action, setAction]);

  const handleRowClick = useCallback((invoice: InvoiceRow) => {
    setSelectedInvoice(invoice);
    setSidePanelOpen(true);
  }, []);

  const handleUploadComplete = useCallback(() => {
    setUploadOpen(false);
  }, []);

  const handleCopyEmail = useCallback(() => {
    void navigator.clipboard.writeText(invoiceEmail).then(() => {
      setEmailCopied(true);
      setTimeout(() => setEmailCopied(false), EMAIL_COPIED_RESET_MS);
    });
  }, [invoiceEmail]);

  const handleComplianceReview = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('einvoiceStatus', COMPLIANCE_REVIEW_FILTER);
    const query = params.toString();
    void router.replace(query ? `?${query}` : '?');
    document
      .querySelector(INVOICES_TABLE_REGION_SELECTOR)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [router, searchParams]);

  const handleStatusChange = useCallback(
    (statuses: string[]) => {
      list.tableProps.onFiltersChange({ status: statuses });
    },
    [list.tableProps],
  );

  return {
    list,
    invoiceEmail,
    selectedInvoice,
    sidePanelOpen,
    setSidePanelOpen,
    uploadOpen,
    emailCopied,
    handleUpload,
    handleRowClick,
    handleUploadComplete,
    handleCopyEmail,
    handleComplianceReview,
    handleStatusChange,
  } as const;
}
