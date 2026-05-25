import { useLeitwegIdInlineSelector } from './hooks/use-leitweg-id-inline-selector.js';
import type { LeitwegIdInlineSelectorProps } from './leitweg-id-inline-selector.js';
import { LeitwegIdInlineSelectorView } from './leitweg-id-inline-selector.js';

// Decision: render gated externally by parent (e-invoicing-section mounts only
// when public-sector buyer applies). Container's job is to keep the
// scoped Leitweg-IDs query out of the view.
export function LeitwegIdInlineSelectorContainer(props: LeitwegIdInlineSelectorProps) {
  const { options } = useLeitwegIdInlineSelector(props.mode, props.contractorId, props.contractId);
  return <LeitwegIdInlineSelectorView {...props} options={options} />;
}
