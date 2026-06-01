import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { useState } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { DropZone } from '../../documents/drop-zone-container.js';

export interface PortalUploadReplacementFormProps {
  /** Compliance item being renewed (deep-link itemId). */
  itemId: string;
  /** Resolved per-locale document name for the heading. */
  documentLabel: string;
  /** Auto-filled default expiry (ISO yyyy-MM-dd) derived from the policy rule (D-07). */
  defaultExpiresAt: string;
  isSubmitting: boolean;
  onSubmit: (args: { itemId: string; file: File; suggestedExpiresAt?: string }) => void;
}

/**
 * Phase 73 COMPL-04 / D-06 — one-click upload-replacement form. DropZone picks a
 * file (pdf/png/jpeg, size capped by drop-zone-constants), the expiresAt is
 * auto-filled from the policy rule and editable by the contractor (D-07), and
 * submit is disabled until a file is chosen. Presentational — the R2 + submit
 * chain lives in use-portal-upload-replacement.
 */
export function PortalUploadReplacementForm({
  itemId,
  documentLabel,
  defaultExpiresAt,
  isSubmitting,
  onSubmit,
}: PortalUploadReplacementFormProps) {
  const t = useTranslations('Portal.compliance');
  const [file, setFile] = useState<File | null>(null);
  const [expiresAt, setExpiresAt] = useState(defaultExpiresAt);

  return (
    <form
      className="flex max-w-xl flex-col gap-5"
      onSubmit={e => {
        e.preventDefault();
        if (!file) return;
        onSubmit({ itemId, file, suggestedExpiresAt: expiresAt || undefined });
      }}>
      <h1 className="text-2xl font-semibold">{t('upload.heading', { document: documentLabel })}</h1>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium leading-none">{t('upload.fileLabel')}</h2>
        <DropZone onFilesAccepted={files => setFile(files[0] ?? null)} />
        {file && <p className="text-sm text-muted-foreground">{file.name}</p>}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="upload-expires-at">{t('upload.expiresAtLabel')}</Label>
        <Input
          id="upload-expires-at"
          type="date"
          value={expiresAt}
          onChange={e => setExpiresAt(e.target.value)}
          className="max-w-xs"
        />
      </div>

      <Button type="submit" disabled={!file || isSubmitting} className="self-start">
        {t('upload.submit')}
      </Button>
    </form>
  );
}
