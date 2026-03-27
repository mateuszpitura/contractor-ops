"use client";

import { ExternalLink, ShieldCheck } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CopyableField } from "@/components/shared/copyable-field";
import { KsefSourceBadge } from "./ksef-badge";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface KsefMetadataSectionProps {
  ksefReference: string;
  upoReceipt: string | null;
  fetchedAt: string | Date;
  source: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function KsefMetadataSection({
  ksefReference,
  upoReceipt,
  fetchedAt,
  source,
}: KsefMetadataSectionProps) {
  const fetchedDate = new Date(fetchedAt);
  const relativeTime = formatDistanceToNow(fetchedDate, { addSuffix: true });
  const exactDate = format(fetchedDate, "yyyy-MM-dd HH:mm:ss");

  const ksefUrl = `https://ksef.mf.gov.pl/web/${encodeURIComponent(ksefReference)}`;

  return (
    <Card className="border-l-2 border-l-primary">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
          <h3 className="text-sm font-semibold">KSeF Data</h3>
          <a
            href={ksefUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            View in KSeF
            <ExternalLink className="size-3" aria-hidden="true" />
          </a>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* KSeF Reference */}
          <div className="space-y-1">
            <p className="text-sm font-semibold">KSeF Reference</p>
            <CopyableField
              value={ksefReference}
              ariaLabel="Copy KSeF reference"
            />
          </div>

          {/* UPO Receipt */}
          {upoReceipt && (
            <div className="space-y-1">
              <p className="text-sm font-semibold">UPO Receipt</p>
              <CopyableField
                value={upoReceipt}
                ariaLabel="Copy UPO receipt"
              />
            </div>
          )}

          {/* Fetched timestamp */}
          <div className="space-y-1">
            <p className="text-sm font-semibold">Fetched</p>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger className="text-sm text-muted-foreground">
                  {relativeTime}
                </TooltipTrigger>
                <TooltipContent>{exactDate}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Source */}
          <div className="space-y-1">
            <p className="text-sm font-semibold">Source</p>
            <KsefSourceBadge fetchedAt={fetchedAt} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
