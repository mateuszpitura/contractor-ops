"use client";

import { format, formatDistanceStrict } from "date-fns";
import { UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "@/i18n/navigation";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Assignment {
  id: string;
  contractorId: string;
  contractor: {
    id: string;
    legalName: string;
    displayName: string | null;
  };
  assignedByUserId: string;
  assignedAt: string;
  unassignedAt: string | null;
  unassignedByUserId: string | null;
  notes: string | null;
}

interface TabAssignmentsProps {
  assignments: Assignment[];
  currentAssignmentId: string | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TabAssignments({ assignments, currentAssignmentId }: TabAssignmentsProps) {
  const t = useTranslations("Equipment.detail");

  if (assignments.length === 0) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center text-center">
        <UserPlus className="h-10 w-10 text-muted-foreground/50" />
        <h3 className="mt-3 text-[16px] font-medium">{t("assignmentsEmpty")}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t("assignmentsEmptyDescription")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-background">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Contractor</TableHead>
            <TableHead>Assigned</TableHead>
            <TableHead>Unassigned</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Notes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {assignments.map((assignment) => {
            const isCurrent = assignment.id === currentAssignmentId;
            const duration = assignment.unassignedAt
              ? formatDistanceStrict(
                  new Date(assignment.assignedAt),
                  new Date(assignment.unassignedAt),
                )
              : formatDistanceStrict(new Date(assignment.assignedAt), new Date()) + " (active)";

            return (
              <TableRow key={assignment.id} className={isCurrent ? "bg-primary/5" : ""}>
                <TableCell>
                  <Link
                    href={`/contractors/${assignment.contractor.id}`}
                    className="font-medium hover:underline"
                  >
                    {assignment.contractor.displayName ?? assignment.contractor.legalName}
                  </Link>
                  {isCurrent && (
                    <Badge variant="success" className="ms-2">
                      Current
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {format(new Date(assignment.assignedAt), "MMM d, yyyy")}
                </TableCell>
                <TableCell className="text-sm">
                  {assignment.unassignedAt
                    ? format(new Date(assignment.unassignedAt), "MMM d, yyyy")
                    : "\u2014"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{duration}</TableCell>
                <TableCell className="max-w-[200px] text-sm text-muted-foreground">
                  {assignment.notes ? (
                    <span className="line-clamp-2">{assignment.notes}</span>
                  ) : (
                    "\u2014"
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
