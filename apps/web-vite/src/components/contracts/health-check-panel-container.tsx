import { HealthCheckPanel } from './health-check-panel.js';
import { useHealthCheckPanel } from './hooks/use-health-check-panel.js';

export interface HealthCheckPanelContainerProps {
  contractId: string;
  /** Contract.complianceFlagsJson — the denormalised latest verdict. */
  resultsJson: unknown;
}

/**
 * Live (re-runnable) health-check panel for the contract detail page.
 * The AuditLog drill-in renders <HealthCheckPanel readOnly> directly with a
 * historical resultsJson and no container (immutable view).
 */
export function HealthCheckPanelContainer({
  contractId,
  resultsJson,
}: HealthCheckPanelContainerProps) {
  const { onRerun, isRerunning } = useHealthCheckPanel(contractId);
  return <HealthCheckPanel resultsJson={resultsJson} onRerun={onRerun} isRerunning={isRerunning} />;
}
