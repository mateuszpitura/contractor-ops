"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Loader2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/trpc/init";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EmbeddedSigningModalProps = {
  envelopeId: string;
  recipientEmail: string;
  documentTitle: string;
  provider: "DOCUSIGN" | "AUTENTI";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
  usePortalAuth?: boolean;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Full-viewport overlay for embedded document signing.
 * Per UI-SPEC D-05: iframe for DocuSign, redirect fallback for Autenti.
 */
export function EmbeddedSigningModal({
  envelopeId,
  recipientEmail,
  documentTitle,
  provider,
  open,
  onOpenChange,
  onComplete,
  usePortalAuth,
}: EmbeddedSigningModalProps) {
  const tAria = useTranslations("Common.aria");
  const t = useTranslations("ContractDetail.signing.modal");
  const tToast = useTranslations("ContractDetail.signing.toast");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const returnUrl =
    typeof window !== "undefined" ? `${window.location.origin}/signing-complete` : "";

  const queryInput = { envelopeId, recipientEmail, returnUrl };
  const queryEnabled = { enabled: open && !!envelopeId && !!returnUrl };

  const signingUrlQuery = useQuery(
    usePortalAuth
      ? trpc.esign.getPortalSigningUrl.queryOptions(queryInput, queryEnabled)
      : trpc.esign.getSigningUrl.queryOptions(queryInput, queryEnabled),
  );

  const signingData = signingUrlQuery.data as
    | { embedded: boolean; url?: string; expiresAt?: string }
    | undefined;

  // Listen for postMessage from DocuSign iframe
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      // Only accept messages from DocuSign origins to prevent spoofing
      const trustedOrigins = [
        "https://app.docusign.com",
        "https://apps-d.docusign.com",
        "https://demo.docusign.net",
        "https://app-d.docusign.com",
      ];
      if (!trustedOrigins.some((o) => event.origin.startsWith(o))) return;

      // DocuSign embedded signing events
      if (typeof event.data === "string") {
        if (event.data === "signing_complete" || event.data.includes("signing_complete")) {
          toast.success(tToast("signedSuccess"));
          onComplete();
          onOpenChange(false);
        } else if (event.data === "decline" || event.data.includes("decline")) {
          toast.error(tToast("signingDeclined"));
          onOpenChange(false);
        } else if (event.data === "exception" || event.data.includes("exception")) {
          toast.error(tToast("signingFailed"));
          onOpenChange(false);
        }
      }

      // DocuSign may also send object-type messages
      if (typeof event.data === "object" && event.data !== null) {
        const data = event.data as { type?: string; event?: string };
        const eventType = data.type ?? data.event;
        if (eventType === "signing_complete") {
          toast.success(tToast("signedSuccess"));
          onComplete();
          onOpenChange(false);
        }
      }
    },
    [onComplete, onOpenChange, tToast],
  );

  useEffect(() => {
    if (!open) return;
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [open, handleMessage]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background">
      {/* Top bar */}
      <div className="flex h-14 items-center justify-between border-b px-4">
        <span className="text-sm font-semibold">{documentTitle}</span>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => onOpenChange(false)}
          aria-label={tAria("closeSigningModal")}
        >
          <X className="size-4" />
        </Button>
      </div>

      {/* Body */}
      <div className="h-[calc(100dvh-56px)]">
        {signingUrlQuery.isPending ? (
          /* Loading state */
          <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{t("preparing")}</p>
            </div>
          </div>
        ) : signingData?.embedded && signingData.url ? (
          /* Embedded iframe (DocuSign) */
          <iframe
            ref={iframeRef}
            src={signingData.url}
            className="h-full w-full border-0"
            title={t("signTitle", { title: documentTitle })}
            allow="camera; microphone"
          />
        ) : signingData?.url ? (
          /* Redirect fallback (Autenti) */
          <div className="flex h-full items-center justify-center">
            <Card className="max-w-[480px]">
              <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
                <p className="text-lg font-semibold">
                  {provider === "AUTENTI" ? "Autenti" : t("completeSigning")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("redirectMessage", {
                    provider: provider === "AUTENTI" ? "Autenti" : provider,
                  })}
                </p>
                <div className="flex gap-3">
                  <Button onClick={() => window.open(signingData.url, "_blank")}>
                    <ExternalLink className="me-1.5 size-4" />
                    {t("continueToProvider", {
                      provider: provider === "AUTENTI" ? "Autenti" : provider,
                    })}
                  </Button>
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    {t("returnToContract")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          /* Error state */
          <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-center">
              <p className="text-sm text-muted-foreground">{t("loadError")}</p>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t("returnToContract")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
