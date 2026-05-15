'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save, Upload } from 'lucide-react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/trpc/init';
import { BrandColorPicker } from './brand-color-picker';
import { BrandPreviewStrip } from './brand-preview-strip';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_LOGO_SIZE = 2 * 1024 * 1024; // 2MB
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml'];
const DEFAULT_BRAND_COLOR = '#4f46e5'; // indigo-600

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AdminBrandingSection() {
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

  // -------------------------------------------------------------------------
  // Queries & Mutations
  // -------------------------------------------------------------------------

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

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
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

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  if (brandingQuery.isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-64 mt-1" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-20 rounded-md" />
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-12 w-full rounded-md" />
          <Skeleton className="h-9 w-32" />
        </CardContent>
      </Card>
    );
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('heading')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Logo upload */}
        <div className="space-y-2">
          <Label className="text-sm font-normal">{t('logoLabel')}</Label>

          {logoPreview ? (
            <div className="flex flex-col items-start gap-2">
              <Image
                src={logoPreview}
                alt={t('logoAlt')}
                width={80}
                height={80}
                className="h-20 w-20 rounded-md border object-cover"
                unoptimized
              />
              <button
                type="button"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                onClick={handleRemoveLogo}>
                {t('removeLogo')}
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-muted-foreground/25 text-muted-foreground transition-colors hover:border-muted-foreground/50 hover:text-foreground"
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}>
              {uploading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <Upload className="h-6 w-6" />
              )}
              <span className="text-xs">{t('uploadLogo')}</span>
            </button>
          )}

          <p className="text-xs text-muted-foreground">{t('logoHint')}</p>

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/png,image/jpeg,image/svg+xml"
            // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
            onChange={handleFileSelect}
          />
        </div>

        {/* Brand color picker */}
        <div className="space-y-2">
          <Label className="text-sm font-normal">{t('accentColor')}</Label>
          <BrandColorPicker value={brandColor} onChange={setBrandColor} />
        </div>

        {/* Preview strip */}
        <BrandPreviewStrip color={brandColor} />
      </CardContent>
      <CardFooter>
        <Button
          // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
          onClick={handleSave}
          disabled={!isDirty || updateBrandingMutation.isPending}>
          {updateBrandingMutation.isPending ? (
            <Loader2 className="me-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="me-2 h-4 w-4" />
          )}
          {updateBrandingMutation.isPending ? t('saving') : tSettings('saveCta')}
        </Button>
      </CardFooter>
    </Card>
  );
}
