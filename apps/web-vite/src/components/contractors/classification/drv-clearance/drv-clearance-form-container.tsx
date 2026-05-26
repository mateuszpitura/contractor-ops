import { useDrvClearanceFormMutations } from '../hooks/use-drv-clearance.js';
import type { DrvClearanceFormProps } from './drv-clearance-form.js';
import { DrvClearanceFormView } from './drv-clearance-form.js';

// Decision: form host — view owns react-hook-form; useDrvClearanceFormMutations
// supplies create/update DRV submit handlers. StatusfeststellungsverfahrenPanel
// owns open/close state.
export function DrvClearanceFormContainer(props: DrvClearanceFormProps) {
  const mutations = useDrvClearanceFormMutations(() => props.onOpenChange(false));
  return <DrvClearanceFormView {...props} {...mutations} />;
}
