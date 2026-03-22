import {
  LayoutDashboard,
  Users,
  FileText,
  GitBranch,
  Receipt,
  CheckCircle,
  Banknote,
  BarChart3,
  Bell,
  Plug,
  Settings,
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
 * All 10 navigation items visible from day 1.
 * Items are filtered by the user's role permissions — unauthorized items are hidden.
 */
export const navigationItems: NavItem[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    permission: null, // Always visible to authenticated users
  },
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
  {
    key: "integrations",
    label: "Integrations",
    href: "/integrations",
    icon: Plug,
    permission: { resource: "integration", actions: ["read"] },
  },
  {
    key: "notifications",
    label: "Notifications",
    href: "/notifications",
    icon: Bell,
    permission: null, // Always visible to authenticated users
  },
  {
    key: "settings",
    label: "Settings",
    href: "/settings",
    icon: Settings,
    permission: { resource: "settings", actions: ["read"] },
  },
];
