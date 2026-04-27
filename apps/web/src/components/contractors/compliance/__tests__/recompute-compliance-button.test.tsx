import { describe, it } from 'vitest';

// This file establishes the RED state for Plan 71-06. Once 71-06 ships the
// recompute compliance button + bulk action UI, these tests turn GREEN.

describe('RecomputeComplianceButton — Phase 71 D-13 admin UI', () => {
  it.todo('renders button on contractor profile compliance tab');
  it.todo('opens confirm dialog with reason dropdown on click');
  it.todo('confirm dialog requires reason selection before submit');
  it.todo('calls mutation with {contractorIds: [contractorId], reason} on confirm');
  it.todo('shows success toast with affected-row count');
  it.todo('shows error toast on mutation failure');
});

describe('RecomputeComplianceBulkAction — Phase 71 D-13 contractors-list bulk action', () => {
  it.todo('appears in selection-toolbar dropdown when 1+ contractors selected');
  it.todo('opens confirm dialog with selected count visible');
  it.todo('calls mutation with all selected contractorIds');
});
