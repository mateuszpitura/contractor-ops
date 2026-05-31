import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { FileSignature, Loader2 } from 'lucide-react';
import { useTranslations } from '../../i18n/useTranslations.js';

export interface IpVerificationEsignButtonProps {
  /** Effective jurisdiction — drives the DocuSign (non-DE) vs Autenti (DE) routing hint. */
  jurisdiction?: string;
  isPending?: boolean;
  /** Starts IP-ratification signing — the container wires this to the
   *  startIpRatificationSigning mutation and opens the returned signing URL. */
  onSign: () => void;
}

/**
 * Presentational — the "Sign IP-assignment ratification" action on the
 * IP_VERIFICATION offboarding task. DE routes via Autenti; everyone else via
 * DocuSign (helper text only — the server picks the adapter).
 */
export function IpVerificationEsignButton({
  jurisdiction,
  isPending,
  onSign,
}: IpVerificationEsignButtonProps) {
  const t = useTranslations('Workflow.ipVerification');
  const routingKey = jurisdiction === 'DE' ? 'routingHelper.autenti' : 'routingHelper.docusign';

  return (
    <div className="flex flex-col gap-1" data-testid="ip-verification-esign">
      <Button onClick={onSign} disabled={isPending} data-testid="ip-verification-esign-button">
        {isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <FileSignature className="size-4" />
        )}
        {t('esignButton')}
      </Button>
      <span className="text-xs text-muted-foreground">{t(routingKey)}</span>
    </div>
  );
}
