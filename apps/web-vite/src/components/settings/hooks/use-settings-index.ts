import { parseAsString, useQueryState } from 'nuqs';
import { useCallback, useMemo } from 'react';

import { usePermissions } from '../../../hooks/use-permissions.js';
import { useSettingsTabPins } from '../../../hooks/use-settings-tab-pins.js';
import { useRouter } from '../../../i18n/navigation.js';
import { tDyn } from '../../../i18n/typed-keys.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import type { SettingsTabKey } from '../../../lib/settings-tabs.js';
import { isRoutedSettingsTab, SETTINGS_TABS } from '../../../lib/settings-tabs.js';

export interface RenderableSettingsTab {
  key: SettingsTabKey;
  label: string;
  pinned: boolean;
  routed: boolean;
  pinAriaLabel: string;
  unpinAriaLabel: string;
}

export interface UseSettingsIndexResult {
  activeTab: string;
  onSettingsTabChange: (value: string) => void;
  tabsToRender: RenderableSettingsTab[];
  canManageIntegrations: boolean;
  canManageBilling: boolean;
  canViewAuditLog: boolean;
  isPlatformAdmin: boolean;
  pinPending: boolean;
  togglePin: (key: SettingsTabKey) => void;
}

/**
 * Drives settings index page (`SettingsIndexContent`): resolves the active nuqs tab, builds the
 * permission-gated list of renderable tabs (with i18n labels + pin aria
 * labels), and routes routed-tabs (`members`, `workflow-roles`, `tax`) to
 * their dedicated sub-pages while non-routed tabs stay on `?tab=`.
 */
export function useSettingsIndex(): UseSettingsIndexResult {
  const t = useTranslations('Settings');
  const tPin = useTranslations('Settings.pin');
  const router = useRouter();
  const { can, isPlatformAdmin } = usePermissions();
  const { isPinned, toggle: togglePin, isPending: pinPending } = useSettingsTabPins();

  const [activeTab] = useQueryState('tab', parseAsString.withDefault('general'));

  const onSettingsTabChange = useCallback(
    (value: string) => {
      if (value === 'members') {
        void router.push('/settings/members');
        return;
      }
      if (value === 'workflow-roles') {
        void router.push('/settings/workflow-roles');
        return;
      }
      if (value === 'tax') {
        void router.push('/settings/tax');
        return;
      }
      void router.replace(`/settings?tab=${value}`);
    },
    [router],
  );

  const canManageIntegrations = can('organization', ['update']);
  const canManageBilling = can('organization', ['update']);
  const canViewAuditLog = can('settings', ['read']);
  const canViewTaxAdmin = can('settings', ['read']);

  const tabsToRender = useMemo<RenderableSettingsTab[]>(() => {
    return SETTINGS_TABS.filter(tab => {
      if (tab.key === 'integrations') return canManageIntegrations;
      if (tab.key === 'billing') return canManageBilling;
      if (tab.key === 'audit-log') return canViewAuditLog;
      if (tab.key === 'api-keys') return canManageIntegrations;
      if (tab.key === 'feature-flags') return isPlatformAdmin;
      if (tab.key === 'tax') return canViewTaxAdmin;
      return true;
    }).map(tab => {
      const label = tDyn(t, 'tabs', tab.i18nKey);
      return {
        key: tab.key,
        label,
        pinned: isPinned(tab.key),
        routed: isRoutedSettingsTab(tab.key),
        pinAriaLabel: tPin('pin', { tab: label }),
        unpinAriaLabel: tPin('unpin', { tab: label }),
      };
    });
  }, [
    t,
    tPin,
    isPinned,
    canManageIntegrations,
    canManageBilling,
    canViewAuditLog,
    canViewTaxAdmin,
    isPlatformAdmin,
  ]);

  return {
    activeTab,
    onSettingsTabChange,
    tabsToRender,
    canManageIntegrations,
    canManageBilling,
    canViewAuditLog,
    isPlatformAdmin,
    pinPending,
    togglePin,
  };
}
