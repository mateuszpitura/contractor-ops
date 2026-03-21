"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";

import { trpc } from "@/trpc/init";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
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
import { ChainEditorDialog } from "@/components/settings/chain-editor-dialog";
import type { ChainData } from "@/components/settings/chain-editor-dialog";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatConditionSummary(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  conditions: any,
): string {
  if (!conditions || !Array.isArray(conditions) || conditions.length === 0) {
    return "No conditions (default fallback)";
  }

  return conditions
    .map((c: { field: string; operator: string; value: string | number }) => {
      const fieldLabel = c.field === "amount" ? "Amount" : "Contractor type";
      const opLabel =
        c.operator === "gt" ? ">" : c.operator === "lt" ? "<" : "=";
      const valueLabel =
        c.field === "amount" ? `${c.value} PLN` : String(c.value);
      return `${fieldLabel} ${opLabel} ${valueLabel}`;
    })
    .join(", ");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ApprovalChainsTab() {
  const queryClient = useQueryClient();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingChain, setEditingChain] = useState<ChainData | null>(null);
  const [deletingChainId, setDeletingChainId] = useState<string | null>(null);

  // ---- Data fetching ----
  const chainsQuery = useQuery(trpc.approval.listChains.queryOptions());
  const chains = chainsQuery.data ?? [];

  // ---- Toggle active mutation ----
  const toggleActiveMutation = useMutation(
    trpc.approval.updateChain.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.approval.listChains.queryKey(),
        });
      },
      onError: () => {
        toast.error("Could not save approval chain. Try again.");
        queryClient.invalidateQueries({
          queryKey: trpc.approval.listChains.queryKey(),
        });
      },
    }),
  );

  // ---- Delete mutation ----
  const deleteMutation = useMutation(
    trpc.approval.deleteChain.mutationOptions({
      onSuccess: () => {
        toast.success("Approval chain deleted");
        queryClient.invalidateQueries({
          queryKey: trpc.approval.listChains.queryKey(),
        });
        setDeletingChainId(null);
      },
      onError: () => {
        toast.error("Could not delete approval chain. Try again.");
      },
    }),
  );

  // ---- Handlers ----
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleToggleActive(chain: any) {
    toggleActiveMutation.mutate({
      id: chain.id as string,
      name: chain.name as string,
      isDefault: chain.isDefault as boolean,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      stepsJson: chain.stepsJson as any,
      isActive: !chain.isActive,
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleEdit(chain: any) {
    setEditingChain({
      id: chain.id,
      name: chain.name,
      isDefault: chain.isDefault,
      isActive: chain.isActive,
      conditionsJson: chain.conditionsJson,
      stepsJson: chain.stepsJson,
    } as ChainData);
    setEditorOpen(true);
  }

  function handleCreate() {
    setEditingChain(null);
    setEditorOpen(true);
  }

  function handleDelete(chainId: string) {
    deleteMutation.mutate({ id: chainId });
  }

  // ---- Loading state ----
  if (chainsQuery.isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="mt-1 h-4 w-72" />
          </div>
          <Skeleton className="h-8 w-44" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // ---- Empty state ----
  if (chains.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <h3 className="text-base font-semibold">
            No approval chains configured
          </h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Create an approval chain to route invoices through multi-level
            approvals before payment.
          </p>
          <Button className="mt-4" onClick={handleCreate}>
            <Plus className="mr-1.5 size-4" />
            Create approval chain
          </Button>
        </div>
        <ChainEditorDialog
          open={editorOpen}
          onOpenChange={setEditorOpen}
          chainData={editingChain}
        />
      </>
    );
  }

  // ---- Populated state ----
  return (
    <>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-semibold">Approval chains</h3>
            <p className="text-sm text-muted-foreground">
              Configure approval chains for invoices. Chains are matched based on
              conditions like amount thresholds.
            </p>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="mr-1.5 size-4" />
            Create approval chain
          </Button>
        </div>

        {/* Chain cards */}
        {chains.map((chain) => (
          <Card key={chain.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{chain.name}</span>
                  {chain.isDefault && (
                    <Badge variant="secondary">Default</Badge>
                  )}
                </div>
                <Switch
                  checked={chain.isActive}
                  onCheckedChange={() => handleToggleActive(chain)}
                  aria-label={`Toggle ${chain.name} active state`}
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Badge variant="secondary">
                  {Array.isArray(chain.stepsJson)
                    ? chain.stepsJson.length
                    : 0}{" "}
                  levels
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {formatConditionSummary(chain.conditionsJson)}
                </span>
              </div>
            </CardContent>
            <CardFooter className="gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleEdit(chain)}
              >
                <Pencil className="mr-1.5 size-3.5" />
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setDeletingChainId(chain.id)}
              >
                <Trash2 className="mr-1.5 size-3.5" />
                Delete
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      {/* Chain editor dialog */}
      <ChainEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        chainData={editingChain}
      />

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={deletingChainId !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingChainId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete this approval chain?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This chain will be permanently deleted. In-flight approvals using
              this chain will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (deletingChainId) handleDelete(deletingChainId);
              }}
            >
              Delete chain
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
