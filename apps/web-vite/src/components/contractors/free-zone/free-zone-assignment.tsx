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

const FZ_FIELD_SKELETON_KEYS = [
  'legal-name',
  'jurisdiction',
  'license',
  'permit',
  'status',
] as const;

interface FreeZoneAssignmentContainerProps {
  contractorId: string;
}

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
        {FZ_FIELD_SKELETON_KEYS.map(key => (
          <div key={key} className="space-y-2">
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

/** @deprecated Use FreeZoneAssignment */
export { FreeZoneAssignmentContainer as FreeZoneAssignment };
