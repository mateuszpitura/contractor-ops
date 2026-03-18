"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
import { UsersTable } from "@/components/settings/users-table";
import { InviteDialog } from "@/components/settings/invite-dialog";
import { usePermissions } from "@/hooks/use-permissions";
import { useTranslations } from "next-intl";

/**
 * Team members page.
 * Shows user management table with invite button (for admins).
 */
export default function MembersPage() {
  const t = useTranslations("Users");
  const [inviteOpen, setInviteOpen] = useState(false);
  const { can } = usePermissions();

  const canInvite = can("member", ["create"]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>

        {canInvite && (
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            {t("inviteCta")}
          </Button>
        )}
      </div>

      <UsersTable />

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </div>
  );
}
