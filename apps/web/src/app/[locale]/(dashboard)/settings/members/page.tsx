"use client";

import { UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { InviteDialog } from "@/components/settings/invite-dialog";
import { UsersTable } from "@/components/settings/users-table";
import { AnimateIn } from "@/components/shared/animate-in";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/use-permissions";

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
      <AnimateIn delay={0}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-[22px] font-semibold leading-tight tracking-tight">
              {t("title")}
            </h1>
            <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
          </div>

          {canInvite && (
            <Button onClick={() => setInviteOpen(true)}>
              <UserPlus className="me-2 h-4 w-4" />
              {t("inviteCta")}
            </Button>
          )}
        </div>
      </AnimateIn>

      <AnimateIn delay={1}>
        <UsersTable />
      </AnimateIn>

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </div>
  );
}
