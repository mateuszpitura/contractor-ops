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
import { looksLikeSecret } from '@contractor-ops/validators';
import { useState } from 'react';
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
    notes?: string;
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
 * mirrors the server-side `looksLikeSecretRefinement` rejection (Plan 75-07) —
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
  const [label, setLabel] = useState('');
  const [vaultUrl, setVaultUrl] = useState('');
  const [vaultProvider, setVaultProvider] = useState<VaultProvider>(VAULT_PROVIDERS[0]);
  const [accessType, setAccessType] = useState<AccessType>(ACCESS_TYPES[0]);

  const labelSecret = looksLikeSecret(label);
  const urlSecret = looksLikeSecret(vaultUrl);
  const hasSecret = labelSecret.matched || urlSecret.matched;
  const canSubmit = label.length > 0 && vaultUrl.length > 0 && !hasSecret && !isSubmitting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="credential-add-dialog">
        <DialogHeader>
          <DialogTitle>{t('dialog.addTitle')}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="cred-label">{t('dialog.fields.label')}</Label>
            <Input id="cred-label" value={label} onChange={e => setLabel(e.target.value)} />
            {labelSecret.matched && (
              <p className="text-xs text-destructive" data-testid="secret-hint-label">
                {t('secretPasteHint', { hint: labelSecret.fieldHint ?? '' })}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="cred-url">{t('dialog.fields.vaultUrl')}</Label>
            <Input id="cred-url" value={vaultUrl} onChange={e => setVaultUrl(e.target.value)} />
            {urlSecret.matched && (
              <p className="text-xs text-destructive" data-testid="secret-hint-url">
                {t('secretPasteHint', { hint: urlSecret.fieldHint ?? '' })}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="cred-provider">{t('dialog.fields.vaultProvider')}</Label>
            <select
              id="cred-provider"
              className="w-full rounded border p-2 text-sm"
              value={vaultProvider}
              onChange={e => setVaultProvider(e.target.value as VaultProvider)}>
              {VAULT_PROVIDERS.map(p => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="cred-access">{t('dialog.fields.accessType')}</Label>
            <select
              id="cred-access"
              className="w-full rounded border p-2 text-sm"
              value={accessType}
              onChange={e => setAccessType(e.target.value as AccessType)}>
              {ACCESS_TYPES.map(a => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('dialog.cancel')}
          </Button>
          <Button
            disabled={!canSubmit}
            data-testid="credential-add-submit"
            onClick={() => onSubmit({ workflowRunId, label, vaultUrl, vaultProvider, accessType })}>
            {t('dialog.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
