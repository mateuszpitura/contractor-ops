'use client';

import type { ConsentPurpose } from '@contractor-ops/validators';
import { Shield } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ConsentPurposeToggleProps {
  purpose: ConsentPurpose;
  required: boolean;
  granted: boolean;
  onToggle: (purpose: ConsentPurpose, granted: boolean) => void;
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConsentPurposeToggle({
  purpose,
  required,
  granted,
  onToggle,
  disabled = false,
}: ConsentPurposeToggleProps) {
  const t = useTranslations('Consent');

  const purposeKey = purpose.toLowerCase().replace(/_/g, '-');
  const label = t(`purposes.${purposeKey}.label`);
  const description = t(`purposes.${purposeKey}.description`);

  const switchId = `consent-${purpose}`;

  return (
    <div className="flex items-start gap-4 rounded-lg border border-border/50 bg-surface-1 p-4">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10">
        <Shield className="h-4 w-4 text-primary" />
      </div>

      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <Label htmlFor={switchId} className="text-sm font-medium leading-none">
            {label}
          </Label>
          <Badge variant={required ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0">
            {required ? t('required') : t('optional')}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>

      <Switch
        id={switchId}
        checked={granted}
        // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
        onCheckedChange={checked => onToggle(purpose, checked)}
        disabled={disabled || (required && !granted)}
        aria-required={required}
        aria-label={`${label} consent toggle`}
      />
    </div>
  );
}
