'use client';

import { AtelierPageHeader } from '@contractor-ops/ui';
import { Pin, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { parseAsString, useQueryState } from 'nuqs';
import { Suspense, useCallback, useMemo } from 'react';
import { BillingTab } from '@/components/billing/billing-tab';
import { ConsentManagementSection } from '@/components/consent/consent-management-section';
import { EInvoiceComplianceDetail } from '@/components/einvoice/compliance-detail';
import { AdminBrandingSection } from '@/components/settings/admin-branding-section';
import { ApiKeysTab } from '@/components/settings/api-keys-tab';
import { ApprovalChainsTab } from '@/components/settings/approval-chains-tab';
import { AuditLogTab } from '@/components/settings/audit-log-tab';
import { ExpiryReminderDefaults } from '@/components/settings/expiry-reminder-defaults';
import { GdprDataRightsSection } from '@/components/settings/gdpr-data-rights-section';
import { IntegrationsTab } from '@/components/settings/integrations-tab';
import { InvoiceMatchingSettings } from '@/components/settings/invoice-matching-settings';
import { LanguageCard } from '@/components/settings/language-card';
import { NotificationPreferences } from '@/components/settings/notification-preferences';
import { OrgSettingsForm } from '@/components/settings/org-settings-form';
import { OutOfOfficeSection } from '@/components/settings/out-of-office-section';
import { PinTabButton } from '@/components/settings/pin-tab-button';
import { PortalSubdomainSection } from '@/components/settings/portal-subdomain-section';
import { ReminderRulesSection } from '@/components/settings/reminder-rules-section';
import { SettingsTabsScroller } from '@/components/settings/settings-tabs-scroller';
import { TransferTitleSettings } from '@/components/settings/transfer-title-settings';
import { AnimateIn } from '@/components/shared/animate-in';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePermissions } from '@/hooks/use-permissions';
import { useSettingsTabPins } from '@/hooks/use-settings-tab-pins';
import { Link, useRouter } from '@/i18n/navigation';
import type { SettingsTabKey } from '@/lib/settings-tabs';
import { isRoutedSettingsTab, SETTINGS_TABS } from '@/lib/settings-tabs';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Inner content (uses nuqs, needs Suspense boundary)
// ---------------------------------------------------------------------------

