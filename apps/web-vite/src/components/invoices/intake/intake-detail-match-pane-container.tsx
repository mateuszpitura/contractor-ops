import { useIntakeDetailMatch } from '../hooks/use-intake-detail-match.js';
import {
  IntakeDetailMatchPane,
  IntakeDetailMatchPaneEmpty,
  IntakeDetailMatchPaneSkeleton,
} from './intake-detail-match-pane.js';

interface IntakeDetailMatchPaneContainerProps {
  intakeId: string;
  currentStatus: string;
  onSelectedCandidateChange?: (contractorId: string | null) => void;
  className?: string;
}

export function IntakeDetailMatchPaneContainer({
  intakeId,
  currentStatus,
  onSelectedCandidateChange,
  className,
}: IntakeDetailMatchPaneContainerProps) {
  const match = useIntakeDetailMatch(intakeId, currentStatus, onSelectedCandidateChange);

  if (match.isLoading) return <IntakeDetailMatchPaneSkeleton className={className} />;
  if (match.candidates.length === 0) {
    return (
      <IntakeDetailMatchPaneEmpty
        className={className}
        alreadyMatched={match.alreadyMatched}
        onCreateFromData={match.onCreateFromData}
      />
    );
  }

  return <IntakeDetailMatchPane className={className} match={match} />;
}
