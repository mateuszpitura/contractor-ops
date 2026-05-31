import { DropZoneSurface } from '@contractor-ops/ui/components/origin/drop-zone-surface';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@contractor-ops/ui/components/shadcn/dialog';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@contractor-ops/ui/components/shadcn/tabs';
import { Loader2, ShieldCheck } from 'lucide-react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import { useCallback, useRef } from 'react';
import type { useKsefSetupDialog } from './hooks/use-ksef-setup-dialog.js';

interface KsefSetupDialogBaseProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgNip: string | null;
}

export type KsefSetupDialogProps = KsefSetupDialogBaseProps & ReturnType<typeof useKsefSetupDialog>;

export function KsefSetupDialog({
  open,
  onOpenChange,
  orgNip,
  id,
  t,
  authMethod,
  setAuthMethod,
  token,
  setToken,
  certificateFile,
  setCertificateFile,
  certificatePassword,
  setCertificatePassword,
  isFormDisabled,
  isSaveDisabled,
  resetAndClose,
  handleSave,
  isPending,
}: KsefSetupDialogProps) {
  const handleAuthMethodChange = useCallback(
    (v: string) => setAuthMethod(v as 'token' | 'certificate'),
    [setAuthMethod],
  );
  const handleTokenChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => setToken(e.target.value),
    [setToken],
  );
  const handleCertificateFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => setCertificateFile(e.target.files?.[0] ?? null),
    [setCertificateFile],
  );
  const handleCertificatePasswordChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => setCertificatePassword(e.target.value),
    [setCertificatePassword],
  );
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

        <DialogBody className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`${id}-ksef-nip`}>{t('orgNipLabel')}</Label>
            <Input
              id={`${id}-ksef-nip`}
              value={orgNip ?? ''}
              readOnly
              disabled
              className="font-mono"
            />
            {orgNip ? (
              <p className="text-xs text-muted-foreground">{t('orgNipHelper')}</p>
            ) : (
              <p className="text-xs text-destructive">{t('orgNipMissing')}</p>
            )}
          </div>

          <Tabs value={authMethod} onValueChange={handleAuthMethodChange}>
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
                <Label htmlFor={`${id}-ksef-token`}>{t('tokenLabel')}</Label>
                <textarea
                  id={`${id}-ksef-token`}
                  rows={4}
                  value={token}
                  onChange={handleTokenChange}
                  disabled={isFormDisabled}
                  placeholder={t('tokenPlaceholder')}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
                <p className="text-xs text-muted-foreground">{t('tokenHelper')}</p>
              </div>
            </TabsContent>

            <TabsContent value="certificate">
              <div className="space-y-4 pt-2">
                <KsefCertificateField
                  id={id}
                  label={t('certificateFileLabel')}
                  placeholder={t('certificateDropZone')}
                  certificateFile={certificateFile}
                  disabled={isFormDisabled}
                  onChange={handleCertificateFileChange}
                />

                <div className="space-y-2">
                  <Label htmlFor={`${id}-ksef-cert-password`}>
                    {t('certificatePasswordLabel')}
                  </Label>
                  <Input
                    id={`${id}-ksef-cert-password`}
                    type="password"
                    value={certificatePassword}
                    onChange={handleCertificatePasswordChange}
                    disabled={isFormDisabled}
                    placeholder={t('certificatePasswordPlaceholder')}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={resetAndClose}>
            {t('discard')}
          </Button>
          <Button onClick={handleSave} disabled={isSaveDisabled}>
            {!!isPending && <Loader2 className="me-1.5 size-3.5 animate-spin" aria-hidden="true" />}
            {t('saveCredentials')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface KsefCertificateFieldProps {
  id: string;
  label: string;
  placeholder: string;
  certificateFile: File | null;
  disabled: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

function KsefCertificateField({
  id,
  label,
  placeholder,
  certificateFile,
  disabled,
  onChange,
}: KsefCertificateFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const handleClick = useCallback(() => {
    if (!disabled) inputRef.current?.click();
  }, [disabled]);
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if ((event.key === 'Enter' || event.key === ' ') && !disabled) {
        event.preventDefault();
        inputRef.current?.click();
      }
    },
    [disabled],
  );

  return (
    <div className="space-y-2">
      <Label htmlFor={`${id}-ksef-cert-file`}>{label}</Label>
      <DropZoneSurface
        variant="compact"
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        label={
          certificateFile ? (
            <span className="font-medium text-foreground">{certificateFile.name}</span>
          ) : (
            placeholder
          )
        }>
        <input
          ref={inputRef}
          id={`${id}-ksef-cert-file`}
          type="file"
          accept=".p12,.pem"
          disabled={disabled}
          onChange={onChange}
          className="sr-only"
        />
      </DropZoneSurface>
    </div>
  );
}
