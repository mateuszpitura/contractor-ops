"use client";

import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface KsefDuplicateBannerProps {
  duplicateInvoiceId: string;
  invoiceNumber: string;
  sellerNip: string;
  onVoid?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function KsefDuplicateBanner({
  duplicateInvoiceId,
  invoiceNumber,
  sellerNip,
  onVoid,
}: KsefDuplicateBannerProps) {
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);

  return (
    <>
      <div className="rounded-md border border-amber-500/30 border-l-4 border-l-amber-500 bg-amber-500/5 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden="true" />
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">KSeF Duplicate Found</h4>
            <p className="text-sm text-muted-foreground">
              A matching invoice was found in KSeF (invoice number{" "}
              <span className="font-medium text-foreground">{invoiceNumber}</span>, seller NIP{" "}
              <span className="font-medium text-foreground">{sellerNip}</span>
              ). The KSeF version is government-validated.
            </p>
            <div className="flex items-center gap-2">
              <Link
                href={`/invoices/${duplicateInvoiceId}`}
                className="text-sm text-primary hover:underline"
              >
                View KSeF Invoice
              </Link>
              {onVoid && (
                <Button variant="destructive" size="sm" onClick={() => setVoidDialogOpen(true)}>
                  Void This Invoice
                </Button>
              )}
              <Button variant="ghost" size="sm">
                Keep Both
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Void confirmation dialog */}
      <AlertDialog open={voidDialogOpen} onOpenChange={setVoidDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              This invoice will be marked as void. The KSeF version will remain as the authoritative
              record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Invoice</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                onVoid?.();
                setVoidDialogOpen(false);
              }}
            >
              Void Invoice
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
