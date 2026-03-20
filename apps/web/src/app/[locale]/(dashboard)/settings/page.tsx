"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OrgSettingsForm } from "@/components/settings/org-settings-form";
import { ExpiryReminderDefaults } from "@/components/settings/expiry-reminder-defaults";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

/**
 * Organization settings page.
 * Tabs: General (org settings form) and Members (links to members page).
 * Only accessible to users with settings.read permission.
 */
export default function SettingsPage() {
  const t = useTranslations("Settings");
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[20px] font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("subtitle")}
        </p>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList>
          <TabsTrigger value="general">{t("tabs.general")}</TabsTrigger>
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
