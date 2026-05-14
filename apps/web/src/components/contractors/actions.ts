/**
 * Contractor actions registry — single source of truth.
 *
 * One place defines every action that can be performed on a contractor
 * (or a selection of contractors). Multiple surfaces consume the same
 * registry so the inventory cannot drift:
 *
 *   - bulk-action toolbar on the data-table (multi-row)
 *   - profile-header action bar on the detail page (single-row)
 *   - (future) row context menu, side-panel menu, etc.
 *
 * The registry is intentionally a pure data structure — no hooks, no
 * mutations, no React. Consumers wire actual mutations via
 * `useResourceMutation` at the call site.
 */

import {
  Activity,
  Archive,
  CheckCircle2,
  Download,
  FilePlus,
  Pencil,
  Play,
  PowerOff,
  UserCheck,
  Zap,
} from 'lucide-react';
import type { ComponentType } from 'react';

// ---------------------------------------------------------------------------
// Lifecycle stage (mirrors the Prisma enum + tRPC schema)
// ---------------------------------------------------------------------------

export type ContractorLifecycleStage = 'DRAFT' | 'ONBOARDING' | 'ACTIVE' | 'OFFBOARDING' | 'ENDED';

/** Minimal contractor row shape required to evaluate action visibility. */
export interface ContractorRowLike {
  id: string;
  lifecycleStage: ContractorLifecycleStage | string;
}

/** Surfaces where an action can appear. */
export type ContractorActionSurface = 'bulk' | 'profile' | 'rowMenu';

export interface ContractorAction {
  /** Stable identifier — used as React key + analytics tag. */
  key: string;
  /**
   * Translation key relative to `i18nNamespace`. Consumers call
   * `t(labelKey)` where `t = useTranslations(action.i18nNamespace)`.
   */
  labelKey: string;
  /** next-intl namespace the `labelKey` resolves against. */
  i18nNamespace: 'Contractors' | 'Contractors.bulkActions' | 'ContractorProfile';
  /** Lucide icon component rendered at `iconSize.md` (or `sm` in dense menus). */
  icon: ComponentType<{ className?: string }>;
  /** `destructive` triggers red foreground / button variant in consumers. */
  variant?: 'default' | 'destructive';
  /** Which surfaces this action is allowed to render in. */
  surfaces: readonly ContractorActionSurface[];
  /**
   * Allow-list of lifecycle stages for which this action is visible.
   * `undefined` means "always visible".
   */
  visibleStages?: readonly ContractorLifecycleStage[];
  /** Custom hide predicate (evaluated after `visibleStages`). */
  hiddenWhen?: (row: ContractorRowLike) => boolean;
  /** Custom disable predicate. Action still renders but is non-interactive. */
  disabledWhen?: (row: ContractorRowLike) => boolean;
  /**
   * If the action requires a confirmation dialog, this is the i18n key
   * for the confirmation body copy. Consumer is responsible for rendering
   * the dialog itself; the flag just signals intent.
   */
  confirmCopyKey?: string;
}

// ---------------------------------------------------------------------------
// Registry — full inventory of contractor actions
// ---------------------------------------------------------------------------

