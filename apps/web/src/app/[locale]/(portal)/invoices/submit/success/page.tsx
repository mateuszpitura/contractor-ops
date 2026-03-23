"use client";

import { useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// ---------------------------------------------------------------------------
// Success Page
// ---------------------------------------------------------------------------

export default function PortalInvoiceSubmitSuccessPage() {
  const searchParams = useSearchParams();
  const invoiceId = searchParams.get("invoiceId");
  const invoiceNumber = searchParams.get("invoiceNumber");

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="mx-auto max-w-[600px] text-center">
        {/* Success icon */}
        <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center">
          <CheckCircle2 className="h-12 w-12 text-green-600" />
        </div>

        {/* Heading */}
        <h1 className="text-xl font-semibold">Invoice Submitted</h1>

        {/* Body */}
        <p className="mt-3 text-sm text-muted-foreground">
          Your invoice{invoiceNumber ? ` ${invoiceNumber}` : ""} has been
          submitted successfully. It will be reviewed by your organization.
        </p>

        {/* Next steps card */}
        <Card className="mt-6">
          <CardContent className="pt-4">
            <p className="text-sm">
              Expected next: Your organization will review the invoice. You can
              track its status on the Invoices page.
            </p>
          </CardContent>
        </Card>

        {/* CTAs */}
        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          {invoiceId && (
            <Link href={`/portal/invoices/${invoiceId}`}>
              <Button>Track Status</Button>
            </Link>
          )}
          <Link href="/portal/invoices/submit">
            <Button variant="outline">Submit Another Invoice</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
