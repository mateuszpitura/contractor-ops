import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { AlertTriangle, MapPin } from 'lucide-react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { FreeZoneAssignmentForm } from './free-zone-assignment-form.js';
import { useFreeZoneAssignment } from './hooks/use-free-zone-assignment.js';

interface FreeZoneAssignmentContainerProps {
  contractorId: string;
}

/**
 * Owns the loading / error / empty / success variant decision for the free-zone
 * surface (D-17 mandatory states). The hook is the only tRPC boundary; this
 * container picks which view renders and never fetches directly.
 */
export function FreeZoneAssignmentContainer({ contractorId }: FreeZoneAssignmentContainerProps) {
  const freeZone = useFreeZoneAssignment(contractorId);

  if (freeZone.isLoading) {
    return <FreeZoneAssignmentSkeleton />;
  }

  if (freeZone.isError) {
    return <FreeZoneAssignmentError onRetry={freeZone.onRetry} />;
  }

  const assignment = freeZone.data;

  return (
    <FreeZoneAssignmentForm
      initial={{
        zone: assignment?.zone ?? null,
        licenseNumber: assignment?.licenseNumber ?? null,
        licenseCategory: assignment?.licenseCategory ?? null,
        licenseExpiresAt: assignment?.licenseExpiresAt
          ? new Date(assignment.licenseExpiresAt).toISOString()
          : null,
        permittedActivitiesText: assignment?.permittedActivitiesText ?? null,
        permittedActivityIsicCodes: assignment?.permittedActivityIsicCodes ?? [],
      }}
      isSaving={freeZone.isSaving}
      onSave={freeZone.save}
    />
  );
}

function FreeZoneAssignmentSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-4 w-80" />
      </CardHeader>
      <CardContent className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
          <div key={`fz-field-${i}`} className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function FreeZoneAssignmentError({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations('Contractors.freeZone.error');
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <AlertTriangle aria-hidden="true" className="size-4 text-warning" />
          {t('loadHeading')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t('loadBody')}</p>
        <Button type="button" variant="outline" onClick={onRetry}>
          {t('retry')}
        </Button>
      </CardContent>
    </Card>
  );
}

/**
 * Free-zone empty state copy (UI-SPEC). Exported for callers that prefer a distinct
 * empty panel before the form; the form itself doubles as the create surface, so an
 * unrecorded assignment renders the form with empty fields (the focal zone Select
 * invites the first selection — UI-SPEC empty-state body "Select a zone to begin").
 */
export function FreeZoneAssignmentEmptyState() {
  const t = useTranslations('Contractors.freeZone.empty');
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
        <MapPin aria-hidden="true" className="size-6 text-muted-foreground" />
        <p className="text-base font-semibold">{t('heading')}</p>
        <p className="max-w-md text-sm text-muted-foreground">{t('body')}</p>
      </CardContent>
    </Card>
  );
}
