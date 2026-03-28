"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";

import { trpc } from "@/trpc/init";
import { ProviderConnectionCard } from "@/components/settings/provider-connection-card";
import { JiraLogo } from "./jira-logo";
import { JiraStatusMappingDialog } from "./jira-status-mapping-dialog";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// JiraProviderSection
// ---------------------------------------------------------------------------

export function JiraProviderSection() {
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);

  const connectionQuery = useQuery(trpc.jira.connectionStatus.queryOptions());
  const connection = connectionQuery.data as
    | {
        id: string;
        status: string;
        scopeExpansionNeeded?: boolean;
        configJson?: Record<string, unknown>;
      }
    | null
    | undefined;
  const isConnected = connection?.status === "CONNECTED";

  return (
    <div className="space-y-4">
      <ProviderConnectionCard
        provider="jira"
        displayName="Jira"
        icon={<JiraLogo className="size-8" />}
        description="Connect Jira Cloud to sync workflow tasks with Jira issues."
      />

      {isConnected && connection?.scopeExpansionNeeded && (
        <div className="flex items-center gap-2 rounded-md border border-warning/50 bg-warning/10 p-3">
          <AlertTriangle className="size-4 text-warning" />
          <span className="text-sm text-warning">
            Re-auth required — new scopes needed for issue creation and
            webhooks.
          </span>
        </div>
      )}

      {isConnected && !connection?.scopeExpansionNeeded && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setMappingDialogOpen(true)}
        >
          Configure Status Mapping
        </Button>
      )}

      {mappingDialogOpen && connection && (
        <JiraStatusMappingDialog
          open={mappingDialogOpen}
          onOpenChange={setMappingDialogOpen}
          connectionId={connection.id}
        />
      )}
    </div>
  );
}
