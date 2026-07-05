import type { FlagKey } from '@contractor-ops/feature-flags/browser';
import type { LucideIcon } from 'lucide-react';
import {
  Banknote,
  BarChart3,
  Bell,
  Building2,
  CheckCircle,
  Clock,
  FileText,
  GitBranch,
  Inbox,
  Landmark,
  LayoutDashboard,
  Package,
  Receipt,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react';

export type NavItemKey = string;
export type NavGroupKey = string;

export interface NavItem {
  key: NavItemKey;
  label: string;
  href: string;
  icon: LucideIcon;
  permission: { resource: string; actions: string[] } | null;
  flag?: FlagKey;
}

export interface NavGroup {
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
      {
        key: 'classification',
        label: 'Classification',
        href: '/classification',
        icon: ShieldCheck,
        permission: { resource: 'contractor', actions: ['read'] },
        flag: 'module.classification-engine',
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
      {
        key: 'taxFiling',
        label: 'Tax filing',
        href: '/tax-filing',
        icon: Landmark,
        permission: { resource: 'contractor', actions: ['read'] },
        flag: 'module.us-expansion',
      },
    ],
  },
  {
    key: 'system',
    items: [
      {
        key: 'organization',
        label: 'Organization',
        href: '/organization',
        icon: Building2,
        permission: { resource: 'team', actions: ['read'] },
      },
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

export const navigationItems: NavItem[] = navigationGroups.flatMap(group => group.items);
