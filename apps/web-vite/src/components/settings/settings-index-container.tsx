/**
 * Organization settings — Step 10 batch 8 port from
 * apps/web/src/app/[locale]/(dashboard)/settings/page.tsx.
 */

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
import { Link } from '../../i18n/navigation.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import type { SettingsTabKey } from '../../lib/settings-tabs.js';
import { cn } from '../../lib/utils.js';
import { BillingTabContainer } from '../billing/billing-tab-container.js';
import { ConsentManagementSectionContainer } from '../consent/consent-management-section-container.js';
import { EInvoiceComplianceDetail } from '../einvoice/compliance-detail-container.js';
import { AnimateIn } from '../shared/animate-in.js';
import { WorkbenchPageHeader } from '../shared/workbench-page-header.js';
import { AdminBrandingSectionContainer } from './admin-branding-section-container.js';
import { ApiKeysTabContainer } from './api-keys-tab-container.js';
import { ApprovalChainsTabContainer } from './approval-chains-tab-container.js';
import { AuditLogTabContainer } from './audit-log-tab-container.js';
import { ExpiryReminderDefaultsContainer } from './expiry-reminder-defaults-container.js';
import { FeatureFlagsTabContainer } from './feature-flags-tab-container.js';
import { GdprDataRightsSectionContainer } from './gdpr-data-rights-section-container.js';
import { useSettingsIndex } from './hooks/use-settings-index.js';
import { IntegrationsTabContainer } from './integrations-tab-container.js';
import { InvoiceMatchingSettingsContainer } from './invoice-matching-settings-container.js';
import { LanguageCard } from './language-card.js';
import { NotificationPreferencesContainer } from './notification-preferences-container.js';
import { OrgSettingsFormContainer } from './org-settings-form-container.js';
import { OutOfOfficeSectionContainer } from './out-of-office-section-container.js';
import { PinTabButton } from './pin-tab-button.js';
import { PortalSubdomainSectionContainer } from './portal-subdomain-section-container.js';
import { ReminderRulesSectionContainer } from './reminder-rules-section-container.js';
import { SettingsTabsScroller } from './settings-tabs-scroller.js';
import { TransferTitleSettingsContainer } from './transfer-title-settings-container.js';

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

function SettingsContent() {
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
            <OrgSettingsFormContainer />
            <ExpiryReminderDefaultsContainer />
            <InvoiceMatchingSettingsContainer />
            <TransferTitleSettingsContainer />
            <AdminBrandingSectionContainer />
            <PortalSubdomainSectionContainer />
          </TabsContent>

          <TabsContent value="approvals" className="mt-6 flex min-h-[60vh] flex-col">
            <ApprovalChainsTabContainer />
          </TabsContent>

          <TabsContent value="notifications" className="mt-6 space-y-8">
            <NotificationPreferencesContainer />
            <OutOfOfficeSectionContainer />
            <ReminderRulesSectionContainer />
          </TabsContent>

          {canManageIntegrations && (
            <TabsContent value="integrations" className="mt-6 space-y-8">
              <EInvoiceComplianceDetail />
              <IntegrationsTabContainer />
            </TabsContent>
          )}

          {canManageBilling && (
            <TabsContent value="billing" className="mt-6 space-y-8">
              <BillingTabContainer />
            </TabsContent>
          )}

          {canViewAuditLog && (
            <TabsContent value="audit-log" className="mt-6 flex min-h-0 flex-1 flex-col">
              <AuditLogTabContainer />
            </TabsContent>
          )}

          <TabsContent value="privacy" className="mt-6 space-y-6">
            <ConsentManagementSectionContainer />
            <GdprDataRightsSectionContainer />
          </TabsContent>

          {canManageIntegrations && (
            <TabsContent value="api-keys" className="mt-6">
              <ApiKeysTabContainer />
            </TabsContent>
          )}

          {isPlatformAdmin && (
            <TabsContent value="feature-flags" className="mt-6">
              <FeatureFlagsTabContainer />
            </TabsContent>
          )}
        </Tabs>
      </AnimateIn>
    </div>
  );
}

export function SettingsIndexContainer() {
  return (
    <Suspense>
      <SettingsContent />
    </Suspense>
  );
}
