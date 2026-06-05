/**
 * Paczkomat selected-locker display.
 */

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Card, CardContent } from '@contractor-ops/ui/components/shadcn/card';
import { MapPin } from 'lucide-react';

import { useTranslations } from '../../i18n/useTranslations.js';

interface PaczkomatDisplayProps {
  pointId: string;
  pointName: string;
  pointAddress: string;
  onChangeClick: () => void;
}

export function PaczkomatDisplay({
  pointName,
  pointAddress,
  onChangeClick,
}: PaczkomatDisplayProps) {
  const t = useTranslations('Equipment.paczkomat');
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-3">
        <MapPin className="h-5 w-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{pointName}</p>
          <p className="truncate text-xs text-muted-foreground">{pointAddress}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onChangeClick}>
          {t('change')}
        </Button>
      </CardContent>
    </Card>
  );
}
