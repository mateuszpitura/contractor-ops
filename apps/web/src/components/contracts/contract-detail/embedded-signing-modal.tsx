"use client";

import { useCallback, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { X, Loader2, ExternalLink } from "lucide-react";

import { trpc } from "@/trpc/init";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

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
}: EmbeddedSigningModalProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const returnUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/signing-complete`
      : "";

  const signingUrlQuery = useQuery(
    trpc.esign.getSigningUrl.queryOptions(
      {
        envelopeId,
        recipientEmail,
        returnUrl,
      },
      { enabled: open && !!envelopeId && !!returnUrl }
    )
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const signingData = signingUrlQuery.data as any as
    | { embedded: boolean; url?: string; expiresAt?: string }
    | undefined;

  // Listen for postMessage from DocuSign iframe
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      // DocuSign embedded signing events
      if (typeof event.data === "string") {
        if (
          event.data === "signing_complete" ||
          event.data.includes("signing_complete")
        ) {
          toast.success("Document signed successfully");
          onComplete();
          onOpenChange(false);
        } else if (
          event.data === "decline" ||
          event.data.includes("decline")
        ) {
          toast.error("Signing declined.");
          onOpenChange(false);
        } else if (
          event.data === "exception" ||
          event.data.includes("exception")
        ) {
          toast.error("Signing could not be completed. Please try again.");
          onOpenChange(false);
        }
      }

      // DocuSign may also send object-type messages
      if (typeof event.data === "object" && event.data !== null) {
        const data = event.data as { type?: string; event?: string };
        const eventType = data.type ?? data.event;
        if (eventType === "signing_complete") {
          toast.success("Document signed successfully");
          onComplete();
          onOpenChange(false);
        }
      }
    },
    [onComplete, onOpenChange]
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
          aria-label="Close signing modal"
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
              <p className="text-sm text-muted-foreground">
                Preparing signing session...
              </p>
            </div>
          </div>
        ) : signingData?.embedded && signingData.url ? (
          /* Embedded iframe (DocuSign) */
          <iframe
            ref={iframeRef}
            src={signingData.url}
            className="h-full w-full border-0"
            title={`Sign ${documentTitle}`}
            allow="camera; microphone"
          />
        ) : signingData?.url ? (
          /* Redirect fallback (Autenti) */
          <div className="flex h-full items-center justify-center">
            <Card className="max-w-[480px]">
              <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
                <p className="text-lg font-semibold">
                  {provider === "AUTENTI" ? "Autenti" : "Complete Signing"}
                </p>
                <p className="text-sm text-muted-foreground">
                  You will be redirected to{" "}
                  {provider === "AUTENTI" ? "Autenti" : provider} to complete
                  signing.
                </p>
                <div className="flex gap-3">
                  <Button
                    onClick={() => window.open(signingData.url, "_blank")}
                  >
                    <ExternalLink className="mr-1.5 size-4" />
                    Continue to {provider === "AUTENTI" ? "Autenti" : provider}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                  >
                    Return to Contract
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          /* Error state */
          <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-center">
              <p className="text-sm text-muted-foreground">
                Unable to load signing session. Please try again.
              </p>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Return to Contract
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
