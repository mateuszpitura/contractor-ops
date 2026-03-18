"use client";

import { useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { trpc } from "@/trpc/init";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const inviteSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  role: z.enum([
    "admin",
    "finance_admin",
    "ops_manager",
    "team_manager",
    "legal_compliance_viewer",
    "it_admin",
    "external_accountant",
    "readonly",
  ]),
});

type InviteValues = z.infer<typeof inviteSchema>;

const roleOptions: Array<{ value: InviteValues["role"]; label: string }> = [
  { value: "admin", label: "Admin" },
  { value: "finance_admin", label: "Finance admin" },
  { value: "ops_manager", label: "Ops manager" },
  { value: "team_manager", label: "Team manager" },
  { value: "legal_compliance_viewer", label: "Legal / compliance (viewer)" },
  { value: "it_admin", label: "IT admin" },
  { value: "external_accountant", label: "External accountant" },
  { value: "readonly", label: "Read-only" },
];

export function InviteDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();

  const inviteMutation = useMutation(
    trpc.user.invite.mutationOptions({
      onSuccess: () => {
        toast.success("Invitation sent");
        queryClient.invalidateQueries({ queryKey: trpc.user.list.queryKey() });
        onOpenChange(false);
      },
      onError: (error: unknown) => {
        const message =
          typeof error === "object" && error && "message" in error
            ? String((error as { message?: unknown }).message ?? "")
            : "";
        toast.error(message || "Failed to send invite");
      },
    }),
  );

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { errors },
  } = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: "", role: "readonly" },
  });

  useEffect(() => {
    if (!open) reset({ email: "", role: "readonly" });
  }, [open, reset]);

  const onSubmit = (values: InviteValues) => {
    inviteMutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite member</DialogTitle>
          <DialogDescription>
            Send an email invitation to join your organization.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email" className="text-[13px]">
              Email
            </Label>
            <Input
              id="invite-email"
              type="email"
              autoComplete="email"
              disabled={inviteMutation.isPending}
              {...register("email")}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-role" className="text-[13px]">
              Role
            </Label>
            <Select
              value={watch("role")}
              onValueChange={(value) => setValue("role", value as InviteValues["role"])}
              disabled={inviteMutation.isPending}
            >
              <SelectTrigger id="invite-role">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {roleOptions.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter showCloseButton>
            <Button type="submit" disabled={inviteMutation.isPending}>
              {inviteMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send invite"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

