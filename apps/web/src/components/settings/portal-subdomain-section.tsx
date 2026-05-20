'use client';

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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { toast } from 'sonner';
import { trpc } from '@/trpc/init';

export function PortalSubdomainSection() {
  const id = useId();
  const t = useTranslations('Settings.branding');
  const tSettings = useTranslations('Settings');
  const tAria = useTranslations('Common.aria');
  const queryClient = useQueryClient();

  const [portalSubdomain, setPortalSubdomain] = useState('');
  const [serverSubdomain, setServerSubdomain] = useState('');
  const [initialized, setInitialized] = useState(false);
  const [subdomainError, setSubdomainError] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Queries & Mutations
  // -------------------------------------------------------------------------

  useQuery({
    ...trpc.settings.getPortalDomain.queryOptions(),
    select: data => {
      if (!initialized && data) {
        setPortalSubdomain(data.portalSubdomain ?? '');
        setServerSubdomain(data.portalSubdomain ?? '');
        setInitialized(true);
      }
      return data;
    },
  });

  const updatePortalDomainMutation = useMutation(
    trpc.settings.updatePortalDomain.mutationOptions({
      onSuccess: () => {
        toast.success(t('subdomainUpdated'));
        queryClient.invalidateQueries({
          queryKey: trpc.settings.getPortalDomain.queryKey(),
        });
      },
      onError: error => {
        if (error.message === 'This subdomain is already in use') {
          toast.error(t('subdomainTaken'));
          setSubdomainError(t('subdomainTaken'));
        } else {
          toast.error(t('subdomainSaveError'));
        }
      },
    }),
  );

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const validateSubdomain = (value: string): string | null => {
    if (!value) return null;
    if (value.length < 3) return t('subdomainMinLength');
    if (value.length > 63) return t('subdomainMaxLength');
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(value)) {
      return t('subdomainFormat');
    }
    return null;
  };

  const handleSubdomainChange = (value: string) => {
    const sanitized = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setPortalSubdomain(sanitized);
    setSubdomainError(null);
  };

  const isDirty = portalSubdomain !== serverSubdomain;

  const handleSaveSubdomain = () => {
    const error = validateSubdomain(portalSubdomain);
    if (error) {
      setSubdomainError(error);
      return;
    }
    updatePortalDomainMutation.mutate({
      portalSubdomain: portalSubdomain || null,
    });
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

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
          disabled={!isDirty || updatePortalDomainMutation.isPending}>
          {updatePortalDomainMutation.isPending ? (
            <Loader2 className="me-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="me-2 h-4 w-4" />
          )}
          {updatePortalDomainMutation.isPending ? tSettings('saving') : tSettings('saveCta')}
        </Button>
      </CardFooter>
    </Card>
  );
}
