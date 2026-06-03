import { useOffboardingTrajectory } from './hooks/use-offboarding-trajectory.js';
import { OffboardingTrajectoryBanner } from './offboarding-trajectory-banner.js';

export interface OffboardingTrajectoryBannerContainerProps {
  /**
   * Whether the contractor being offboarded is a Saudi national. The banner only mounts
   * for Saudi-national offboarding (the projection is otherwise a no-op). The flag also
   * sharpens the projected rate server-side (D-12).
   */
  isSaudi: boolean | null;
}

/**
 * Mounts the GULF-07 advisory trajectory banner at offboarding-open for a Saudi-national
 * contractor. The hook is the only tRPC boundary; this container gates on the Saudi flag
 * and on the query state (it stays silent while loading or on error — the banner is
 * advisory-only and must never block the offboarding flow).
 */
export function OffboardingTrajectoryBannerContainer({
  isSaudi,
}: OffboardingTrajectoryBannerContainerProps) {
  const { data, isLoading, isError } = useOffboardingTrajectory(isSaudi);

  if (isSaudi !== true || isLoading || isError || data === null) return null;

  return <OffboardingTrajectoryBanner trajectory={data} />;
}
