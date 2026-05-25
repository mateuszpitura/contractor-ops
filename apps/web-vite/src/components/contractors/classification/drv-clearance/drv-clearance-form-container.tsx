import { useDrvClearanceFormMutations } from '../hooks/use-drv-clearance.js';
import type { DrvClearanceFormProps } from './drv-clearance-form.js';
import { DrvClearanceFormView } from './drv-clearance-form.js';

// Decision: render gated externally by parent (panel owns open/close state).
// This container's job is to keep create/update DRV mutations out of the view.
export function DrvClearanceFormContainer(props: DrvClearanceFormProps) {
  const mutations = useDrvClearanceFormMutations(() => props.onOpenChange(false));
  return <DrvClearanceFormView {...props} {...mutations} />;
}
