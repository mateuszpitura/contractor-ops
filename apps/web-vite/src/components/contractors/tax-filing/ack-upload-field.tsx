import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { Loader2 } from 'lucide-react';
import { useCallback, useId, useState } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';

export interface AckUploadFieldProps {
  onUpload: (ackXml: string) => Promise<unknown>;
  isUploading: boolean;
  disabled?: boolean;
}

/**
 * Native file input for the IRS acknowledgement file. Reads the selected `.xml`
 * to text in the browser and hands it to the hook (which `safeParse`s it on the
 * server); no parsing happens here. Keyboard-accessible via the native control.
 */
export function AckUploadField({ onUpload, isUploading, disabled }: AckUploadFieldProps) {
  const t = useTranslations('Tax1099Filing');
  const fieldId = useId();
  const [fileName, setFileName] = useState<string | null>(null);

  const handleChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      setFileName(file.name);
      const text = await file.text();
      await onUpload(text);
      // Reset so re-selecting the same file re-fires change.
      event.target.value = '';
    },
    [onUpload],
  );

  return (
    <div className="space-y-2">
      <Label htmlFor={fieldId} className="font-normal text-sm">
        {t('ackUpload.label')}
      </Label>
      <input
        id={fieldId}
        type="file"
        accept=".xml,text/xml,application/xml"
        disabled={disabled || isUploading}
        onChange={handleChange}
        className="block w-full text-sm file:me-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium"
      />
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {isUploading ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
        {fileName ? (
          <span className="font-mono">{fileName}</span>
        ) : (
          <span>{t('ackUpload.help')}</span>
        )}
      </p>
    </div>
  );
}
