/**
 * Invoice actions registry — single source of truth.
 *
 * Mirror of apps/web/src/components/invoices/actions.ts. Pure data
 * structure; no React or next-intl imports, so the SPA port lifts it
 * unchanged.
 */

import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSearch,
  Link2,
  Link2Off,
  Pencil,
  Repeat,
  Send,
  XCircle,
} from 'lucide-react';
import type { ComponentType } from 'react';

export type InvoiceStatus =
  | 'RECEIVED'
  | 'UNDER_REVIEW'
  | 'APPROVAL_PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'READY_FOR_PAYMENT'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'VOID';

export type InvoiceMatchStatus =
  | 'UNMATCHED'
  | 'PARTIAL'
  | 'MATCHED'
  | 'DISCREPANCY'
  | 'MANUALLY_CONFIRMED';

export interface InvoiceRowLike {
  id: string;
  status: InvoiceStatus | string;
  matchStatus?: InvoiceMatchStatus | string;
  isDuplicateSuspected?: boolean;
  isReverseCharge?: boolean;
}

export type InvoiceActionSurface = 'bulk' | 'detail' | 'rowMenu';

export interface InvoiceAction {
  key: string;
  labelKey: string;
  i18nNamespace: 'Invoices' | 'Invoices.detail' | 'Invoices.bulkActions';
  icon: ComponentType<{ className?: string }>;
  variant?: 'default' | 'destructive';
  surfaces: readonly InvoiceActionSurface[];
  visibleStatuses?: readonly InvoiceStatus[];
  visibleMatchStatuses?: readonly InvoiceMatchStatus[];
  hiddenWhen?: (row: InvoiceRowLike) => boolean;
  disabledWhen?: (row: InvoiceRowLike) => boolean;
  confirmCopyKey?: string;
}

const NON_VOIDABLE_STATUSES: readonly InvoiceStatus[] = ['PAID', 'PARTIALLY_PAID', 'VOID'];

const REGISTRY: readonly InvoiceAction[] = [
  {
    key: 'edit',
    labelKey: 'saveDraft',
    i18nNamespace: 'Invoices.detail',
    icon: Pencil,
    surfaces: ['detail'],
    visibleStatuses: ['RECEIVED'],
  },
  {
    key: 'submitForMatching',
    labelKey: 'submitForMatching',
    i18nNamespace: 'Invoices.detail',
    icon: Send,
    surfaces: ['detail', 'bulk'],
    visibleStatuses: ['RECEIVED'],
  },
  {
    key: 'match.manual',
    labelKey: 'match.confirmMatch',
    i18nNamespace: 'Invoices',
    icon: Link2,
    surfaces: ['detail'],
    visibleMatchStatuses: ['UNMATCHED', 'PARTIAL', 'DISCREPANCY'],
  },
  {
    key: 'match.unmatch',
    labelKey: 'match.unmatch',
    i18nNamespace: 'Invoices',
    icon: Link2Off,
    surfaces: ['detail'],
    visibleMatchStatuses: ['MATCHED', 'MANUALLY_CONFIRMED'],
  },
  {
    key: 'duplicate.dismiss',
    labelKey: 'duplicate.notDuplicate',
    i18nNamespace: 'Invoices',
    icon: FileSearch,
    surfaces: ['detail'],
    hiddenWhen: row => !row.isDuplicateSuspected,
  },
  {
    key: 'reverseCharge.toggle',
    labelKey: 'reverseCharge.toggle',
    i18nNamespace: 'Invoices',
    icon: Repeat,
    surfaces: ['detail'],
    hiddenWhen: row =>
      row.status === 'VOID' || row.status === 'PAID' || row.status === 'PARTIALLY_PAID',
  },
  {
    key: 'approval.approve',
    labelKey: 'approve',
    i18nNamespace: 'Invoices.bulkActions',
    icon: CheckCircle2,
    surfaces: ['bulk', 'detail'],
    visibleStatuses: ['APPROVAL_PENDING'],
  },
  {
    key: 'approval.reject',
    labelKey: 'reject',
    i18nNamespace: 'Invoices.bulkActions',
    icon: XCircle,
    surfaces: ['bulk', 'detail'],
    variant: 'destructive',
    visibleStatuses: ['APPROVAL_PENDING'],
    confirmCopyKey: 'Invoices.reject.body',
  },
  {
    key: 'void',
    labelKey: 'voidInvoice',
    i18nNamespace: 'Invoices.detail',
    icon: AlertTriangle,
    surfaces: ['detail'],
    variant: 'destructive',
    hiddenWhen: row => NON_VOIDABLE_STATUSES.includes(row.status as InvoiceStatus),
    confirmCopyKey: 'Invoices.detail.voidConfirmBody',
  },
  {
    key: 'download',
    labelKey: 'download',
    i18nNamespace: 'Invoices.bulkActions',
    icon: Download,
    surfaces: ['bulk', 'detail'],
  },
  {
    key: 'bulk.export',
    labelKey: 'export',
    i18nNamespace: 'Invoices.bulkActions',
    icon: Download,
    surfaces: ['bulk'],
  },
  {
    key: 'bulk.void',
    labelKey: 'void',
    i18nNamespace: 'Invoices.bulkActions',
    icon: AlertTriangle,
    surfaces: ['bulk'],
    variant: 'destructive',
    confirmCopyKey: 'Invoices.bulkActions.voidConfirmBodyBulk',
  },
] as const;

export function getInvoiceActions(): readonly InvoiceAction[] {
  return REGISTRY;
}

export function getBulkInvoiceActions(): readonly InvoiceAction[] {
  return REGISTRY.filter(action => action.surfaces.includes('bulk'));
}

export function getDetailInvoiceActions(row: InvoiceRowLike): readonly InvoiceAction[] {
  return REGISTRY.filter(action => isActionVisible(action, 'detail', row));
}

export function getRowMenuInvoiceActions(row: InvoiceRowLike): readonly InvoiceAction[] {
  return REGISTRY.filter(action => isActionVisible(action, 'rowMenu', row));
}

function isActionVisible(
  action: InvoiceAction,
  surface: InvoiceActionSurface,
  row: InvoiceRowLike,
): boolean {
  if (!action.surfaces.includes(surface)) return false;
  if (action.visibleStatuses && !action.visibleStatuses.includes(row.status as InvoiceStatus)) {
    return false;
  }
  if (
    action.visibleMatchStatuses &&
    !action.visibleMatchStatuses.includes(row.matchStatus as InvoiceMatchStatus)
  ) {
    return false;
  }
  if (action.hiddenWhen?.(row)) return false;
  return true;
}
