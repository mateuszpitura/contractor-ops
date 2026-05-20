import type { LucideIcon } from 'lucide-react';
import {
  Bell,
  Building2,
  FileLock2,
  Flag,
  Key,
  Percent,
  Plug,
  Receipt,
  ScrollText,
  ShieldCheck,
  Users,
  Users2,
} from 'lucide-react';
import type messages from '../../messages/en.json';

/**
 * Canonical list of pinnable settings tabs surfaced on `/settings`.
 *
 * This is the single source of truth used by:
 *  - the settings page → which `<TabsTrigger>` renders, label + icon, pin button wiring
 *  - the sidebar → rendering the user's pinned settings tabs in the `system` group
 *  - the tRPC procedures → validating the `key` payload for `user.pins.toggle`
 */
export type SettingsTabKey =
  | 'general'
  | 'approvals'
  | 'notifications'
  | 'integrations'
  | 'billing'
  | 'audit-log'
  | 'privacy'
  | 'api-keys'
  | 'feature-flags'
  | 'members'
  | 'workflow-roles'
  | 'tax';

/** Translation leaf keys nested under `Settings.tabs` in `messages/*.json`. */
export type SettingsTabI18nKey = Extract<keyof typeof messages.Settings.tabs, string>;

export interface SettingsTabPermission {
  resource: string;
  actions: string[];
}

export interface SettingsTabDef {
  key: SettingsTabKey;
  /** Resolves to `Settings.tabs.<i18nKey>`. */
  i18nKey: SettingsTabI18nKey;
  /** Icon used both in the pin button (filled `Pin` is layered separately) and in the sidebar pinned-entry. */
  icon: LucideIcon;
  /** RBAC requirement mirrored from the settings page; `null` = always visible. */
  permission: SettingsTabPermission | null;
  /**
   * When true, the tab requires the Better Auth platform admin role
   * (`User.role === 'admin'`) — not just an org-level permission. Used
   * for cross-tenant operations (e.g. Feature flags).
   */
  platformAdmin?: boolean;
}

export const SETTINGS_TABS: readonly SettingsTabDef[] = [
  { key: 'general', i18nKey: 'general', icon: Building2, permission: null },
  { key: 'approvals', i18nKey: 'approvals', icon: ShieldCheck, permission: null },
  { key: 'notifications', i18nKey: 'notifications', icon: Bell, permission: null },
  {
    key: 'integrations',
    i18nKey: 'integrations',
    icon: Plug,
    permission: { resource: 'organization', actions: ['update'] },
  },
  {
    key: 'billing',
    i18nKey: 'billing',
    icon: Receipt,
    permission: { resource: 'organization', actions: ['update'] },
  },
  {
    key: 'audit-log',
    i18nKey: 'auditLog',
    icon: ScrollText,
    permission: { resource: 'settings', actions: ['read'] },
  },
  { key: 'privacy', i18nKey: 'privacy', icon: FileLock2, permission: null },
  {
    key: 'api-keys',
    i18nKey: 'apiKeys',
    icon: Key,
    permission: { resource: 'organization', actions: ['update'] },
  },
  {
    key: 'feature-flags',
    i18nKey: 'featureFlags',
    icon: Flag,
    permission: null,
    platformAdmin: true,
  },
  { key: 'members', i18nKey: 'members', icon: Users, permission: null },
  { key: 'workflow-roles', i18nKey: 'workflowRoles', icon: Users2, permission: null },
  {
    key: 'tax',
    i18nKey: 'tax',
    icon: Percent,
    permission: { resource: 'settings', actions: ['read'] },
  },
] as const;

/**
 * Tab keys that live on dedicated routes under `/settings/<key>` rather than
 * inline tab panels. The settings page's tab loop must skip these (clicking
 * their trigger routes away), and the sidebar uses the canonical route URL
 * instead of `?tab=...` for these entries.
 */
const ROUTED_TAB_KEYS: ReadonlySet<SettingsTabKey> = new Set<SettingsTabKey>([
  'members',
  'workflow-roles',
  'tax',
]);

export function isRoutedSettingsTab(key: SettingsTabKey): boolean {
  return ROUTED_TAB_KEYS.has(key);
}

/** Where a pinned sidebar entry for this tab should point. */
export function getSettingsTabHref(key: SettingsTabKey): string {
  return isRoutedSettingsTab(key) ? `/settings/${key}` : `/settings?tab=${key}`;
}

const TAB_KEY_SET: ReadonlySet<SettingsTabKey> = new Set(SETTINGS_TABS.map(tab => tab.key));

export function isSettingsTabKey(value: string): value is SettingsTabKey {
  return TAB_KEY_SET.has(value as SettingsTabKey);
}

export function getSettingsTab(key: SettingsTabKey): SettingsTabDef {
  const tab = SETTINGS_TABS.find(t => t.key === key);
  if (!tab) {
    throw new Error(`Unknown settings tab key: ${key}`);
  }
  return tab;
}
