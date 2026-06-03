import { OffboardingTrajectoryBannerContainer } from '../../saudization/offboarding-trajectory-banner-container.js';
import { useContractorProfileActions } from '../hooks/use-contractor-profile.js';
import type { ProfileHeaderContractor } from './profile-header.js';
import { ProfileHeaderView } from './profile-header.js';

type ProfileHeaderContainerProps = {
  contractor: ProfileHeaderContractor & { isSaudi?: boolean | null };
};

// Decision: mutation host — useContractorProfileActions exposes lifecycle +
// archive handlers; contractor-detail-container mounts this only after the
// contractor query resolves. When the contractor is in OFFBOARDING, the
// advisory GULF-07 band-trajectory banner mounts (gated on isSaudi inside its
// own container; non-gating, ephemeral — D-12).
export function ProfileHeaderContainer({ contractor }: ProfileHeaderContainerProps) {
  const stage = contractor.lifecycleStage as
    | 'DRAFT'
    | 'ONBOARDING'
    | 'ACTIVE'
    | 'OFFBOARDING'
    | 'ENDED';
  const actions = useContractorProfileActions(contractor.id, stage);
  return (
    <div className="space-y-4">
      <ProfileHeaderView contractor={contractor} {...actions} />
      {stage === 'OFFBOARDING' ? (
        <OffboardingTrajectoryBannerContainer isSaudi={contractor.isSaudi ?? null} />
      ) : null}
    </div>
  );
}
