"use client";

import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { InvoiceSubmitForm } from "@/components/portal/invoice-submit-form";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

// ---------------------------------------------------------------------------
// Submit Invoice Page
// ---------------------------------------------------------------------------

export default function PortalInvoiceSubmitPage() {
  const t = useTranslations("Portal");

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Link href="/portal/invoices">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="me-1.5 h-4 w-4" />
          {t("submitInvoice.back")}
        </Button>
      </Link>

      {/* Heading */}
      <h1 className="text-xl font-semibold">{t("submitInvoice.title")}</h1>

      {/* Form */}
      <div className="max-w-2xl">
        <InvoiceSubmitForm />
      </div>
    </div>
  );
}
