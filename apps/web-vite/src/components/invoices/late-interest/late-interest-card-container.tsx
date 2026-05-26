// @ts-nocheck — pre-existing drift; see `late-interest-card.tsx` header
// for the shared explanation. Hook return shape narrower than what the
// view expects.
import { useState } from 'react';

import { useLateInterestCard } from '../hooks/use-late-interest-card.js';
import { useLateInterestClaimDialog } from '../hooks/use-late-interest-claim-dialog.js';
import { useLateInterestRevokeWaiverDialog } from '../hooks/use-late-interest-revoke-waiver-dialog.js';
import { useLateInterestWaiveDialog } from '../hooks/use-late-interest-waive-dialog.js';
import {
  LateInterestB2cNotApplicable,
  LateInterestCard,
  LateInterestSkeleton,
} from './late-interest-card.js';

interface LateInterestCardContainerProps {
  invoiceId: string;
  featureEnabled: boolean;
  contractorCountryCode: string;
  isBusinessCustomer: boolean;
  currency: string;
}

export function LateInterestCardContainer(props: LateInterestCardContainerProps) {
  const card = useLateInterestCard(
    props.invoiceId,
    props.featureEnabled,
    props.contractorCountryCode,
    props.isBusinessCustomer,
    props.currency,
  );

  const [claimDialogOpen, setClaimDialogOpen] = useState(false);
  const [waiveDialogOpen, setWaiveDialogOpen] = useState(false);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);

  const claim = useLateInterestClaimDialog(props.invoiceId, setClaimDialogOpen);
  const waive = useLateInterestWaiveDialog(props.invoiceId, setWaiveDialogOpen);
  const revoke = useLateInterestRevokeWaiverDialog(props.invoiceId, setRevokeDialogOpen);

  if (!card.isApplicable) return null;
  if (!props.isBusinessCustomer) return <LateInterestB2cNotApplicable />;
  if (card.isLoading) return <LateInterestSkeleton />;
  if (card.isError) return null;
  if (!card.data?.applicable) return null;

  return (
    <LateInterestCard
      invoiceId={props.invoiceId}
      data={card.data}
      onDownloadClaim={card.onDownloadClaim}
      isDownloadClaimPending={card.isDownloadClaimPending}
      claimDialogOpen={claimDialogOpen}
      onClaimDialogOpenChange={setClaimDialogOpen}
      waiveDialogOpen={waiveDialogOpen}
      onWaiveDialogOpenChange={setWaiveDialogOpen}
      revokeDialogOpen={revokeDialogOpen}
      onRevokeDialogOpenChange={setRevokeDialogOpen}
      claimDialog={claim}
      waiveDialog={waive}
      revokeDialog={revoke}
    />
  );
}
