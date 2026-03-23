"use client";

import { Suspense } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OrgSettingsForm } from "@/components/settings/org-settings-form";
import { ExpiryReminderDefaults } from "@/components/settings/expiry-reminder-defaults";
import { InvoiceMatchingSettings } from "@/components/settings/invoice-matching-settings";
import { TransferTitleSettings } from "@/components/settings/transfer-title-settings";
import { ApprovalChainsTab } from "@/components/settings/approval-chains-tab";
import { NotificationPreferences } from "@/components/settings/notification-preferences";
import { ReminderRulesSection } from "@/components/settings/reminder-rules-section";
import { IntegrationsTab } from "@/components/settings/integrations-tab";
import { AuditLogTab } from "@/components/settings/audit-log-tab";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { usePermissions } from "@/hooks/use-permissions";
import { parseAsString, useQueryState } from "nuqs";

// ---------------------------------------------------------------------------
// Inner content (uses nuqs, needs Suspense boundary)
// ---------------------------------------------------------------------------

function SettingsContent() {
  const t = useTranslations("Settings");
  const router = useRouter();
  const { can } = usePermissions();

  // URL-synced tab state for deep linking (e.g. OAuth callback to ?tab=integrations)
  const [activeTab, setActiveTab] = useQueryState(
    "tab",
    parseAsString.withDefault("general"),
  );

  const canManageIntegrations = can("organization", ["update"]);
  const canViewAuditLog = can("settings", ["read"]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[20px] font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val)} className="w-full">
        <TabsList>
          <TabsTrigger value="general">{t("tabs.general")}</TabsTrigger>
          <TabsTrigger value="approvals">{t("tabs.approvals")}</TabsTrigger>
          <TabsTrigger value="notifications">
            {t("tabs.notifications")}
          </TabsTrigger>
          {canManageIntegrations && (
            <TabsTrigger value="integrations">
              {t("tabs.integrations")}
            </TabsTrigger>
          )}
          {canViewAuditLog && (
            <TabsTrigger value="audit-log">
              {t("tabs.auditLog")}
            </TabsTrigger>
          )}
          <TabsTrigger
            value="members"
            onClick={() => router.push("/settings/members")}
          >
            {t("tabs.members")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-6 space-y-6">
          <OrgSettingsForm />
          <ExpiryReminderDefaults />
          <InvoiceMatchingSettings />
          <TransferTitleSettings />
        </TabsContent>

        <TabsContent value="approvals" className="mt-6">
          <ApprovalChainsTab />
        </TabsContent>

        <TabsContent value="notifications" className="mt-6 space-y-8">
          <NotificationPreferences />
          <ReminderRulesSection />
        </TabsContent>

        {canManageIntegrations && (
          <TabsContent value="integrations" className="mt-6 space-y-8">
            <IntegrationsTab />
          </TabsContent>
        )}

        {canViewAuditLog && (
          <TabsContent value="audit-log" className="mt-6">
            <AuditLogTab />
          </TabsContent>
        )}
      </Tabs>
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
