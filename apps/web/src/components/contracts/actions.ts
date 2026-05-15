/**
 * Contract actions registry — single source of truth.
 *
 * One place defines every action that can be performed on a contract
 * (or a selection of contracts). Multiple surfaces consume the same
 * registry so the inventory cannot drift:
 *
 *   - bulk-action toolbar on the data-table (multi-row)
 *   - detail-header action bar on the contract detail page (single-row)
 *   - (future) row context menu, side-panel menu, etc.
 *
 * The registry is intentionally a pure data structure — no hooks, no
 * mutations, no React. Consumers wire actual mutations via
 * `useResourceMutation` at the call site.
 */

import { Ban, Download, FilePlus, Pencil, Replace, Send, Trash2, Upload } from 'lucide-react';
import type { ComponentType } from 'react';

// ---------------------------------------------------------------------------
// Lifecycle status (mirrors the Prisma `ContractStatus` enum)
// ---------------------------------------------------------------------------

export type ContractStatus =
  | 'DRAFT'
  | 'PENDING_SIGNATURE'
  | 'SIGNATURE_DECLINED'
  | 'SIGNATURE_EXPIRED'
  | 'ACTIVE'
  | 'EXPIRING'
  | 'EXPIRED'
  | 'TERMINATED'
  | 'SUPERSEDED'
  | 'ARCHIVED';

/** Minimal contract row shape required to evaluate action visibility. */
export interface ContractRowLike {
  id: string;
  status: ContractStatus | string;
}

/** Surfaces where an action can appear. */
export type ContractActionSurface = 'bulk' | 'detail' | 'rowMenu';

export interface ContractAction {
  /** Stable identifier — used as React key + analytics tag. */
  key: string;
  /**
   * Translation key relative to `i18nNamespace`. Consumers call
   * `t(labelKey)` where `t = useTranslations(action.i18nNamespace)`.
   */
  labelKey: string;
  /** next-intl namespace the `labelKey` resolves against. */
  i18nNamespace: 'Contracts' | 'Contracts.bulkActions' | 'ContractDetail';
  /** Lucide icon component rendered at `iconSize.md` (or `sm` in dense menus). */
  icon: ComponentType<{ className?: string }>;
  /** `destructive` triggers red foreground / button variant in consumers. */
  variant?: 'default' | 'destructive';
  /** Which surfaces this action is allowed to render in. */
  surfaces: readonly ContractActionSurface[];
  /**
   * Allow-list of contract statuses for which this action is visible.
   * `undefined` means "always visible".
   */
  visibleStages?: readonly ContractStatus[];
  /** Custom hide predicate (evaluated after `visibleStages`). */
  hiddenWhen?: (row: ContractRowLike) => boolean;
  /** Custom disable predicate. Action still renders but is non-interactive. */
  disabledWhen?: (row: ContractRowLike) => boolean;
  /**
   * If the action requires a confirmation dialog, this is the i18n key
   * for the confirmation body copy. Consumer is responsible for rendering
   * the dialog itself; the flag just signals intent.
   */
  confirmCopyKey?: string;
}

// ---------------------------------------------------------------------------
// Registry — full inventory of contract actions
// ---------------------------------------------------------------------------

const REGISTRY: readonly ContractAction[] = [
  // ---- Single-row primary actions ----
  {
    key: 'edit',
    labelKey: 'actions.edit',
    i18nNamespace: 'ContractDetail',
    icon: Pencil,
    surfaces: ['detail', 'rowMenu'],
  },
  {
    key: 'addAmendment',
    labelKey: 'actions.addAmendment',
    i18nNamespace: 'ContractDetail',
    icon: FilePlus,
    surfaces: ['detail', 'rowMenu'],
    visibleStages: ['ACTIVE', 'EXPIRING'],
  },
  {
    key: 'uploadDocument',
    labelKey: 'actions.uploadDocument',
    i18nNamespace: 'ContractDetail',
    icon: Upload,
    surfaces: ['detail', 'rowMenu'],
  },
  {
    key: 'sendForSignature',
    labelKey: 'actions.sendForSignature',
    i18nNamespace: 'ContractDetail',
    icon: Send,
    surfaces: ['detail'],
    visibleStages: ['DRAFT', 'SIGNATURE_DECLINED', 'SIGNATURE_EXPIRED'],
  },

  // ---- Lifecycle transitions (single-row, status-dependent) ----
  {
    key: 'terminate',
    labelKey: 'actions.terminate',
    i18nNamespace: 'ContractDetail',
    icon: Ban,
    surfaces: ['detail', 'rowMenu'],
    variant: 'destructive',
    visibleStages: ['DRAFT', 'ACTIVE', 'EXPIRING', 'EXPIRED', 'PENDING_SIGNATURE'],
    confirmCopyKey: 'ContractDetail.actions.terminateBody',
  },
  {
    key: 'supersede',
    labelKey: 'actions.supersede',
    i18nNamespace: 'ContractDetail',
    icon: Replace,
    surfaces: ['detail', 'rowMenu'],
    variant: 'destructive',
    visibleStages: ['ACTIVE', 'EXPIRING', 'EXPIRED'],
  },
  {
    key: 'delete',
    labelKey: 'actions.delete',
    i18nNamespace: 'ContractDetail',
    icon: Trash2,
    surfaces: ['detail', 'rowMenu'],
    variant: 'destructive',
    visibleStages: ['DRAFT'],
    confirmCopyKey: 'ContractDetail.actions.deleteBody',
  },

  // ---- Bulk-only actions ----
  {
    key: 'bulk.export',
    labelKey: 'export',
    i18nNamespace: 'Contracts.bulkActions',
    icon: Download,
    surfaces: ['bulk'],
  },
  {
    key: 'bulk.terminate',
    labelKey: 'terminate',
    i18nNamespace: 'Contracts.bulkActions',
    icon: Ban,
    surfaces: ['bulk'],
    variant: 'destructive',
    confirmCopyKey: 'Contracts.terminate.bodyBulk',
  },
] as const;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the full, immutable list of contract actions. Consumers
 * filter this list with the helpers below (or inline predicates) to
 * render only the actions that apply to their surface + row state.
 */
export function getContractActions(): readonly ContractAction[] {
  return REGISTRY;
}

/**
 * Actions allowed in the bulk-selection toolbar. Bulk actions are
 * inherently status-independent (they operate over a heterogeneous
 * selection), so we ignore `visibleStages` / `hiddenWhen` here.
 */
export function getBulkContractActions(): readonly ContractAction[] {
  return REGISTRY.filter(action => action.surfaces.includes('bulk'));
}

/**
 * Actions applicable to a single contract on the detail surface.
 * Filters by:
 *   1. surface (`detail`)
 *   2. `visibleStages` (status gate)
 *   3. `hiddenWhen` (custom predicate)
 */
export function getDetailContractActions(row: ContractRowLike): readonly ContractAction[] {
  return REGISTRY.filter(action => isActionVisible(action, 'detail', row));
}

/**
 * Actions applicable in a row context menu. Same filtering as detail,
 * but uses the `rowMenu` surface.
 */
export function getRowMenuContractActions(row: ContractRowLike): readonly ContractAction[] {
  return REGISTRY.filter(action => isActionVisible(action, 'rowMenu', row));
}

function isActionVisible(
  action: ContractAction,
  surface: ContractActionSurface,
  row: ContractRowLike,
): boolean {
  if (!action.surfaces.includes(surface)) return false;
  if (action.visibleStages && !action.visibleStages.includes(row.status as ContractStatus)) {
    return false;
  }
  if (action.hiddenWhen?.(row)) return false;
  return true;
}
