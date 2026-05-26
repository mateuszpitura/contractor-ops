import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export const MAX_LOGO_SIZE = 2 * 1024 * 1024;
// Keep in sync with the server-side allow-list in
// `packages/api/src/routers/core/settings.ts#getLogoUploadUrl`. SVG is
// intentionally excluded — the rationale lives next to the server check.
export const ACCEPTED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
export const DEFAULT_BRAND_COLOR = '#4f46e5';

export function useAdminBrandingSection() {
  const trpc = useTRPC();
  const t = useTranslations('Settings.branding');
  const tSettings = useTranslations('Settings');
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [brandColor, setBrandColor] = useState<string>(DEFAULT_BRAND_COLOR);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [serverBrandColor, setServerBrandColor] = useState<string>(DEFAULT_BRAND_COLOR);
  const [serverLogoUrl, setServerLogoUrl] = useState<string | null>(null);

  const brandingQuery = useQuery({
    ...trpc.settings.getBranding.queryOptions(),
    select: data => {
      if (!initialized && data) {
        setBrandColor(data.brandColor ?? DEFAULT_BRAND_COLOR);
        setLogoUrl(data.logo);
        setLogoPreview(data.logo);
        setServerBrandColor(data.brandColor ?? DEFAULT_BRAND_COLOR);
        setServerLogoUrl(data.logo);
        setInitialized(true);
      }
      return data;
    },
  });

  const uploadUrlMutation = useMutation(
    trpc.settings.getLogoUploadUrl.mutationOptions({
      onError: err => toast.error(err.message),
      onSuccess: () => {
        toast.success('Done.');
        queryClient.invalidateQueries(trpc.settings.pathFilter());
      },
    }),
  );

  const updateBrandingMutation = useMutation(
    trpc.settings.updateBranding.mutationOptions({
      onSuccess: () => {
        toast.success(t('successToast'));
        queryClient.invalidateQueries({
          queryKey: trpc.settings.getBranding.queryKey(),
        });
      },
      onError: () => {
        toast.error(t('errorToast'));
      },
    }),
  );

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED_LOGO_TYPES.includes(file.type)) {
      toast.error(t('invalidFileType'));
      return;
    }
    if (file.size > MAX_LOGO_SIZE) {
      toast.error(t('fileTooLarge'));
      return;
    }

    try {
      setUploading(true);

      const { uploadUrl, publicUrl } = await uploadUrlMutation.mutateAsync({
        filename: file.name,
        contentType: file.type,
      });

      await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      setLogoUrl(publicUrl);
      setLogoPreview(URL.createObjectURL(file));
    } catch {
      toast.error(t('uploadError'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveLogo = () => {
    setLogoUrl(null);
    setLogoPreview(null);
  };

  const isDirty = brandColor !== serverBrandColor || logoUrl !== serverLogoUrl;

  const handleSave = () => {
    updateBrandingMutation.mutate({
      brandColor,
      logoUrl,
    });
  };

  return {
    t,
    tSettings,
    fileInputRef,
    brandColor,
    setBrandColor,
    logoPreview,
    uploading,
    brandingQuery,
    handleFileSelect,
    handleRemoveLogo,
    isDirty,
    handleSave,
    isSavePending: updateBrandingMutation.isPending,
  } as const;
}
