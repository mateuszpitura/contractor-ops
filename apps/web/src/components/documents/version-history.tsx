"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Download } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/trpc/init";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type VersionHistoryProps = {
  documentId: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VersionHistory({ documentId }: VersionHistoryProps) {
  const t = useTranslations("Documents");
  const [expanded, setExpanded] = useState(false);

  const historyQuery = useQuery({
    ...trpc.document.getVersionHistory.queryOptions({ documentId }),
    enabled: expanded,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const versions = (historyQuery.data as any[]) ?? [];

  // Only show if there's potentially more than 1 version
  if (!expanded && versions.length <= 1) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="mt-1 flex items-center gap-1 text-xs text-primary hover:underline"
      >
        <ChevronRight className="size-3" />
        {t("versionHistory")}
      </button>
    );
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="mt-1 flex items-center gap-1 text-xs text-primary hover:underline"
      >
        <ChevronRight className="size-3" />
        {t("versionHistory")}
      </button>
    );
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setExpanded(false)}
        className="flex items-center gap-1 text-xs text-primary hover:underline"
      >
        <ChevronDown className="size-3" />
        {t("versionHistory")}
      </button>

      {historyQuery.isLoading ? (
        <p className="mt-1 text-xs text-muted-foreground">{t("loading")}</p>
      ) : versions.length <= 1 ? (
        <p className="mt-1 text-xs text-muted-foreground">{t("noOtherVersions")}</p>
      ) : (
        <div className="mt-2 space-y-1">
          {versions.map(
            (
              version: {
                id: string;
                originalFileName: string;
                createdAt: string | Date;
                status: string;
              },
              i: number,
            ) => (
              <div
                key={version.id}
                className="flex items-center justify-between rounded-md bg-muted/50 px-2 py-1"
              >
                <div className="min-w-0">
                  <span className="text-xs font-medium">
                    {t("version", { n: versions.length - i })}
                  </span>
                  <span className="ms-2 text-xs text-muted-foreground">
                    {formatDate(version.createdAt)}
                  </span>
                  {version.status === "SUPERSEDED" && (
                    <span className="ms-2 text-xs text-muted-foreground/60">
                      ({t("superseded")})
                    </span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={async () => {
                    try {
                      const result = await fetch(
                        `/api/trpc/document.getDownloadUrl?input=${encodeURIComponent(
                          JSON.stringify({ documentId: version.id }),
                        )}`,
                      );
                      const data = await result.json();
                      const url = data?.result?.data?.url;
                      if (url) window.open(url, "_blank");
                    } catch {
                      // Silently fail
                    }
                  }}
                >
                  <Download className="size-3" />
                  <span className="sr-only">{t("download")}</span>
                </Button>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}
