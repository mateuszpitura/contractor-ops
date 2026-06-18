import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import type { ChangeEvent, FormEvent } from 'react';
import { useCallback, useId, useState } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { DropZone } from '../../documents/drop-zone.js';

export interface PortalUploadReplacementFormProps {
  /** Compliance item being renewed (deep-link itemId). */
  itemId: string;
  /** Resolved per-locale document name for the heading. */
  documentLabel: string;
  /** Auto-filled default expiry (ISO yyyy-MM-dd) derived from the policy rule. */
  defaultExpiresAt: string;
  isSubmitting: boolean;
  onSubmit: (args: { itemId: string; file: File; suggestedExpiresAt?: string }) => void;
}

/**
 * One-click upload-replacement form. DropZone picks a file (pdf/png/jpeg, size
 * capped by drop-zone-constants), the expiresAt is auto-filled from the policy
 * rule and editable by the contractor, and submit is disabled until a file is
 * chosen. Presentational — the R2 + submit chain lives in
 * use-portal-upload-replacement.
 */
export function PortalUploadReplacementForm({
  itemId,
  documentLabel,
  defaultExpiresAt,
  isSubmitting,
  onSubmit,
}: PortalUploadReplacementFormProps) {
  const t = useTranslations('Portal.compliance');
  const expiresAtId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [expiresAt, setExpiresAt] = useState(defaultExpiresAt);

  const handleSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!file) return;
      onSubmit({ itemId, file, suggestedExpiresAt: expiresAt || undefined });
    },
    [file, expiresAt, itemId, onSubmit],
  );

  const handleFilesAccepted = useCallback((files: File[]) => setFile(files[0] ?? null), []);

  const handleExpiresAtChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => setExpiresAt(e.target.value),
    [],
  );

  return (
    <form className="flex max-w-xl flex-col gap-5" onSubmit={handleSubmit}>
      <h1 className="text-2xl font-semibold">{t('upload.heading', { document: documentLabel })}</h1>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium leading-none">{t('upload.fileLabel')}</h2>
        <DropZone onFilesAccepted={handleFilesAccepted} />
        {file ? <p className="text-sm text-muted-foreground">{file.name}</p> : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={expiresAtId}>{t('upload.expiresAtLabel')}</Label>
        <Input
          id={expiresAtId}
          type="date"
          value={expiresAt}
          onChange={handleExpiresAtChange}
          className="max-w-xs"
        />
      </div>

      <Button type="submit" disabled={!file || isSubmitting} className="self-start">
        {t('upload.submit')}
      </Button>
    </form>
  );
}
