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
import { UpsBrandIcon } from '../integrations/brand-icons';
import { CarrierCredentialFormContainer } from './carrier-credential-form-container.js';
import type { useUpsProviderSection } from './hooks/use-ups-provider-section.js';

export type UpsProviderSectionProps = ReturnType<typeof useUpsProviderSection>;

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

export function UpsProviderSection({
  t,
  tCarriers,
  configOpen,
  setConfigOpen,
  isConfigured,
}: UpsProviderSectionProps) {
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
          <CarrierCredentialFormContainer carrier="ups" carrierLabel="UPS" />
        </DialogContent>
      </Dialog>
    </div>
  );
}
