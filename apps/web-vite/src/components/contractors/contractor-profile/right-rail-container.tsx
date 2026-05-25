import { useContractorNotes } from '../hooks/use-contractor-profile.js';
import type { RightRailContractor } from './right-rail.js';
import { RightRailView } from './right-rail.js';

type RightRailContainerProps = {
  contractor: RightRailContractor;
};

// Decision: render gated externally by parent (contractor-detail-container).
// Container's job is to keep the notes-save mutation + dirty-state out of view.
export function RightRailContainer({ contractor }: RightRailContainerProps) {
  const notesState = useContractorNotes(contractor.id, contractor.notes);
  return <RightRailView contractor={contractor} {...notesState} />;
}

export type { RightRailContractor };
