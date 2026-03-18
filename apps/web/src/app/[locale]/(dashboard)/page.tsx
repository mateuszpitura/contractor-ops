import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

/**
 * Dashboard home page.
 * Shows empty state with welcome message and CTA to add first contractor.
 */
export default function DashboardPage() {
  const t = useTranslations("Dashboard.emptyState");

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <h1 className="text-[20px] font-semibold">
        {t("heading")}
      </h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        {t("body")}
      </p>
      <Button render={<Link href="/contractors/new" />} className="mt-6">
        {t("cta")}
      </Button>
    </div>
  );
}