const REGISTRY: readonly ContractorAction[] = [
  // ---- Single-row primary actions ----
  {
    key: 'edit',
    labelKey: 'actions.edit',
    i18nNamespace: 'ContractorProfile',
    icon: Pencil,
    surfaces: ['profile', 'rowMenu'],
  },
  {
    key: 'addContract',
    labelKey: 'actions.addContract',
    i18nNamespace: 'ContractorProfile',
    icon: FilePlus,
    surfaces: ['profile', 'rowMenu'],
  },

  // ---- Lifecycle transitions (single-row, stage-dependent) ----
  {
    key: 'lifecycle.startOnboarding',
    labelKey: 'actions.startOnboarding',
    i18nNamespace: 'ContractorProfile',
    icon: Play,
    surfaces: ['profile', 'rowMenu'],
    visibleStages: ['DRAFT'],
  },
  {
    key: 'lifecycle.activate',
    labelKey: 'actions.activate',
    i18nNamespace: 'ContractorProfile',
    icon: CheckCircle2,
    surfaces: ['profile', 'rowMenu'],
    visibleStages: ['ONBOARDING'],
  },
  {
    key: 'lifecycle.startOffboarding',
    labelKey: 'actions.startOffboarding',
    i18nNamespace: 'ContractorProfile',
    icon: Play,
    surfaces: ['profile', 'rowMenu'],
    visibleStages: ['ACTIVE'],
  },
  {
    key: 'lifecycle.completeOffboarding',
    labelKey: 'actions.completeOffboarding',
    i18nNamespace: 'ContractorProfile',
    icon: CheckCircle2,
    surfaces: ['profile', 'rowMenu'],
    visibleStages: ['OFFBOARDING'],
  },
  {
    key: 'lifecycle.markInactive',
    labelKey: 'actions.markInactive',
    i18nNamespace: 'ContractorProfile',
    icon: PowerOff,
    surfaces: ['profile', 'rowMenu'],
    visibleStages: ['ACTIVE'],
  },

  // ---- Workflow launch (single-row + bulk) ----
  {
    key: 'launchWorkflow',
    labelKey: 'launchWorkflow',
    i18nNamespace: 'Contractors.bulkActions',
    icon: Zap,
    surfaces: ['bulk', 'profile', 'rowMenu'],
  },

  // ---- Bulk-only actions ----
  {
    key: 'bulk.assignOwner',
    labelKey: 'assignOwner',
    i18nNamespace: 'Contractors.bulkActions',
    icon: UserCheck,
    surfaces: ['bulk'],
  },
  {
    key: 'bulk.export',
    labelKey: 'export',
    i18nNamespace: 'Contractors.bulkActions',
    icon: Download,
    surfaces: ['bulk'],
  },

  // ---- Archive (works on both single-row and bulk) ----
  {
    key: 'archive',
    labelKey: 'archive',
    i18nNamespace: 'Contractors.bulkActions',
    icon: Archive,
    surfaces: ['bulk'],
    variant: 'destructive',
    confirmCopyKey: 'Contractors.archive.bodyBulk',
  },
  {
    key: 'profile.archive',
    labelKey: 'actions.archive',
    i18nNamespace: 'ContractorProfile',
    icon: Archive,
    surfaces: ['profile', 'rowMenu'],
    variant: 'destructive',
    visibleStages: ['ENDED'],
    confirmCopyKey: 'Contractors.archive.body',
  },

  // ---- Compliance recompute (visible on profile/rowMenu) ----
  {
    key: 'recomputeCompliance',
    labelKey: 'Compliance.Recompute.buttonLabel',
    i18nNamespace: 'Contractors',
    icon: Activity,
    surfaces: ['profile', 'rowMenu'],
  },
] as const;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the full, immutable list of contractor actions. Consumers
 * filter this list with the helpers below (or inline predicates) to
 * render only the actions that apply to their surface + row state.
 */
export function getContractorActions(): readonly ContractorAction[] {
  return REGISTRY;
}

/**
 * Actions allowed in the bulk-selection toolbar. Bulk actions are
 * inherently stage-independent (they operate over a heterogeneous
 * selection), so we ignore `visibleStages` / `hiddenWhen` here.
 */
export function getBulkContractorActions(): readonly ContractorAction[] {
  return REGISTRY.filter(action => action.surfaces.includes('bulk'));
}

/**
 * Actions applicable to a single contractor on the profile detail
 * surface. Filters by:
 *   1. surface (`profile`)
 *   2. `visibleStages` (lifecycle gate)
 *   3. `hiddenWhen` (custom predicate)
 */
export function getProfileContractorActions(row: ContractorRowLike): readonly ContractorAction[] {
  return REGISTRY.filter(action => isActionVisible(action, 'profile', row));
}

/**
 * Actions applicable in a row context menu. Same filtering as profile,
 * but uses the `rowMenu` surface.
 */
export function getRowMenuContractorActions(row: ContractorRowLike): readonly ContractorAction[] {
  return REGISTRY.filter(action => isActionVisible(action, 'rowMenu', row));
}

function isActionVisible(
  action: ContractorAction,
  surface: ContractorActionSurface,
  row: ContractorRowLike,
): boolean {
  if (!action.surfaces.includes(surface)) return false;
  if (
    action.visibleStages &&
    !action.visibleStages.includes(row.lifecycleStage as ContractorLifecycleStage)
  ) {
    return false;
  }
  if (action.hiddenWhen?.(row)) return false;
  return true;
}
