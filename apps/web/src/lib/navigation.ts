import {
  LayoutDashboard,
  Users,
  FileText,
  GitBranch,
  Receipt,
  CheckCircle,
  Clock,
  Banknote,
  BarChart3,
  Bell,
  Plug,
  Settings,
  Package,
  type LucideIcon,
} from "lucide-react";

/**
 * Navigation item definition for the sidebar.
 * Each item has a permission requirement for visibility filtering.
 */
export interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /** Permission required to see this item. Null means always visible. */
  permission: { resource: string; actions: string[] } | null;
}

/**
 * Navigation groups for the sidebar.
 * Items within each group are filtered by the user's role permissions.
 */
export interface NavGroup {
  key: string;
  items: NavItem[];
}

export const navigationGroups: NavGroup[] = [
  {
    key: "overview",
    items: [
      {
        key: "dashboard",
        label: "Dashboard",
        href: "/",
        icon: LayoutDashboard,
        permission: null,
      },
    ],
  },
  {
    key: "operations",
    items: [
      {
        key: "contractors",
        label: "Contractors",
        href: "/contractors",
        icon: Users,
        permission: { resource: "contractor", actions: ["read"] },
      },
      {
        key: "contracts",
        label: "Contracts",
        href: "/contracts",
        icon: FileText,
        permission: { resource: "contract", actions: ["read"] },
      },
      {
        key: "workflows",
        label: "Workflows",
        href: "/workflows",
        icon: GitBranch,
        permission: { resource: "workflow", actions: ["read"] },
      },
      {
        key: "equipment",
        label: "Equipment",
        href: "/equipment",
        icon: Package,
        permission: { resource: "equipment", actions: ["read"] },
      },
    ],
  },
  {
    key: "finance",
    items: [
      {
        key: "invoices",
        label: "Invoices",
        href: "/invoices",
        icon: Receipt,
        permission: { resource: "invoice", actions: ["read"] },
      },
      {
        key: "approvals",
        label: "Approvals",
        href: "/approvals",
        icon: CheckCircle,
        permission: { resource: "invoice", actions: ["approve"] },
      },
      {
        key: "time",
        label: "Time",
        href: "/time",
        icon: Clock,
        permission: { resource: "time", actions: ["read"] },
      },
      {
        key: "payments",
        label: "Payments",
        href: "/payments",
        icon: Banknote,
        permission: { resource: "payment", actions: ["read"] },
      },
      {
        key: "reports",
        label: "Reports",
        href: "/reports",
        icon: BarChart3,
        permission: { resource: "report", actions: ["read"] },
      },
    ],
  },
  {
    key: "system",
    items: [
      {
        key: "integrations",
        label: "Integrations",
        href: "/settings?tab=integrations",
        icon: Plug,
        permission: { resource: "integration", actions: ["read"] },
      },
      {
        key: "notifications",
        label: "Notifications",
        href: "/notifications",
        icon: Bell,
        permission: null,
      },
      {
        key: "settings",
        label: "Settings",
        href: "/settings",
        icon: Settings,
        permission: { resource: "settings", actions: ["read"] },
      },
    ],
  },
];

/**
 * Flat list of all navigation items (for backward compatibility).
 */
export const navigationItems: NavItem[] = navigationGroups.flatMap(
  (group) => group.items,
);
