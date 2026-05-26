import type { RunHeaderRun } from '../hooks/use-run-header.js';
import { useRunHeader } from '../hooks/use-run-header.js';
import { RunHeader } from './run-header.js';

interface RunHeaderContainerProps {
  run: RunHeaderRun;
}

// Decision: toolbar host — composite showActions flag (canCancel ||
// showOverride) from useRunHeader gates the dropdown + cancel/override dialogs.
// Lifting would duplicate the action-block wrapper across variants.
export function RunHeaderContainer({ run }: RunHeaderContainerProps) {
  const header = useRunHeader(run);
  const showActions = header.canCancel || header.showOverride;
  return <RunHeader run={run} {...header} showActions={showActions} />;
}
