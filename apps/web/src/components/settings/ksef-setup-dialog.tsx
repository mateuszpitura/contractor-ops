'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, ShieldCheck, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/** KSeF connection input — matches the ksef.connect mutation schema. */
type KsefConnectInput =
  | { authMethod: 'token'; token: string; environment: string }
  | {
      authMethod: 'certificate';
      certificateBase64: string;
      certificatePassword?: string;
      environment: string;
    };

interface KsefSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgNip: string | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function KsefSetupDialog({ open, onOpenChange, orgNip }: KsefSetupDialogProps) {
  const t = useTranslations('ksef');
  const queryClient = useQueryClient();

  // Form state
  const [authMethod, setAuthMethod] = useState<'token' | 'certificate'>('token');
  const [token, setToken] = useState('');
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [certificatePassword, setCertificatePassword] = useState('');
  const [environment] = useState<'test' | 'prod'>('prod');

  // Connect mutation (verifies credentials per D-04 then saves)
  const connectMutation = useMutation({
    ...trpc.ksef.connect.mutationOptions(),
    onSuccess: () => {
      toast.success(t('connectedToast'));
      queryClient.invalidateQueries({
        queryKey: trpc.ksef.connectionStatus.queryKey(),
      });
      queryClient.invalidateQueries({
        queryKey: trpc.integration.getHealth.queryKey({ provider: 'ksef' }),
      });
      queryClient.invalidateQueries({
        queryKey: trpc.integration.getAllHealth.queryKey(),
      });
      resetAndClose();
    },
    onError: (error: Error) => {
      toast.error(error.message || t('connectionFailedToast'));
    },
  });

  function resetAndClose() {
    setToken('');
    setCertificateFile(null);
    setCertificatePassword('');
    setAuthMethod('token');
    onOpenChange(false);
  }

  async function handleSave() {
    if (authMethod === 'token') {
      (connectMutation.mutate as (input: KsefConnectInput) => void)({
        authMethod: 'token' as const,
        token,
        environment,
      });
    } else {
      // Convert certificate file to base64 for transport
      let certificateBase64 = '';
      if (certificateFile) {
        const buffer = await certificateFile.arrayBuffer();
        certificateBase64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      }
      (connectMutation.mutate as (input: KsefConnectInput) => void)({
        authMethod: 'certificate' as const,
        certificateBase64,
        certificatePassword: certificatePassword || undefined,
        environment,
      });
    }
  }

  const isFormDisabled = !orgNip || connectMutation.isPending;
  const isSaveDisabled =
    isFormDisabled ||
    (authMethod === 'token' && !token.trim()) ||
    (authMethod === 'certificate' && !certificateFile);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" aria-hidden="true" />
            <DialogTitle>{t('connectTitle')}</DialogTitle>
          </div>
          <DialogDescription>{t('connectDescription')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Organization NIP (read-only) */}
          <div className="space-y-2">
            <Label htmlFor="ksef-nip">{t('orgNipLabel')}</Label>
            <Input id="ksef-nip" value={orgNip ?? ''} readOnly disabled className="font-mono" />
            {orgNip ? (
              <p className="text-xs text-muted-foreground">{t('orgNipHelper')}</p>
            ) : (
              <p className="text-xs text-destructive">{t('orgNipMissing')}</p>
            )}
          </div>

          {/* Auth method tabs */}
          <Tabs value={authMethod} onValueChange={v => setAuthMethod(v as 'token' | 'certificate')}>
            <TabsList>
              <TabsTrigger value="token" disabled={isFormDisabled}>
                {t('tokenLabel')}
              </TabsTrigger>
              <TabsTrigger value="certificate" disabled={isFormDisabled}>
                {t('certificateLabel')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="token">
              <div className="space-y-2 pt-2">
                <Label htmlFor="ksef-token">{t('tokenLabel')}</Label>
                <textarea
                  id="ksef-token"
                  rows={4}
                  value={token}
                  onChange={e => setToken(e.target.value)}
                  disabled={isFormDisabled}
                  placeholder={t('tokenPlaceholder')}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
                <p className="text-xs text-muted-foreground">{t('tokenHelper')}</p>
              </div>
            </TabsContent>

            <TabsContent value="certificate">
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>{t('certificateFileLabel')}</Label>
                  <label
                    htmlFor="ksef-cert-file"
                    className="flex h-20 cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-muted-foreground/25 bg-muted/30 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted/50">
                    {certificateFile ? (
                      <span className="font-medium text-foreground">{certificateFile.name}</span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Upload className="size-4" aria-hidden="true" />
                        {t('certificateDropZone')}
                      </span>
                    )}
                    <input
                      id="ksef-cert-file"
                      type="file"
                      accept=".p12,.pem"
                      disabled={isFormDisabled}
                      onChange={e => setCertificateFile(e.target.files?.[0] ?? null)}
                      className="sr-only"
                    />
                  </label>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ksef-cert-password">{t('certificatePasswordLabel')}</Label>
                  <Input
                    id="ksef-cert-password"
                    type="password"
                    value={certificatePassword}
                    onChange={e => setCertificatePassword(e.target.value)}
                    disabled={isFormDisabled}
                    placeholder={t('certificatePasswordPlaceholder')}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={resetAndClose}>
            {t('discard')}
          </Button>
          <Button onClick={handleSave} disabled={isSaveDisabled}>
            {connectMutation.isPending && (
              <Loader2 className="me-1.5 size-3.5 animate-spin" aria-hidden="true" />
            )}
            {t('saveCredentials')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