function SettingsContent() {
  const t = useTranslations('Settings');
  const tPin = useTranslations('Settings.pin');
  const router = useRouter();
  const { can } = usePermissions();
  const { isPinned, toggle: togglePin, isPending: pinPending } = useSettingsTabPins();

  // URL-synced tab state for deep linking (e.g. OAuth callback to ?tab=integrations)
  const [activeTab] = useQueryState('tab', parseAsString.withDefault('general'));

  const onSettingsTabChange = useCallback(
    (value: string) => {
      if (value === 'members') {
        router.push('/settings/members');
        return;
      }
      if (value === 'workflow-roles') {
        router.push('/settings/workflow-roles');
        return;
      }
      // Replace the URL with ONLY `?tab=<value>` so per-tab filter params
      // (audit-log search, pagination, etc.) don't leak across tabs.
      // nuqs picks up the new `tab` value from the URL on the next render.
      router.replace(`/settings?tab=${value}`);
    },
    [router],
  );
  const canManageIntegrations = can('organization', ['update']);
  const canManageBilling = can('organization', ['update']);
  const canViewAuditLog = can('settings', ['read']);

  type RenderableTab = {
    key: SettingsTabKey;
    label: string;
    pinned: boolean;
    /** Routed tabs (members, workflow-roles) have their own pages; the trigger
     *  navigates instead of activating a panel, so the inline pin button is
     *  suppressed — pinning happens on the dedicated page header. */
    routed: boolean;
    pinAriaLabel: string;
    unpinAriaLabel: string;
  };

  const tabsToRender: RenderableTab[] = useMemo(() => {
    return SETTINGS_TABS.filter(tab => {
      if (tab.key === 'integrations') return canManageIntegrations;
      if (tab.key === 'billing') return canManageBilling;
      if (tab.key === 'audit-log') return canViewAuditLog;
      if (tab.key === 'api-keys') return canManageIntegrations;
      return true;
    }).map(tab => {
      const label = t(`tabs.${tab.i18nKey}`);
      return {
        key: tab.key,
        label,
        pinned: isPinned(tab.key),
        routed: isRoutedSettingsTab(tab.key),
        pinAriaLabel: tPin('pin', { tab: label }),
        unpinAriaLabel: tPin('unpin', { tab: label }),
      };
    });
  }, [t, tPin, isPinned, canManageIntegrations, canManageBilling, canViewAuditLog]);

  return (
    <div className="space-y-6">
      <AnimateIn delay={0}>
        <AtelierPageHeader title={t('title')} description={t('subtitle')} />
      </AnimateIn>

      <AnimateIn delay={1}>
        <Tabs value={activeTab} onValueChange={onSettingsTabChange} className="w-full">
          <SettingsTabsScroller>
            <TabsList className="no-scrollbar max-w-full justify-start overflow-x-auto [&>*]:shrink-0">
              {tabsToRender.map(tab => {
                const isActive = activeTab === tab.key;
                // Routed tabs route away on click; their toggle lives on the
                // dedicated page header. They still surface a read-only pin
                // glyph indicator when pinned so the tab list stays in sync
                // with the sidebar.
                const showsIndicator = tab.routed && tab.pinned;
                const showsToggle = !tab.routed && (tab.pinned || isActive);
                return (
                  <TabsTrigger
                    key={tab.key}
                    value={tab.key}
                    className={cn('gap-1.5', (showsToggle || showsIndicator) && 'pe-1.5')}>
                    <span>{tab.label}</span>
                    {showsToggle && (
                      <PinTabButton
                        tabKey={tab.key}
                        tabLabel={tab.label}
                        pinned={tab.pinned}
                        active={isActive}
                        disabled={pinPending}
                        pinAriaLabel={tab.pinAriaLabel}
                        unpinAriaLabel={tab.unpinAriaLabel}
                        // biome-ignore lint/nursery/noJsxPropsBind: per-row callback
                        onToggle={() => togglePin(tab.key)}
                      />
                    )}
                    {showsIndicator && (
                      <Pin
                        aria-hidden="true"
                        className="h-3.5 w-3.5 shrink-0 rotate-45 fill-current text-primary"
                      />
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </SettingsTabsScroller>

          <TabsContent value="general" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('reimport.title')}</CardTitle>
                <CardDescription>{t('reimport.description')}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" render={<Link href="/onboarding/import" />}>
                  <RefreshCw className="h-4 w-4" />
                  {t('reimport.cta')}
                </Button>
              </CardContent>
            </Card>
            <LanguageCard />
            <OrgSettingsForm />
            <ExpiryReminderDefaults />
            <InvoiceMatchingSettings />
            <TransferTitleSettings />
            <AdminBrandingSection />
            <PortalSubdomainSection />
          </TabsContent>

          <TabsContent value="approvals" className="mt-6">
            <ApprovalChainsTab />
          </TabsContent>

          <TabsContent value="notifications" className="mt-6 space-y-8">
            <NotificationPreferences />
            <OutOfOfficeSection />
            <ReminderRulesSection />
          </TabsContent>

          {canManageIntegrations && (
            <TabsContent value="integrations" className="mt-6 space-y-8">
              <EInvoiceComplianceDetail />
              <IntegrationsTab />
            </TabsContent>
          )}

          {canManageBilling && (
            <TabsContent value="billing" className="mt-6 space-y-8">
              <BillingTab />
            </TabsContent>
          )}

          {canViewAuditLog && (
            <TabsContent value="audit-log" className="mt-6">
              <AuditLogTab />
            </TabsContent>
          )}

          <TabsContent value="privacy" className="mt-6 space-y-6">
            <ConsentManagementSection />
            <GdprDataRightsSection />
          </TabsContent>

          {canManageIntegrations && (
            <TabsContent value="api-keys" className="mt-6">
              <ApiKeysTab />
            </TabsContent>
          )}
        </Tabs>
      </AnimateIn>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page (with Suspense boundary for nuqs)
// ---------------------------------------------------------------------------

/**
 * Organization settings page.
 * Tabs: General, Approvals, Notifications, Integrations (admin), Members.
 * Tab state synced to URL via nuqs for deep linking (OAuth callback support).
 */
export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsContent />
    </Suspense>
  );
}
