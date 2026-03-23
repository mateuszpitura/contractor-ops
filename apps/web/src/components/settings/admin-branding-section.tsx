"use client";

import { useRef, useState } from "react";
import { Upload, X, Loader2, Globe } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/trpc/init";
import { BrandColorPicker } from "./brand-color-picker";
import { BrandPreviewStrip } from "./brand-preview-strip";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_LOGO_SIZE = 2 * 1024 * 1024; // 2MB
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/svg+xml"];
const DEFAULT_BRAND_COLOR = "#4f46e5"; // indigo-600

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
  const [portalSubdomain, setPortalSubdomain] = useState("");
  const [subdomainInitialized, setSubdomainInitialized] = useState(false);
  const [subdomainError, setSubdomainError] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Queries & Mutations
  // -------------------------------------------------------------------------

  const brandingQuery = useQuery({
    ...trpc.settings.getBranding.queryOptions(),
    select: (data) => {
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

  const uploadUrlMutation = useMutation(
    trpc.settings.getLogoUploadUrl.mutationOptions(),
  );

  const updateBrandingMutation = useMutation(
    trpc.settings.updateBranding.mutationOptions({
      onSuccess: () => {
        toast.success("Portal branding updated");
        queryClient.invalidateQueries({
          queryKey: trpc.settings.getBranding.queryKey(),
        });
      },
      onError: () => {
        toast.error("Failed to save branding. Please try again.");
      },
    }),
  );

  const portalDomainQuery = useQuery({
    ...trpc.settings.getPortalDomain.queryOptions(),
    select: (data) => {
      if (!subdomainInitialized && data) {
        setPortalSubdomain(data.portalSubdomain ?? "");
        setSubdomainInitialized(true);
      }
      return data;
    },
  });

  const updatePortalDomainMutation = useMutation(
    trpc.settings.updatePortalDomain.mutationOptions({
      onSuccess: () => {
        toast.success("Portal subdomain updated");
        queryClient.invalidateQueries({
          queryKey: trpc.settings.getPortalDomain.queryKey(),
        });
      },
      onError: (error) => {
        if (error.message === "This subdomain is already in use") {
          toast.error("This subdomain is already in use");
          setSubdomainError("This subdomain is already in use");
        } else {
          toast.error("Failed to save portal subdomain. Please try again.");
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
      toast.error("Please upload a PNG, JPG, or SVG file.");
      return;
    }
    if (file.size > MAX_LOGO_SIZE) {
      toast.error("Logo must be under 2MB.");
      return;
    }

    try {
      setUploading(true);

      // Get presigned URL
      const { uploadUrl, publicUrl } =
        await uploadUrlMutation.mutateAsync({
          filename: file.name,
          contentType: file.type,
        });

      // Upload to R2
      await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      setLogoUrl(publicUrl);
      setLogoPreview(URL.createObjectURL(file));
    } catch {
      toast.error("Failed to upload logo. Please try again.");
    } finally {
      setUploading(false);
      // Reset input so the same file can be re-selected
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
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
    if (value.length < 3) return "Subdomain must be at least 3 characters";
    if (value.length > 63) return "Subdomain must be at most 63 characters";
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(value)) {
      return "Only lowercase letters, numbers, and hyphens allowed. Must start and end with a letter or number.";
    }
    return null;
  };

  const handleSubdomainChange = (value: string) => {
    // Auto-lowercase and strip invalid chars for better UX
    const sanitized = value.toLowerCase().replace(/[^a-z0-9-]/g, "");
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
        <h3 className="text-sm font-semibold">Portal Branding</h3>
        <p className="text-sm text-muted-foreground">
          Customize how the contractor portal looks for your organization
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Logo upload */}
        <div className="space-y-2">
          <Label className="text-sm font-normal">Logo</Label>

          {logoPreview ? (
            <div className="flex flex-col items-start gap-2">
              <img
                src={logoPreview}
                alt="Organization logo"
                className="h-20 w-20 rounded-md border object-cover"
              />
              <button
                type="button"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                onClick={handleRemoveLogo}
              >
                Remove
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-muted-foreground/25 text-muted-foreground transition-colors hover:border-muted-foreground/50 hover:text-foreground"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <Upload className="h-6 w-6" />
              )}
              <span className="text-xs">Upload logo</span>
            </button>
          )}

          <p className="text-xs text-muted-foreground">
            PNG, JPG, or SVG. Max 2MB.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/png,image/jpeg,image/svg+xml"
            onChange={handleFileSelect}
          />
        </div>

        {/* Brand color picker */}
        <div className="space-y-2">
          <Label className="text-sm font-normal">Accent Color</Label>
          <BrandColorPicker value={brandColor} onChange={setBrandColor} />
        </div>

        {/* Preview strip */}
        <BrandPreviewStrip color={brandColor} />

        {/* Save button */}
        <Button
          onClick={handleSave}
          disabled={updateBrandingMutation.isPending}
          className="w-full sm:w-auto"
        >
          {updateBrandingMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Branding"
          )}
        </Button>

        <Separator />

        {/* Portal subdomain configuration */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <Label className="text-sm font-normal">Portal Subdomain</Label>
          </div>
          <p className="text-sm text-muted-foreground">
            Contractors will access the portal at{" "}
            <span className="font-medium text-foreground">
              {portalSubdomain || "your-subdomain"}
            </span>
            .portal.yourdomain.com
          </p>

          <div className="flex items-center gap-2">
            <Input
              value={portalSubdomain}
              onChange={(e) => handleSubdomainChange(e.target.value)}
              placeholder="e.g., acme"
              className="max-w-[200px]"
              aria-label="Portal subdomain"
              aria-describedby="subdomain-suffix subdomain-error"
            />
            <span
              id="subdomain-suffix"
              className="text-sm text-muted-foreground whitespace-nowrap"
            >
              .portal.yourdomain.com
            </span>
          </div>

          {subdomainError && (
            <p
              id="subdomain-error"
              className="text-sm text-destructive"
              role="alert"
            >
              {subdomainError}
            </p>
          )}

          <Button
            variant="outline"
            onClick={handleSaveSubdomain}
            disabled={updatePortalDomainMutation.isPending}
            className="w-full sm:w-auto"
          >
            {updatePortalDomainMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Domain"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
