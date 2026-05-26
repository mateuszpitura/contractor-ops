import { useContractorNotes } from '../hooks/use-contractor-profile.js';
import type { RightRailContractor } from './right-rail.js';
import { RightRailView } from './right-rail.js';

type RightRailContainerProps = {
  contractor: RightRailContractor;
};

// Decision: mutation host — useContractorNotes owns the notes-save mutation
// plus dirty-state; contractor-detail-container mounts this when contractor
// is loaded.
export function RightRailContainer({ contractor }: RightRailContainerProps) {
  const notesState = useContractorNotes(contractor.id, contractor.notes);
  return <RightRailView contractor={contractor} {...notesState} />;
}

export type { RightRailContractor };
