"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Cookie } from "lucide-react";

const COOKIE_CONSENT_KEY = "cookie-consent-acknowledged";

export function CookieConsentBanner() {
  const t = useTranslations("CookieConsent");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const acknowledged = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!acknowledged) {
      setVisible(true);
    }
  }, []);

  function handleAccept() {
    localStorage.setItem(COOKIE_CONSENT_KEY, new Date().toISOString());
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-[100] p-4 sm:p-6"
    >
      <div className="mx-auto flex max-w-lg flex-col items-start gap-3 rounded-xl border border-border bg-background/95 p-4 shadow-lg backdrop-blur-sm sm:flex-row sm:items-center sm:gap-4">
        <Cookie className="hidden size-5 shrink-0 text-muted-foreground sm:block" />
        <p className="flex-1 text-sm text-muted-foreground">
          {t("message")}{" "}
          <Link
            href="/privacy"
            className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
          >
            {t("learnMore")}
          </Link>
        </p>
        <Button
          size="sm"
          onClick={handleAccept}
          className="shrink-0"
        >
          {t("accept")}
        </Button>
      </div>
    </div>
  );
}
