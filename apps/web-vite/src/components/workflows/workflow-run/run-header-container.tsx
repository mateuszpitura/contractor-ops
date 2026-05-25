import type { RunHeaderRun } from '../hooks/use-run-header.js';
import { useRunHeader } from '../hooks/use-run-header.js';
import { RunHeader } from './run-header.js';

interface RunHeaderContainerProps {
  run: RunHeaderRun;
}

export function RunHeaderContainer({ run }: RunHeaderContainerProps) {
  const header = useRunHeader(run);
  const showActions = header.canCancel || header.showOverride;
  return <RunHeader run={run} {...header} showActions={showActions} />;
}
