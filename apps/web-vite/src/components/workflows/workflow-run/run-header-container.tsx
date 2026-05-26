import type { RunHeaderRun } from '../hooks/use-run-header.js';
import { useRunHeader } from '../hooks/use-run-header.js';
import { RunHeader } from './run-header.js';

interface RunHeaderContainerProps {
  run: RunHeaderRun;
}

// Decision: composite visibility flag (`showActions = canCancel || showOverride`)
// gates the dropdown + cancel/override dialogs in the header. Computed here
// so the view renders a single deterministic branch per state; the per-action
// `canCancel` / `showOverride` flags still drive the individual menu items
// inside the actions block.
export function RunHeaderContainer({ run }: RunHeaderContainerProps) {
  const header = useRunHeader(run);
  const showActions = header.canCancel || header.showOverride;
  return <RunHeader run={run} {...header} showActions={showActions} />;
}
