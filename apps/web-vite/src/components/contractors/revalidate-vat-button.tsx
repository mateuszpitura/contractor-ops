/**
 * Manual VAT revalidation button. Step 11 codemod port from
 * apps/web/src/components/contractors/revalidate-vat-button.tsx:
 *   - `next-intl`     → `../../i18n/useTranslations.js`
 *   - `@/trpc/init`   → `../../providers/trpc-provider.js#useTRPC`
 */

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Loader2, RefreshCw } from 'lucide-react';

import { useTranslations } from '../../i18n/useTranslations.js';

export interface RevalidateVatButtonViewProps {
  onRevalidate: () => void;
  isPending: boolean;
}

export function RevalidateVatButtonView({ onRevalidate, isPending }: RevalidateVatButtonViewProps) {
  const t = useTranslations('Contractors.revalidateVat');

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onRevalidate}
      disabled={isPending}
      aria-label={t('buttonAriaLabel')}>
      {isPending ? (
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
      ) : (
        <RefreshCw className="size-3.5" aria-hidden />
      )}
      <span>{t('buttonLabel')}</span>
    </Button>
  );
}
