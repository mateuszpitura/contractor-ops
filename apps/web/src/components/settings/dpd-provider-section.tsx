'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { DpdBrandIcon } from '@/components/integrations/brand-icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle as DialogTitleComponent,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/trpc/init';
import { CarrierCredentialForm } from './carrier-credential-form';

// ---------------------------------------------------------------------------
// DpdProviderSection
// ---------------------------------------------------------------------------

export function DpdProviderSection() {
  const t = useTranslations('Equipment.carrier');
  const tCarriers = useTranslations('Settings.carriers');
  const [configOpen, setConfigOpen] = useState(false);

  const configsQuery = useQuery(trpc.equipment.getCourierConfigs.queryOptions());
  const configs = (configsQuery.data ?? []) as unknown as Array<{ carrier: string }>;
  const isConfigured = configs.some(c => c.carrier.toLowerCase() === 'dpd');

  if (configsQuery.isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Skeleton className="size-8 rounded" />
            <Skeleton className="h-5 w-16" />
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-4 w-64" />
          <Skeleton className="mt-2 h-8 w-32" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <DpdBrandIcon className="h-8 w-auto" />
            <h4 className="text-base font-semibold">DPD</h4>
            <Badge variant={isConfigured ? 'default' : 'secondary'}>
              {isConfigured ? tCarriers('connected') : tCarriers('notConfigured')}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t('dpdDescription')}</p>
            {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
            <Button variant="outline" onClick={() => setConfigOpen(true)}>
              {t('configureDpd')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitleComponent>{t('configureDpd')}</DialogTitleComponent>
          </DialogHeader>
          <CarrierCredentialForm carrier="dpd" carrierLabel="DPD" />
        </DialogContent>
      </Dialog>
    </div>
  );
}
