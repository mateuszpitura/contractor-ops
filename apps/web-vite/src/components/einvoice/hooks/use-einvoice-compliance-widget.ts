import { complianceState } from '@contractor-ops/einvoice/compliance';
import { useQuery } from '@tanstack/react-query';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useEinvoiceComplianceWidget() {
  const trpc = useTRPC();
  const t = useTranslations('EInvoice');
  const tDetail = useTranslations('EInvoice.ComplianceDetail');

  const complianceQuery = useQuery(trpc.einvoice.complianceStatuses.queryOptions());
  const peppolQuery = useQuery(trpc.peppol.getStatus.queryOptions());

  const stateLabels: Record<string, string> = {
    active: tDetail('stateActive'),
    sandbox: tDetail('stateSandbox'),
    degraded: tDetail('stateDegraded'),
    onboarding: tDetail('stateOnboarding'),
    suspended: tDetail('stateSuspended'),
    error: tDetail('stateError'),
    [complianceState.notConnected]: tDetail('stateNotConnected'),
  };

  const PEPPOL_STATUS_MAP: Record<string, string> = {
    ACTIVE: 'active',
    PENDING: 'onboarding',
    REGISTERED: 'onboarding',
    SUSPENDED: 'suspended',
  };

  const peppolState = peppolQuery.data
    ? (PEPPOL_STATUS_MAP[peppolQuery.data.participant.status] ?? 'error')
    : null;

  return {
    isLoading: complianceQuery.isLoading,
    statuses: complianceQuery.data?.statuses ?? [],
    peppolState,
    stateLabels,
    t,
  } as const;
}
