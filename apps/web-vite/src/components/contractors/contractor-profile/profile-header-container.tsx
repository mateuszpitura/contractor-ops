import { useContractorProfileActions } from '../hooks/use-contractor-profile.js';
import type { ProfileHeaderContractor } from './profile-header.js';
import { ProfileHeaderView } from './profile-header.js';

type ProfileHeaderContainerProps = {
  contractor: ProfileHeaderContractor;
};

// Decision: mutation host — useContractorProfileActions exposes lifecycle +
// archive handlers; contractor-detail-container mounts this only after the
// contractor query resolves.
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
