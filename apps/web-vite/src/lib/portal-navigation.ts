import type { LucideIcon } from 'lucide-react';
import {
  Banknote,
  Clock,
  FileText,
  FolderOpen,
  LayoutDashboard,
  Package,
  Receipt,
  Settings,
} from 'lucide-react';

/** Portal top/mobile nav — single source for href + icon (labels stay in i18n). */
export const PORTAL_NAV_ITEMS = [
  { key: 'overview', href: '/portal', icon: LayoutDashboard },
  { key: 'contracts', href: '/portal/contracts', icon: FileText },
  { key: 'invoices', href: '/portal/invoices', icon: Receipt },
  { key: 'documents', href: '/portal/documents', icon: FolderOpen },
  { key: 'time', href: '/portal/time', icon: Clock },
  { key: 'equipment', href: '/portal/equipment', icon: Package },
  { key: 'payments', href: '/portal/payments', icon: Banknote },
  { key: 'settings', href: '/portal/settings', icon: Settings },
] as const satisfies ReadonlyArray<{ key: string; href: string; icon: LucideIcon }>;
