'use client';

import { AtelierEmptyState, ContractorsIllustration } from '@contractor-ops/ui';
import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@contractor-ops/ui/components/shadcn/table';
import { format, formatDistanceStrict } from 'date-fns';
import { useTranslations } from 'next-intl';
import { renderEmptyStateAction } from '@/components/shared/atelier-bridges';
import { Link } from '@/i18n/navigation';

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
  assignedAt: string | Date;
  unassignedAt: string | Date | null;
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
  const t = useTranslations('Equipment');

  if (assignments.length === 0) {
    return (
      <AtelierEmptyState
        variant="subview"
        illustration={ContractorsIllustration}
        heading={t('detail.assignmentsEmpty')}
        body={t('detail.assignmentsEmptyDescription')}
        renderAction={renderEmptyStateAction}
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-background">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('detail.colContractor')}</TableHead>
            <TableHead>{t('detail.colAssigned')}</TableHead>
            <TableHead>{t('detail.colUnassigned')}</TableHead>
            <TableHead>{t('detail.colDuration')}</TableHead>
            <TableHead>{t('detail.colNotes')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {assignments.map(assignment => {
            const isCurrent = assignment.id === currentAssignmentId;
            const duration = assignment.unassignedAt
              ? formatDistanceStrict(
                  new Date(assignment.assignedAt),
                  new Date(assignment.unassignedAt),
                )
              : `${formatDistanceStrict(new Date(assignment.assignedAt), new Date())}${t('detail.activeSuffix')}`;

            return (
              <TableRow key={assignment.id} className={isCurrent ? 'bg-primary/5' : ''}>
                <TableCell>
                  <Link
                    href={`/contractors/${assignment.contractor.id}`}
                    className="font-medium hover:underline">
                    {assignment.contractor.displayName ?? assignment.contractor.legalName}
                  </Link>
                  {isCurrent && (
                    <Badge variant="success" className="ms-2">
                      {t('detail.badgeCurrent')}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {format(new Date(assignment.assignedAt), 'MMM d, yyyy')}
                </TableCell>
                <TableCell className="text-sm">
                  {assignment.unassignedAt
                    ? format(new Date(assignment.unassignedAt), 'MMM d, yyyy')
                    : '\u2014'}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{duration}</TableCell>
                <TableCell className="max-w-[200px] text-sm text-muted-foreground">
                  {assignment.notes ? (
                    <span className="line-clamp-2">{assignment.notes}</span>
                  ) : (
                    '\u2014'
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
