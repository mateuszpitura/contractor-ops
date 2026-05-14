/**
 * Invoice actions registry — single source of truth.
 *
 * One place defines every action that can be performed on an invoice
 * (or a selection of invoices). Multiple surfaces consume the same
 * registry so the inventory cannot drift:
 *
 *   - detail action bar inside `invoice-metadata-form` (single-row)
 *   - (future) bulk-action toolbar on the invoice data-table
 *   - (future) row context menu on the invoice list
 *
 * The registry is intentionally a pure data structure — no hooks, no
 * mutations, no React. Consumers wire actual mutations via
 * `useResourceMutation` at the call site.
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

// ---------------------------------------------------------------------------
// Status enums (mirror Prisma + tRPC schema)
// ---------------------------------------------------------------------------

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

/** Minimal invoice shape required to evaluate action visibility. */
export interface InvoiceRowLike {
  id: string;
  status: InvoiceStatus | string;
  matchStatus?: InvoiceMatchStatus | string;
  /** Detection flag — true when DUPLICATE_SUSPECTED appears in `flagsJson`. */
  isDuplicateSuspected?: boolean;
  /** Whether the invoice currently has reverse-charge applied. */
  isReverseCharge?: boolean;
}

/** Surfaces where an action can appear. */
export type InvoiceActionSurface = 'bulk' | 'detail' | 'rowMenu';

export interface InvoiceAction {
  /** Stable identifier — used as React key + analytics tag. */
  key: string;
  /**
   * Translation key relative to `i18nNamespace`. Consumers call
   * `t(labelKey)` where `t = useTranslations(action.i18nNamespace)`.
   */
  labelKey: string;
  /** next-intl namespace the `labelKey` resolves against. */
  i18nNamespace: 'Invoices' | 'Invoices.detail' | 'Invoices.bulkActions';
  /** Lucide icon component rendered at `iconSize.md` (or `sm` in dense menus). */
  icon: ComponentType<{ className?: string }>;
  /** `destructive` triggers red foreground / button variant in consumers. */
  variant?: 'default' | 'destructive';
  /** Which surfaces this action is allowed to render in. */
  surfaces: readonly InvoiceActionSurface[];
  /**
   * Allow-list of payment statuses for which this action is visible.
   * `undefined` means "always visible" w.r.t. payment status.
   */
  visibleStatuses?: readonly InvoiceStatus[];
  /**
   * Allow-list of match statuses for which this action is visible.
   * `undefined` means "always visible" w.r.t. match status.
   */
  visibleMatchStatuses?: readonly InvoiceMatchStatus[];
  /** Custom hide predicate (evaluated after status allow-lists). */
  hiddenWhen?: (row: InvoiceRowLike) => boolean;
  /** Custom disable predicate. Action still renders but is non-interactive. */
  disabledWhen?: (row: InvoiceRowLike) => boolean;
  /**
   * If the action requires a confirmation dialog, this is the i18n key
   * for the confirmation body copy. Consumer is responsible for rendering
   * the dialog itself; the flag just signals intent.
   */
  confirmCopyKey?: string;
}

// ---------------------------------------------------------------------------
// Registry — full inventory of invoice actions
// ---------------------------------------------------------------------------

/**
 * Payment statuses where an invoice can no longer be voided.
 * (Terminal payment states or already-void invoices.)
 */
const NON_VOIDABLE_STATUSES: readonly InvoiceStatus[] = ['PAID', 'PARTIALLY_PAID', 'VOID'];

const REGISTRY: readonly InvoiceAction[] = [
  // ---- Single-row primary actions ----
  {
    key: 'edit',
    labelKey: 'saveDraft',
    i18nNamespace: 'Invoices.detail',
    icon: Pencil,
    surfaces: ['detail'],
    // Editing is only meaningful before the invoice has been routed for
    // matching. After that the form fields are locked.
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

  // ---- Matching workflow (single-row, match-status-dependent) ----
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

  // ---- Duplicate handling ----
  {
    key: 'duplicate.dismiss',
    labelKey: 'duplicate.notDuplicate',
    i18nNamespace: 'Invoices',
    icon: FileSearch,
    surfaces: ['detail'],
    hiddenWhen: row => !row.isDuplicateSuspected,
  },

  // ---- Toggles ----
  {
    key: 'reverseCharge.toggle',
    labelKey: 'reverseCharge.toggle',
    i18nNamespace: 'Invoices',
    icon: Repeat,
    surfaces: ['detail'],
    // Toggle stays available across most lifecycle stages so users can
    // correct mis-classification — but not on terminal states.
    hiddenWhen: row =>
      row.status === 'VOID' || row.status === 'PAID' || row.status === 'PARTIALLY_PAID',
  },

  // ---- Approval workflow (bulk + detail) ----
  // Lives in the dedicated Approvals UI today; surfaced here so the
  // invoice registry stays the canonical inventory.
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

  // ---- Void (terminal, destructive, single-row) ----
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

  // ---- Export / download (bulk + detail) ----
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
] as const;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the full, immutable list of invoice actions. Consumers filter
 * this list with the helpers below (or inline predicates) to render only
 * the actions that apply to their surface + row state.
 */
export function getInvoiceActions(): readonly InvoiceAction[] {
  return REGISTRY;
}

/**
 * Actions allowed in the bulk-selection toolbar. Bulk actions are
 * inherently status-independent (they operate over a heterogeneous
 * selection), so we ignore `visibleStatuses` / `hiddenWhen` here.
 */
export function getBulkInvoiceActions(): readonly InvoiceAction[] {
  return REGISTRY.filter(action => action.surfaces.includes('bulk'));
}

/**
 * Actions applicable to a single invoice on the detail surface. Filters
 * by:
 *   1. surface (`detail`)
 *   2. `visibleStatuses` (payment-status gate)
 *   3. `visibleMatchStatuses` (match-status gate)
 *   4. `hiddenWhen` (custom predicate)
 */
export function getDetailInvoiceActions(row: InvoiceRowLike): readonly InvoiceAction[] {
  return REGISTRY.filter(action => isActionVisible(action, 'detail', row));
}

/**
 * Actions applicable in a row context menu. Same filtering as detail,
 * but uses the `rowMenu` surface.
 */
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
