"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { trpc } from "@/trpc/init";
import { usePermissions } from "@/hooks/use-permissions";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DeactivateDialog } from "@/components/settings/deactivate-dialog";

type Member = {
  id?: string;
  userId?: string;
  email?: string | null;
  name?: string | null;
  role?: string | null;
  status?: string | null;
  createdAt?: string | null;
};

const roleLabels: Record<string, string> = {
  admin: "Admin",
  finance_admin: "Finance admin",
  ops_manager: "Ops manager",
  team_manager: "Team manager",
  legal_compliance_viewer: "Legal / compliance",
  it_admin: "IT admin",
  external_accountant: "External accountant",
  readonly: "Read-only",
  owner: "Owner",
  member: "Member",
};

const roleBadgeColors: Record<string, string> = {
  admin: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
  finance_admin: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  ops_manager: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  team_manager: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  legal_compliance_viewer: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
  it_admin: "bg-slate-100 text-slate-800 dark:bg-slate-900/40 dark:text-slate-300",
  external_accountant: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
  readonly: "bg-gray-100 text-gray-800 dark:bg-gray-900/40 dark:text-gray-300",
  owner: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
  member: "bg-gray-100 text-gray-800 dark:bg-gray-900/40 dark:text-gray-300",
};

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  invited: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  disabled: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  banned: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

const assignableRoles = [
  "admin",
  "finance_admin",
  "ops_manager",
  "team_manager",
  "legal_compliance_viewer",
  "it_admin",
  "external_accountant",
  "readonly",
] as const;

function displayName(member: Member) {
  return member.name?.trim() || member.email?.trim() || "\u2014";
}

function displayStatus(member: Member): string {
  const s = member.status?.toLowerCase() ?? "active";
  if (s === "banned") return "disabled";
  return s;
}

export function UsersTable() {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const canManageMembers = can("member", ["update"]);
  const canDeleteMembers = can("member", ["delete"]);

  const [deactivateTarget, setDeactivateTarget] = useState<{
    userId: string;
    name: string;
  } | null>(null);

  const membersQuery = useQuery(trpc.user.list.queryOptions());

  const members = useMemo(() => {
    const data = membersQuery.data;
    if (!Array.isArray(data)) return [];
    return data as unknown as Member[];
  }, [membersQuery.data]);

  const updateRoleMutation = useMutation(
    trpc.user.updateRole.mutationOptions({
      onSuccess: () => {
        toast.success("Role updated");
        queryClient.invalidateQueries({ queryKey: trpc.user.list.queryKey() });
      },
      onError: (error: unknown) => {
        const message =
          typeof error === "object" && error && "message" in error
            ? String((error as { message?: unknown }).message ?? "")
            : "";
        toast.error(message || "Failed to update role");
      },
    }),
  );

  const reactivateMutation = useMutation(
    trpc.user.reactivate.mutationOptions({
      onSuccess: () => {
        toast.success("Member reactivated");
        queryClient.invalidateQueries({ queryKey: trpc.user.list.queryKey() });
      },
      onError: (error: unknown) => {
        const message =
          typeof error === "object" && error && "message" in error
            ? String((error as { message?: unknown }).message ?? "")
            : "";
        toast.error(message || "Failed to reactivate member");
      },
    }),
  );

  if (membersQuery.isLoading) {
    return (
      <div className="rounded-xl border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              {(canManageMembers || canDeleteMembers) && (
                <TableHead className="text-right">Actions</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                {(canManageMembers || canDeleteMembers) && (
                  <TableCell><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="rounded-xl border bg-background py-16 text-center">
        <h3 className="text-[16px] font-medium">No team members yet</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Invite your team to start collaborating.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              {(canManageMembers || canDeleteMembers) && (
                <TableHead className="text-right">Actions</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m, idx) => {
              const status = displayStatus(m);
              const memberId = m.id ?? m.userId ?? "";
              const isDisabled = status === "disabled";

              return (
                <TableRow key={memberId || String(idx)}>
                  <TableCell className="font-medium">
                    {displayName(m)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {m.email ?? "\u2014"}
                  </TableCell>
                  <TableCell>
                    {canManageMembers ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          className="cursor-pointer focus:outline-none"
                          disabled={updateRoleMutation.isPending}
                        >
                          <Badge
                            variant="secondary"
                            className={`${roleBadgeColors[m.role ?? ""] ?? ""} cursor-pointer hover:opacity-80 transition-opacity`}
                          >
                            {roleLabels[m.role ?? ""] ?? m.role ?? "\u2014"}
                          </Badge>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          {assignableRoles.map((role) => (
                            <DropdownMenuItem
                              key={role}
                              onSelect={() => {
                                if (role !== m.role) {
                                  updateRoleMutation.mutate({
                                    userId: memberId,
                                    role,
                                  });
                                }
                              }}
                              className={role === m.role ? "font-semibold" : ""}
                            >
                              {roleLabels[role]}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <Badge
                        variant="secondary"
                        className={roleBadgeColors[m.role ?? ""] ?? ""}
                      >
                        {roleLabels[m.role ?? ""] ?? m.role ?? "\u2014"}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={statusColors[status] ?? ""}
                    >
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </Badge>
                  </TableCell>
                  {(canManageMembers || canDeleteMembers) && (
                    <TableCell className="text-right">
                      {isDisabled && canManageMembers ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            reactivateMutation.mutate({ userId: memberId })
                          }
                          disabled={reactivateMutation.isPending}
                        >
                          Reactivate
                        </Button>
                      ) : !isDisabled && canDeleteMembers ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() =>
                            setDeactivateTarget({
                              userId: memberId,
                              name: displayName(m),
                            })
                          }
                        >
                          Deactivate
                        </Button>
                      ) : null}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {deactivateTarget && (
        <DeactivateDialog
          open={!!deactivateTarget}
          onOpenChange={(open) => {
            if (!open) setDeactivateTarget(null);
          }}
          userId={deactivateTarget.userId}
          userName={deactivateTarget.name}
        />
      )}
    </>
  );
}
