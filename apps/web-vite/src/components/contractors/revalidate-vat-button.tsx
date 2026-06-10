/**
 * Manual VAT revalidation button.
 */

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Loader2, RefreshCw } from 'lucide-react';

import { useTranslations } from '../../i18n/useTranslations.js';
import { useRevalidateVat } from './hooks/use-revalidate-vat.js';

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

export function RevalidateVatButton({ contractorId }: { contractorId: string }) {
  const { revalidate, isPending } = useRevalidateVat(contractorId);
  return <RevalidateVatButtonView onRevalidate={revalidate} isPending={isPending} />;
}
