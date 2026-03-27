"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { useTranslations } from "next-intl";
import { trpc } from "@/trpc/init";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmbeddedSigningModal } from "@/components/contracts/contract-detail/embedded-signing-modal";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(
  date: Date | string,
  t: (key: string, values?: Record<string, string | number | Date>) => string,
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return t("time.justNow");
  if (diffMinutes < 60) return t("time.minutesAgo", { minutes: diffMinutes });
  if (diffHours < 24) return t("time.hoursAgo", { hours: diffHours });
  if (diffDays < 30) return t("time.daysAgo", { days: diffDays });
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PendingItem = {
  envelopeId: string;
  contractId: string | null;
  recipientName: string;
  recipientEmail: string;
  recipientStatus: string;
  envelopeStatus: string;
  message: string | null;
  expiresAt: string | Date | null;
  sentAt: string | Date | null;
};

type SigningTarget = {
  envelopeId: string;
  recipientEmail: string;
  documentTitle: string;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Portal dashboard section showing pending signature requests.
 * Per UI-SPEC D-04: Cards with contract info and "Sign Now" button.
 * Hidden when count is 0. Max 5 items shown.
 */
export function PortalPendingSignatures() {
  const t = useTranslations("Portal");
  const [signingTarget, setSigningTarget] = useState<SigningTarget | null>(
    null
  );

  const pendingQuery = useQuery(
    trpc.esign.listPendingForContractor.queryOptions()
  );

  const items = (pendingQuery.data ?? []) as PendingItem[];

  // Hidden when no pending items
  if (!pendingQuery.isPending && items.length === 0) {
    return null;
  }

  const displayItems = items.slice(0, 5);
  const hasMore = items.length > 5;

  return (
    <>
      <div className="space-y-3">
        {/* Section heading */}
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">{t("pendingSignatures.title")}</h2>
          {!pendingQuery.isPending && items.length > 0 && (
            <Badge variant="secondary">{items.length}</Badge>
          )}
        </div>

        {/* Loading state */}
        {pendingQuery.isPending ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <Card key={i} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-8 w-20" />
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {displayItems.map((item) => (
              <Card key={item.envelopeId} className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      Contract #{item.contractId?.slice(-6) ?? t("pendingSignatures.na")}
                    </p>
                    {item.sentAt && (
                      <p className="text-sm text-muted-foreground">
                        {t("pendingSignatures.sent", { time: formatRelativeTime(item.sentAt, t) })}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={() =>
                      setSigningTarget({
                        envelopeId: item.envelopeId,
                        recipientEmail: item.recipientEmail,
                        documentTitle: `Contract #${item.contractId?.slice(-6) ?? t("pendingSignatures.na")}`,
                      })
                    }
                  >
                    {t("pendingSignatures.signNow")}
                  </Button>
                </div>
              </Card>
            ))}

            {hasMore && (
              <a
                href="/portal/signatures"
                className="text-sm text-primary hover:underline"
              >
                {t("pendingSignatures.viewAll")}
              </a>
            )}
          </div>
        )}
      </div>

      {/* Embedded signing modal */}
      {signingTarget && (
        <EmbeddedSigningModal
          envelopeId={signingTarget.envelopeId}
          recipientEmail={signingTarget.recipientEmail}
          documentTitle={signingTarget.documentTitle}
          provider="DOCUSIGN"
          open={!!signingTarget}
          onOpenChange={(open) => {
            if (!open) setSigningTarget(null);
          }}
          onComplete={() => {
            setSigningTarget(null);
            pendingQuery.refetch();
          }}
        />
      )}
    </>
  );
}
