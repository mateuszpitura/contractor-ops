import type { FlagKey } from '@contractor-ops/feature-flags';
import type { LucideIcon } from 'lucide-react';
import {
  Banknote,
  BarChart3,
  Bell,
  CheckCircle,
  Clock,
  FileText,
  GitBranch,
  Inbox,
  LayoutDashboard,
  Package,
  Receipt,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react';
import type { LeafKeysOf } from '@/types/next-intl';
import type messages from '../../messages/en.json';

/**
 * Translation keys valid for sidebar nav items — string-leaf keys of the
 * `Navigation` namespace, excluding the nested `groups` sub-object. Anchoring
 * `NavItem.key` to this union means adding a nav item without a matching
 * Navigation.<key> string in en.json fails tsc rather than throwing
 * MISSING_MESSAGE at runtime.
 *
 * Derived directly from `typeof messages.Navigation` (no module
 * augmentation needed); the audit-i18n-code-coverage.ts auditor handles
 * the broader "is every t() call resolvable" question across the codebase.
 */
export type NavItemKey = LeafKeysOf<typeof messages.Navigation>;

/** Translation keys valid for sidebar group labels. */
export type NavGroupKey = Extract<keyof typeof messages.Navigation.groups, string> | 'overview';

/**
 * Navigation item definition for the sidebar.
 * Each item has a permission requirement for visibility filtering.
 */
export interface NavItem {
  /** Must resolve to a string leaf under `Navigation.<key>` in en.json. */
  key: NavItemKey;
  label: string;
  href: string;
  icon: LucideIcon;
  /** Permission required to see this item. Null means always visible. */
  permission: { resource: string; actions: string[] } | null;
  /**
   * Feature flag required to see this item. When set, the nav item is hidden
   * unless the flag resolves to `true` for the current user/org. Stack with
   * `permission` — both must pass for the item to appear.
   */
  flag?: FlagKey;
}

/**
 * Navigation groups for the sidebar.
 * Items within each group are filtered by the user's role permissions.
 */
export interface NavGroup {
  /** Either the literal "overview" (label-less first group) or a key under `Navigation.groups`. */
  key: NavGroupKey;
  items: NavItem[];
}

export const navigationGroups: NavGroup[] = [
  {
    key: 'overview',
    items: [
      {
        key: 'dashboard',
        label: 'Dashboard',
        href: '/',
        icon: LayoutDashboard,
        permission: null,
      },
    ],
  },
  {
    key: 'operations',
    items: [
      {
        key: 'contractors',
        label: 'Contractors',
        href: '/contractors',
        icon: Users,
        permission: { resource: 'contractor', actions: ['read'] },
      },
      {
        key: 'contracts',
        label: 'Contracts',
        href: '/contracts',
        icon: FileText,
        permission: { resource: 'contract', actions: ['read'] },
      },
      {
        key: 'workflows',
        label: 'Workflows',
        href: '/workflows',
        icon: GitBranch,
        permission: { resource: 'workflow', actions: ['read'] },
      },
      {
        key: 'equipment',
        label: 'Equipment',
        href: '/equipment',
        icon: Package,
        permission: { resource: 'equipment', actions: ['read'] },
      },
      // Phase 64 D-03 — Classification nav item (LEGAL-08). Hidden when flag is off.
      {
        key: 'classification',
        label: 'Classification',
        href: '/classification',
        icon: ShieldCheck,
        permission: { resource: 'contractor', actions: ['read'] },
        flag: 'module.classification-engine' as const satisfies FlagKey,
      },
    ],
  },
  {
    key: 'finance',
    items: [
      {
        key: 'invoices',
        label: 'Invoices',
        href: '/invoices',
        icon: Receipt,
        permission: { resource: 'invoice', actions: ['read'] },
      },
      {
        key: 'imports',
        label: 'Imports',
        href: '/invoices/intake',
        icon: Inbox,
        permission: { resource: 'invoice', actions: ['read'] },
        flag: 'einvoice.import-enabled',
      },
      {
        key: 'approvals',
        label: 'Approvals',
        href: '/approvals',
        icon: CheckCircle,
        permission: { resource: 'invoice', actions: ['approve'] },
      },
      {
        key: 'time',
        label: 'Time',
        href: '/time',
        icon: Clock,
        permission: { resource: 'time', actions: ['read'] },
      },
      {
        key: 'payments',
        label: 'Payments',
        href: '/payments',
        icon: Banknote,
        permission: { resource: 'payment', actions: ['read'] },
      },
      {
        key: 'reports',
        label: 'Reports',
        href: '/reports',
        icon: BarChart3,
        permission: { resource: 'report', actions: ['read'] },
      },
    ],
  },
  {
    key: 'system',
    items: [
      {
        key: 'notifications',
        label: 'Notifications',
        href: '/notifications',
        icon: Bell,
        permission: null,
      },
      {
        key: 'settings',
        label: 'Settings',
        href: '/settings',
        icon: Settings,
        permission: { resource: 'settings', actions: ['read'] },
      },
    ],
  },
];

/**
 * Flat list of all navigation items (for backward compatibility).
 */
export const navigationItems: NavItem[] = navigationGroups.flatMap(group => group.items);
