import { router } from '../../../init';

// GDPR/RODO erasure procedures for the personnel file (statutory-hold aware).
// Empty for now so the personnelFile namespace can mount its read surface; the
// erasure procedures are filled by a later plan that wires the retention-cutoff
// resolver into a right-to-erasure disposition onto this router.
export const erasureRouter = router({});
