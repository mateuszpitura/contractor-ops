import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Card, CardContent, CardHeader } from '@contractor-ops/ui/components/shadcn/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle as DialogTitleComponent,
} from '@contractor-ops/ui/components/shadcn/dialog';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { useCallback } from 'react';
import { UpsBrandIcon } from '../integrations/brand-icons';
import { CarrierCredentialForm } from './carrier-credential-form.js';
import { useUpsProviderSection } from './hooks/use-ups-provider-section.js';

export type UpsProviderSectionViewProps = Omit<
  ReturnType<typeof useUpsProviderSection>,
  'isLoading'
>;

export function UpsProviderSection() {
  const { isLoading, ...rest } = useUpsProviderSection();
  if (isLoading) return <UpsProviderSectionSkeleton />;
  return <UpsProviderSectionView {...rest} />;
}

export function UpsProviderSectionSkeleton() {
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

export function UpsProviderSectionView({
  t,
  tCarriers,
  configOpen,
  setConfigOpen,
  isConfigured,
}: UpsProviderSectionViewProps) {
  const openConfig = useCallback(() => setConfigOpen(true), [setConfigOpen]);
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
              <Button variant="outline" onClick={openConfig}>
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
