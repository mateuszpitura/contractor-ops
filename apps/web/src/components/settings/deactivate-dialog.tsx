"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { trpc } from "@/trpc/init";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DeactivateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
}

/**
 * Confirmation dialog for deactivating a team member.
 * Uses AlertDialog for destructive action confirmation pattern.
 * Calls trpc.user.deactivate on confirm, refreshes the user list on success.
 */
export function DeactivateDialog({
  open,
  onOpenChange,
  userId,
  userName,
}: DeactivateDialogProps) {
  const queryClient = useQueryClient();

  const deactivateMutation = useMutation(
    trpc.user.deactivate.mutationOptions({
      onSuccess: () => {
        toast.success(`${userName} has been deactivated`);
        queryClient.invalidateQueries({ queryKey: trpc.user.list.queryKey() });
        onOpenChange(false);
      },
      onError: (error: unknown) => {
        const message =
          typeof error === "object" && error && "message" in error
            ? String((error as { message?: unknown }).message ?? "")
            : "";
        toast.error(message || "Failed to deactivate member");
      },
    }),
  );

  const handleConfirm = () => {
    deactivateMutation.mutate({ userId });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Deactivate {userName}?</AlertDialogTitle>
          <AlertDialogDescription>
            This will immediately revoke their access. They will be logged out
            of all sessions. This action can be reversed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deactivateMutation.isPending}>
            Cancel
          </AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={deactivateMutation.isPending}
          >
            {deactivateMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deactivating...
              </>
            ) : (
              "Deactivate member"
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
