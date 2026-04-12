'use client';

import { format } from 'date-fns';
import { useTranslations } from 'next-intl';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EquipmentTypeIcon } from '../equipment-type-icon';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Equipment {
  id: string;
  name: string;
  serialNumber: string | null;
  type: string;
  customType: string | null;
  status: string;
  notes: string | null;
  purchaseDate: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

interface TabInfoProps {
  equipment: Equipment;
  onEdit: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TabInfo({ equipment, onEdit }: TabInfoProps) {
  const t = useTranslations('Equipment');

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('detail.info')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <InfoRow label={t('form.name')} value={equipment.name} />
          <InfoRow label={t('form.serialNumber')} value={equipment.serialNumber} mono />
          <InfoRow
            label={t('form.type')}
            value={
              <span className="flex items-center gap-1.5">
                <EquipmentTypeIcon type={equipment.type} />
                {t(`type.${equipment.type}` as Parameters<typeof t>[0])}
                {equipment.customType && ` (${equipment.customType})`}
              </span>
            }
          />
          <InfoRow
            label={t('form.purchaseDate')}
            value={
              equipment.purchaseDate
                ? format(new Date(equipment.purchaseDate), 'MMM d, yyyy')
                : null
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('form.notes')}</CardTitle>
        </CardHeader>
        <CardContent>
          {equipment.notes ? (
            <p className="text-sm whitespace-pre-wrap">{equipment.notes}</p>
          ) : (
            <p className="text-sm text-muted-foreground">No notes</p>
          )}

          <div className="mt-6 space-y-2 border-t pt-4">
            <InfoRow
              label="Created"
              value={format(new Date(equipment.createdAt), 'MMM d, yyyy HH:mm')}
            />
            <InfoRow
              label="Updated"
              value={format(new Date(equipment.updatedAt), 'MMM d, yyyy HH:mm')}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm text-end ${mono ? 'font-mono' : ''}`}>
        {value ?? <span className="text-muted-foreground">&mdash;</span>}
      </span>
    </div>
  );
}
