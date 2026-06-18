import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@contractor-ops/ui/components/shadcn/dialog';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@contractor-ops/ui/components/shadcn/select';
import { looksLikeSecret } from '@contractor-ops/validators';
import { useCallback, useId, useState } from 'react';
import { useTranslations } from '../../i18n/useTranslations.js';

export interface CredentialAddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflowRunId: string;
  isSubmitting: boolean;
  onSubmit: (input: {
    workflowRunId: string;
    label: string;
    vaultProvider: VaultProvider;
    vaultUrl: string;
    accessType: AccessType;
  }) => void;
}

const VAULT_PROVIDERS = [
  'ONE_PASSWORD',
  'BITWARDEN',
  'HASHICORP_VAULT',
  'AWS_SECRETS_MANAGER',
  'GCP_SECRET_MANAGER',
  'AZURE_KEY_VAULT',
  'OTHER',
] as const;
type VaultProvider = (typeof VAULT_PROVIDERS)[number];
const ACCESS_TYPES = [
  'AWS',
  'GITHUB',
  'GCP',
  'AZURE',
  'DATABASE',
  'API_KEY',
  'SSH_KEY',
  'OTHER',
] as const;
type AccessType = (typeof ACCESS_TYPES)[number];

/**
 * Add-credential modal. Client-side instant feedback via `looksLikeSecret`
 * mirrors the server-side `looksLikeSecretRefinement` rejection —
 * defence-in-depth; the server is the truth.
 */
export function CredentialAddDialog({
  open,
  onOpenChange,
  workflowRunId,
  isSubmitting,
  onSubmit,
}: CredentialAddDialogProps) {
  const t = useTranslations('Workflow.credentials');
  const labelId = useId();
  const urlId = useId();
  const providerId = useId();
  const accessId = useId();
  const [label, setLabel] = useState('');
  const [vaultUrl, setVaultUrl] = useState('');
  const [vaultProvider, setVaultProvider] = useState<VaultProvider>(VAULT_PROVIDERS[0]);
  const [accessType, setAccessType] = useState<AccessType>(ACCESS_TYPES[0]);

  const labelSecret = looksLikeSecret(label);
  const urlSecret = looksLikeSecret(vaultUrl);
  const hasSecret = labelSecret.matched || urlSecret.matched;
  const canSubmit = label.length > 0 && vaultUrl.length > 0 && !hasSecret && !isSubmitting;

  const handleLabelChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setLabel(e.target.value),
    [],
  );
  const handleVaultUrlChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setVaultUrl(e.target.value),
    [],
  );
  const handleVaultProviderChange = useCallback(
    (v: string | null) => setVaultProvider(v as VaultProvider),
    [],
  );
  const handleAccessTypeChange = useCallback(
    (v: string | null) => setAccessType(v as AccessType),
    [],
  );
  const handleCancel = useCallback(() => onOpenChange(false), [onOpenChange]);
  const handleSubmit = useCallback(
    () => onSubmit({ workflowRunId, label, vaultUrl, vaultProvider, accessType }),
    [onSubmit, workflowRunId, label, vaultUrl, vaultProvider, accessType],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="credential-add-dialog">
        <DialogHeader>
          <DialogTitle>{t('dialog.addTitle')}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor={labelId}>{t('dialog.fields.label')}</Label>
            <Input id={labelId} value={label} onChange={handleLabelChange} />
            {labelSecret.matched ? (
              <p className="text-xs text-destructive" data-testid="secret-hint-label">
                {t('secretPasteHint', { hint: labelSecret.fieldHint ?? '' })}
              </p>
            ) : null}
          </div>
          <div className="space-y-1">
            <Label htmlFor={urlId}>{t('dialog.fields.vaultUrl')}</Label>
            <Input id={urlId} value={vaultUrl} onChange={handleVaultUrlChange} />
            {urlSecret.matched ? (
              <p className="text-xs text-destructive" data-testid="secret-hint-url">
                {t('secretPasteHint', { hint: urlSecret.fieldHint ?? '' })}
              </p>
            ) : null}
          </div>
          <div className="space-y-1">
            <Label htmlFor={providerId}>{t('dialog.fields.vaultProvider')}</Label>
            <Select value={vaultProvider} onValueChange={handleVaultProviderChange}>
              <SelectTrigger id={providerId} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VAULT_PROVIDERS.map(p => (
                  <SelectItem key={p} value={p}>
                    {t(`providers.${p}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor={accessId}>{t('dialog.fields.accessType')}</Label>
            <Select value={accessType} onValueChange={handleAccessTypeChange}>
              <SelectTrigger id={accessId} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACCESS_TYPES.map(a => (
                  <SelectItem key={a} value={a}>
                    {t(`accessTypes.${a}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            {t('dialog.cancel')}
          </Button>
          <Button disabled={!canSubmit} data-testid="credential-add-submit" onClick={handleSubmit}>
            {t('dialog.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
