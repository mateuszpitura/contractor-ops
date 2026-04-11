"use client";

import { useState, useRef, useEffect } from "react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  LogOut,
  Moon,
  Settings,
  ChevronsUpDown,
  Minimize2,
  Maximize2,
  Globe,
  UserPen,
  Loader2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";
import { getAvatarInitials } from "@/lib/avatar-initials";
import { useDensity } from "@/hooks/use-density";
import { useRouter, usePathname } from "@/i18n/navigation";
import { useLocale } from "next-intl";
import type { Locale } from "@/i18n/routing";

/**
 * User menu in the sidebar footer.
 * Shows avatar, name, email, and dropdown with:
 * - Settings link
 * - Dark mode toggle
 * - Density toggle (comfortable/compact)
 * - Language switcher
 * - Sign out
 */
export function UserMenu() {
  const t = useTranslations("Common");
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const { isMobile } = useSidebar();
  const { theme, setTheme } = useTheme();
  const { density, toggleDensity } = useDensity();
  const session = authClient.useSession();

  const user = session.data?.user;
  const initials = getAvatarInitials(
    user?.name,
    user?.email ?? undefined,
  );

  const [nameDialogOpen, setNameDialogOpen] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [nameSaving, setNameSaving] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (nameDialogOpen) {
      setNameValue(user?.name ?? "");
      setTimeout(() => nameInputRef.current?.select(), 50);
    }
  }, [nameDialogOpen, user?.name]);

  const handleSaveName = async () => {
    const trimmed = nameValue.trim();
    if (!trimmed || trimmed === user?.name) {
      setNameDialogOpen(false);
      return;
    }
    setNameSaving(true);
    try {
      await authClient.updateUser({ name: trimmed });
      toast.success(t("nameUpdated"));
      setNameDialogOpen(false);
    } catch {
      toast.error(t("nameUpdateFailed"));
    } finally {
      setNameSaving(false);
    }
  };

  const handleSignOut = async () => {
    await authClient.signOut();
    // Full page navigation to /login clears React Query cache, Zustand stores,
    // and all in-memory state — prevents stale data from the previous session.
    window.location.href = "/login";
  };

  const handleLocaleSwitch = () => {
    const nextLocale: Locale = locale === "pl" ? "en" : "pl";
    router.replace(pathname, { locale: nextLocale });
  };

  return (
    <>
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <SidebarMenuButton
            size="lg"
            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
          />
        }
      >
        <Avatar className="h-8 w-8 rounded-lg">
          <AvatarImage src={user?.image ?? undefined} alt={user?.name ?? ""} />
          <AvatarFallback className="rounded-lg text-xs">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="grid flex-1 text-start text-sm leading-tight">
          <span className="truncate font-semibold">
            {user?.name ?? "User"}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {user?.email ?? ""}
          </span>
        </div>
        <ChevronsUpDown className="ms-auto size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
        side={isMobile ? "bottom" : "right"}
        align="end"
        sideOffset={4}
      >
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex items-center gap-2 px-1 py-1.5 text-start text-sm">
            <Avatar className="h-8 w-8 rounded-lg">
              <AvatarImage
                src={user?.image ?? undefined}
                alt={user?.name ?? ""}
              />
              <AvatarFallback className="rounded-lg text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-start text-sm leading-tight">
              <span className="truncate font-semibold">
                {user?.name ?? "User"}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {user?.email ?? ""}
              </span>
            </div>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => setNameDialogOpen(true)}>
          <UserPen className="me-2 h-4 w-4" />
          {t("editName")}
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => router.push("/settings")}>
          <Settings className="me-2 h-4 w-4" />
          {t("settings")}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <div className="flex items-center justify-between px-2 py-1.5">
          <div className="flex items-center gap-2">
            <Moon className="h-4 w-4" />
            <span className="text-sm">{t("darkMode")}</span>
          </div>
          <Switch
            checked={theme === "dark"}
            onCheckedChange={(checked) => {
              document.documentElement.classList.add("theme-transition");
              setTheme(checked ? "dark" : "light");
              setTimeout(() => {
                document.documentElement.classList.remove("theme-transition");
              }, 350);
            }}
            aria-label={t("darkMode")}
          />
        </div>

        <div className="flex items-center justify-between px-2 py-1.5">
          <div className="flex items-center gap-2">
            {density === "compact" ? (
              <Maximize2 className="h-4 w-4" />
            ) : (
              <Minimize2 className="h-4 w-4" />
            )}
            <span className="text-sm">{t("density")}</span>
          </div>
          <Switch
            checked={density === "compact"}
            onCheckedChange={toggleDensity}
            aria-label={t("density")}
          />
        </div>

        <div className="flex items-center justify-between px-2 py-1.5">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            <span className="text-sm">{t("language")}</span>
          </div>
          <button
            type="button"
            onClick={handleLocaleSwitch}
            className="text-sm font-medium text-primary hover:underline"
          >
            {locale === "pl" ? "EN" : "PL"}
          </button>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={handleSignOut}>
          <LogOut className="me-2 h-4 w-4" />
          {t("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>

    {/* Edit name dialog */}
    <Dialog open={nameDialogOpen} onOpenChange={setNameDialogOpen}>
      <DialogContent className="sm:max-w-[360px]">
        <DialogHeader>
          <DialogTitle>{t("editName")}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSaveName();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="user-name">{t("editNamePrompt")}</Label>
            <Input
              ref={nameInputRef}
              id="user-name"
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              placeholder={t("editNamePrompt")}
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setNameDialogOpen(false)}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={nameSaving || !nameValue.trim()}>
              {nameSaving && <Loader2 className="me-1.5 size-3.5 animate-spin" />}
              {t("save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
    </>
  );
}
