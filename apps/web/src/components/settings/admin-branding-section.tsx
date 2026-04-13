'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Globe, Loader2, Upload } from 'lucide-react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
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

/**
 * Admin Portal Branding section for organization settings (General tab).
 *
 * Features:
 * - Logo upload to R2 via presigned URL (PNG, JPG, SVG, max 2MB)
 * - 8-swatch brand color picker with hex input
 * - Live preview strip
 * - Save button wired to settings.updateBranding
 */
export function AdminBrandingSection() {
  const t = useTranslations('Settings.branding');
  const tAria = useTranslations('Common.aria');
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------

  const [brandColor, setBrandColor] = useState<string>(DEFAULT_BRAND_COLOR);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Portal subdomain state
  const [portalSubdomain, setPortalSubdomain] = useState('');
  const [subdomainInitialized, setSubdomainInitialized] = useState(false);
  const [subdomainError, setSubdomainError] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Queries & Mutations
  // -------------------------------------------------------------------------

  const brandingQuery = useQuery({
    ...trpc.settings.getBranding.queryOptions(),
    select: data => {
      // Initialize local state from server data (once)
      if (!initialized && data) {
        setBrandColor(data.brandColor ?? DEFAULT_BRAND_COLOR);
        setLogoUrl(data.logo);
        setLogoPreview(data.logo);
        setInitialized(true);
      }
      return data;
    },
  });

  const uploadUrlMutation = useMutation(trpc.settings.getLogoUploadUrl.mutationOptions());

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

  const _portalDomainQuery = useQuery({
    ...trpc.settings.getPortalDomain.queryOptions(),
    select: data => {
      if (!subdomainInitialized && data) {
        setPortalSubdomain(data.portalSubdomain ?? '');
        setSubdomainInitialized(true);
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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side validation
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

      // Get presigned URL
      const { uploadUrl, publicUrl } = await uploadUrlMutation.mutateAsync({
        filename: file.name,
        contentType: file.type,
      });

      // Upload to R2
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
      // Reset input so the same file can be re-selected
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveLogo = () => {
    setLogoUrl(null);
    setLogoPreview(null);
  };

  const handleSave = () => {
    updateBrandingMutation.mutate({
      brandColor,
      logoUrl,
    });
  };

  const validateSubdomain = (value: string): string | null => {
    if (!value) return null; // Empty is valid (clears subdomain)
    if (value.length < 3) return t('subdomainMinLength');
    if (value.length > 63) return t('subdomainMaxLength');
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(value)) {
      return t('subdomainFormat');
    }
    return null;
  };

  const handleSubdomainChange = (value: string) => {
    // Auto-lowercase and strip invalid chars for better UX
    const sanitized = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setPortalSubdomain(sanitized);
    setSubdomainError(null);
  };

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
        <h3 className="text-sm font-semibold">{t('heading')}</h3>
        <p className="text-sm text-muted-foreground">{t('description')}</p>
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

        {/* Save button */}
        <Button
          // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
          onClick={handleSave}
          disabled={updateBrandingMutation.isPending}
          className="w-full sm:w-auto">
          {updateBrandingMutation.isPending ? (
            <>
              <Loader2 className="me-2 h-4 w-4 animate-spin" />
              {t('saving')}
            </>
          ) : (
            t('saveBranding')
          )}
        </Button>

        <Separator />

        {/* Portal subdomain configuration */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <Label className="text-sm font-normal">{t('subdomainHeading')}</Label>
          </div>
          <p className="text-sm text-muted-foreground">
            {t('subdomainDescription')}{' '}
            <span className="font-medium text-foreground">
              {portalSubdomain || 'your-subdomain'}
            </span>
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
            <span id="subdomain-suffix" className="text-sm text-muted-foreground whitespace-nowrap">
              {t('subdomainSuffix')}
            </span>
          </div>

          {!!subdomainError && (
            <p id="subdomain-error" className="text-sm text-destructive" role="alert">
              {subdomainError}
            </p>
          )}

          <Button
            variant="outline"
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
            onClick={handleSaveSubdomain}
            disabled={updatePortalDomainMutation.isPending}
            className="w-full sm:w-auto">
            {updatePortalDomainMutation.isPending ? (
              <>
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
                {t('saving')}
              </>
            ) : (
              t('saveDomain')
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
