import type { EquipmentFormProps } from './equipment-form.js';
import { EquipmentFormView } from './equipment-form.js';
import { useEquipmentForm } from './hooks/use-equipment-form.js';

// Decision: form host — view owns react-hook-form and branches on the
// equipment prop (edit vs create); useEquipmentForm supplies submit + isPending.
export function EquipmentFormContainer(props: EquipmentFormProps) {
  const { submit, isPending } = useEquipmentForm({
    onSuccess: () => props.onOpenChange(false),
  });
  return <EquipmentFormView {...props} submit={submit} isPending={isPending} />;
}
