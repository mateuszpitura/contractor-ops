import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Loader2, Save } from 'lucide-react';
import type { usePortalSubdomainSection } from './hooks/use-portal-subdomain-section.js';

export type PortalSubdomainSectionProps = ReturnType<typeof usePortalSubdomainSection>;

export function PortalSubdomainSection({
  id,
  t,
  tSettings,
  tAria,
  portalSubdomain,
  subdomainError,
  handleSubdomainChange,
  isDirty,
  handleSaveSubdomain,
  isPending,
}: PortalSubdomainSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('subdomainHeading')}</CardTitle>
        <CardDescription>{t('subdomainCardDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {t('subdomainDescription')}{' '}
          <span className="font-medium text-foreground">{portalSubdomain || 'your-subdomain'}</span>
          {t('subdomainSuffix')}
        </p>

        <div className="flex items-center gap-2">
          <Input
            value={portalSubdomain}
            // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
            onChange={e => handleSubdomainChange(e.target.value)}
            placeholder={t('subdomainPlaceholder')}
            className="max-w-[200px]"
            aria-label={tAria('portalSubdomain')}
            aria-describedby="subdomain-suffix subdomain-error"
          />
          <span
            id={`${id}-subdomain-suffix`}
            className="text-sm text-muted-foreground whitespace-nowrap">
            {t('subdomainSuffix')}
          </span>
        </div>

        {!!subdomainError && (
          <p id={`${id}-subdomain-error`} className="text-sm text-destructive" role="alert">
            {subdomainError}
          </p>
        )}
      </CardContent>
      <CardFooter>
        <Button
          // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
          onClick={handleSaveSubdomain}
          disabled={!isDirty || isPending}>
          {isPending ? (
            <Loader2 className="me-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="me-2 h-4 w-4" />
          )}
          {isPending ? tSettings('saving') : tSettings('saveCta')}
        </Button>
      </CardFooter>
    </Card>
  );
}
