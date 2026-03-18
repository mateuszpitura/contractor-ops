"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OrgSettingsForm } from "@/components/settings/org-settings-form";
import { useRouter } from "next/navigation";

/**
 * Organization settings page.
 * Tabs: General (org settings form) and Members (links to members page).
 * Only accessible to users with settings.read permission.
 */
export default function SettingsPage() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[20px] font-semibold">Organization settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your organization preferences and team
        </p>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger
            value="members"
            onClick={() => router.push("/en/settings/members")}
          >
            Members
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-6">
          <OrgSettingsForm />
        </TabsContent>
      </Tabs>
    </div>
  );
}
