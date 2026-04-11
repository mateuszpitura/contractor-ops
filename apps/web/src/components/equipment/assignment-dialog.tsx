"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

import { trpc } from "@/trpc/init";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipmentId: string;
  equipmentName: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Dialog with contractor search/select to assign equipment.
 */
export function AssignmentDialog({
  open,
  onOpenChange,
  equipmentId,
  equipmentName,
}: AssignmentDialogProps) {
  const t = useTranslations("Equipment");
  const queryClient = useQueryClient();
  const [selectedContractorId, setSelectedContractorId] = useState<string | null>(null);
  const [selectedContractorName, setSelectedContractorName] = useState<string>("");
  const [search, setSearch] = useState("");

  // Fetch contractors
  const contractorsQuery = useQuery(
    trpc.contractor.list.queryOptions({
      page: 1,
      pageSize: 50,
      search: search.length >= 2 ? search : undefined,
    }),
  );

  const contractors = (
    contractorsQuery.data as
      | { items: Array<{ id: string; displayName: string | null; legalName: string }> }
      | undefined
  )?.items ?? [];

  const assignMutation = useMutation(
    trpc.equipment.assign.mutationOptions({
      onSuccess: () => {
        toast.success(
          t("toast.assigned", { name: selectedContractorName }),
        );
        queryClient.invalidateQueries({
          queryKey: trpc.equipment.list.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.equipment.getById.queryKey(),
        });
        onOpenChange(false);
        setSelectedContractorId(null);
        setSelectedContractorName("");
        setSearch("");
      },
      onError: () => {
        toast.error(t("error.actionFailed"));
      },
    }),
  );

  const handleAssign = () => {
    if (!selectedContractorId) return;
    assignMutation.mutate({
      equipmentId,
      contractorId: selectedContractorId,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) {
          setSelectedContractorId(null);
          setSelectedContractorName("");
          setSearch("");
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("detail.assignToContractor")}</DialogTitle>
          <DialogDescription>
            {equipmentName}
          </DialogDescription>
        </DialogHeader>

        <Command shouldFilter={false} className="rounded-lg border">
          <CommandInput
            placeholder="Search contractors..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>
              {contractorsQuery.isLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : (
                "No contractors found."
              )}
            </CommandEmpty>
            <CommandGroup>
              {contractors.map((contractor) => (
                <CommandItem
                  key={contractor.id}
                  value={contractor.id}
                  onSelect={() => {
                    setSelectedContractorId(contractor.id);
                    setSelectedContractorName(
                      contractor.displayName ?? contractor.legalName,
                    );
                  }}
                  className={
                    selectedContractorId === contractor.id
                      ? "bg-accent"
                      : ""
                  }
                >
                  <span>{contractor.displayName ?? contractor.legalName}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={assignMutation.isPending}
          >
            {t("form.cancel")}
          </Button>
          <Button
            onClick={handleAssign}
            disabled={!selectedContractorId || assignMutation.isPending}
          >
            {assignMutation.isPending && (
              <Loader2 className="me-2 h-4 w-4 animate-spin" />
            )}
            {t("detail.assignToContractor")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
