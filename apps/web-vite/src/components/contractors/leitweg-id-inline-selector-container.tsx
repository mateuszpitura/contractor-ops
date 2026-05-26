import { useLeitwegIdInlineSelector } from './hooks/use-leitweg-id-inline-selector.js';
import type { LeitwegIdInlineSelectorProps } from './leitweg-id-inline-selector.js';
import { LeitwegIdInlineSelectorView } from './leitweg-id-inline-selector.js';

// Decision: composition — resolves the scoped Leitweg-IDs query and forwards
// options to the selector view; ContractorEInvoicingSection mounts this only
// when public-sector buyer applies.
export function LeitwegIdInlineSelectorContainer(props: LeitwegIdInlineSelectorProps) {
  const { options } = useLeitwegIdInlineSelector(props.mode, props.contractorId, props.contractId);
  return <LeitwegIdInlineSelectorView {...props} options={options} />;
}
