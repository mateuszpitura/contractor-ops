import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@contractor-ops/ui/components/shadcn/tabs';
import { Pin, RefreshCw } from 'lucide-react';
import { Suspense, useCallback } from 'react';

import { BillingTab } from '../../../components/billing/billing-tab.js';
import { ConsentManagementSection } from '../../../components/consent/consent-management-section.js';
import { EInvoiceComplianceDetail } from '../../../components/einvoice/compliance-detail.js';
import { AdminBrandingSection } from '../../../components/settings/admin-branding-section.js';
import { ApiKeysTab } from '../../../components/settings/api-keys-tab.js';
import { ApprovalChainsTab } from '../../../components/settings/approval-chains-tab.js';
import { AuditLogTab } from '../../../components/settings/audit-log-tab.js';
import { ContractorViewSetting } from '../../../components/settings/contractor-view-setting.js';
import { ExpiryReminderDefaults } from '../../../components/settings/expiry-reminder-defaults.js';
import { FeatureFlagsTab } from '../../../components/settings/feature-flags-tab.js';
import { GdprDataRightsSection } from '../../../components/settings/gdpr-data-rights-section.js';
import { useSettingsIndex } from '../../../components/settings/hooks/use-settings-index.js';
import { IntegrationsTab } from '../../../components/settings/integrations-tab.js';
import { InvoiceMatchingSettings } from '../../../components/settings/invoice-matching-settings.js';
import { LanguageCard } from '../../../components/settings/language-card.js';
import { NotificationPreferences } from '../../../components/settings/notification-preferences.js';
import { OrgSettingsFormContainer } from '../../../components/settings/org-settings-form.js';
import { OutOfOfficeSection } from '../../../components/settings/out-of-office-section.js';
import { PinTabButton } from '../../../components/settings/pin-tab-button.js';
import { PortalSubdomainSection } from '../../../components/settings/portal-subdomain-section.js';
import { ReminderRulesSection } from '../../../components/settings/reminder-rules-section.js';
import { SettingsTabsScroller } from '../../../components/settings/settings-tabs-scroller.js';
import { TransferTitleSettings } from '../../../components/settings/transfer-title-settings.js';
import { AnimateIn } from '../../../components/shared/animate-in.js';
import { PageLoadingSpinner } from '../../../components/shared/page-loading-spinner.js';
import { WorkbenchPageHeader } from '../../../components/shared/workbench-page-header.js';
import { Link } from '../../../i18n/navigation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import type { SettingsTabKey } from '../../../lib/settings-tabs.js';
import { cn } from '../../../lib/utils.js';

function PinTabToggle({
  tabKey,
  tabLabel,
  pinned,
  active,
  disabled,
  pinAriaLabel,
  unpinAriaLabel,
  onTogglePin,
}: {
  tabKey: SettingsTabKey;
  tabLabel: string;
  pinned: boolean;
  active: boolean;
  disabled?: boolean;
  pinAriaLabel: string;
  unpinAriaLabel: string;
  onTogglePin: (key: SettingsTabKey) => void;
}) {
  const handleToggle = useCallback(() => onTogglePin(tabKey), [onTogglePin, tabKey]);
  return (
    <PinTabButton
      tabKey={tabKey}
      tabLabel={tabLabel}
      pinned={pinned}
      active={active}
      disabled={disabled}
      pinAriaLabel={pinAriaLabel}
      unpinAriaLabel={unpinAriaLabel}
      onToggle={handleToggle}
    />
  );
}

function SettingsIndexContent() {
  const t = useTranslations('Settings');
  const {
    activeTab,
    onSettingsTabChange,
    tabsToRender,
    canManageIntegrations,
    canManageBilling,
    canViewAuditLog,
    isPlatformAdmin,
    pinPending,
    togglePin,
  } = useSettingsIndex();

  return (
    <div className="space-y-6">
      <AnimateIn delay={0}>
        <WorkbenchPageHeader title={t('title')} description={t('subtitle')} />
      </AnimateIn>

      <AnimateIn delay={1}>
        <Tabs value={activeTab} onValueChange={onSettingsTabChange} className="w-full">
          <SettingsTabsScroller>
            <TabsList className="no-scrollbar max-w-full justify-start overflow-x-auto [&>*]:shrink-0">
              {tabsToRender.map(tab => {
                const isActive = activeTab === tab.key;
                const showsIndicator = tab.routed && tab.pinned;
                const showsToggle = !tab.routed && (tab.pinned || isActive);
                return (
                  <TabsTrigger
                    key={tab.key}
                    value={tab.key}
                    className={cn('gap-1.5', (showsToggle || showsIndicator) && 'pe-1.5')}>
                    <span>{tab.label}</span>
                    {showsToggle && (
                      <PinTabToggle
                        tabKey={tab.key}
                        tabLabel={tab.label}
                        pinned={tab.pinned}
                        active={isActive}
                        disabled={pinPending}
                        pinAriaLabel={tab.pinAriaLabel}
                        unpinAriaLabel={tab.unpinAriaLabel}
                        onTogglePin={togglePin}
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
            <ContractorViewSetting />
            <OrgSettingsFormContainer />
            <ExpiryReminderDefaults />
            <InvoiceMatchingSettings />
            <TransferTitleSettings />
            <AdminBrandingSection />
            <PortalSubdomainSection />
          </TabsContent>

          <TabsContent value="approvals" className="mt-6 flex min-h-[60vh] flex-col">
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
            <TabsContent value="audit-log" className="mt-6 flex min-h-0 flex-1 flex-col">
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

          {isPlatformAdmin && (
            <TabsContent value="feature-flags" className="mt-6">
              <FeatureFlagsTab />
            </TabsContent>
          )}
        </Tabs>
      </AnimateIn>
    </div>
  );
}

export default function SettingsIndexPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <SettingsIndexContent />
    </Suspense>
  );
}
