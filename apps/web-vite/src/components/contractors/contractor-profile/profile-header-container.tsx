import { useContractorProfileActions } from '../hooks/use-contractor-profile.js';
import type { ProfileHeaderContractor } from './profile-header.js';
import { ProfileHeaderView } from './profile-header.js';

type ProfileHeaderContainerProps = {
  contractor: ProfileHeaderContractor;
};

// Decision: render gated externally by parent (contractor-detail-container —
// rendered only when contractor is loaded). Container's job is to keep
// lifecycle/archive mutations and stage-cast logic out of the view.
export function ProfileHeaderContainer({ contractor }: ProfileHeaderContainerProps) {
  const stage = contractor.lifecycleStage as
    | 'DRAFT'
    | 'ONBOARDING'
    | 'ACTIVE'
    | 'OFFBOARDING'
    | 'ENDED';
  const actions = useContractorProfileActions(contractor.id, stage);
  return <ProfileHeaderView contractor={contractor} {...actions} />;
}
