import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { Image } from '@unpic/react';
import { Loader2, Save, Upload } from 'lucide-react';
import { useCallback } from 'react';
import { BrandColorPicker } from './brand-color-picker';
import { BrandPreviewStrip } from './brand-preview-strip';
import type { useAdminBrandingSection } from './hooks/use-admin-branding-section.js';

export type AdminBrandingSectionProps = ReturnType<typeof useAdminBrandingSection>;

export function AdminBrandingSection({
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
  isSavePending,
}: AdminBrandingSectionProps) {
  const handleUploadClick = useCallback(() => fileInputRef.current?.click(), [fileInputRef]);

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

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('heading')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
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
              />
              <button
                type="button"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                onClick={handleRemoveLogo}>
                {t('removeLogo')}
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-muted-foreground/25 text-muted-foreground transition-colors hover:border-muted-foreground/50 hover:text-foreground"
              onClick={handleUploadClick}
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
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFileSelect}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-normal">{t('accentColor')}</Label>
          <BrandColorPicker value={brandColor} onChange={setBrandColor} />
        </div>

        <BrandPreviewStrip color={brandColor} />
      </CardContent>
      <CardFooter>
        <Button onClick={handleSave} disabled={!isDirty || isSavePending}>
          {isSavePending ? (
            <Loader2 className="me-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="me-2 h-4 w-4" />
          )}
          {isSavePending ? t('saving') : tSettings('saveCta')}
        </Button>
      </CardFooter>
    </Card>
  );
}
