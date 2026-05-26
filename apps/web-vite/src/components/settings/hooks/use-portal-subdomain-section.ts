import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function usePortalSubdomainSection() {
  const trpc = useTRPC();
  const id = useId();
  const t = useTranslations('Settings.branding');
  const tSettings = useTranslations('Settings');
  const tAria = useTranslations('Common.aria');
  const queryClient = useQueryClient();

  const [portalSubdomain, setPortalSubdomain] = useState('');
  const [serverSubdomain, setServerSubdomain] = useState('');
  const [initialized, setInitialized] = useState(false);
  const [subdomainError, setSubdomainError] = useState<string | null>(null);

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

  return {
    id,
    t,
    tSettings,
    tAria,
    portalSubdomain,
    subdomainError,
    handleSubdomainChange,
    isDirty,
    handleSaveSubdomain,
    isPending: updatePortalDomainMutation.isPending,
  } as const;
}
