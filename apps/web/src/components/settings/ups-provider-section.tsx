'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { UpsBrandIcon } from '@/components/integrations/brand-icons';
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
// UpsProviderSection
// ---------------------------------------------------------------------------

export function UpsProviderSection() {
  const t = useTranslations('Equipment.carrier');
  const tCarriers = useTranslations('Settings.carriers');
  const [configOpen, setConfigOpen] = useState(false);

  const configsQuery = useQuery(trpc.equipment.getCourierConfigs.queryOptions());
  const configs = (configsQuery.data ?? []) as unknown as Array<{ carrier: string }>;
  const isConfigured = configs.some(c => c.carrier.toLowerCase() === 'ups');

  if (configsQuery.isLoading) {
    return (
      <Card className="flex h-full flex-col">
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
    <div className="flex h-full flex-col gap-4">
      <Card className="flex h-full flex-col">
        <CardHeader>
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center">
              <UpsBrandIcon className="size-8" />
            </span>
            <h4 className="text-base font-semibold">UPS</h4>
            <Badge variant={isConfigured ? 'default' : 'secondary'}>
              {isConfigured ? tCarriers('connected') : tCarriers('notConfigured')}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col">
          <div className="flex flex-1 flex-col space-y-3">
            <p className="text-sm text-muted-foreground">{t('upsDescription')}</p>
            <div className="mt-auto pt-3">
              {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
              <Button variant="outline" onClick={() => setConfigOpen(true)}>
                {t('configureUps')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitleComponent>{t('configureUps')}</DialogTitleComponent>
          </DialogHeader>
          <CarrierCredentialForm carrier="ups" carrierLabel="UPS" />
        </DialogContent>
      </Dialog>
    </div>
  );
}
