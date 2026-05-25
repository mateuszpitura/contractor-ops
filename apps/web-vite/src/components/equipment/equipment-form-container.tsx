import type { EquipmentFormProps } from './equipment-form.js';
import { EquipmentFormView } from './equipment-form.js';
import { useEquipmentForm } from './hooks/use-equipment-form.js';

// Decisive: mutation host. Owns the create/update equipment mutation pair
// via `useEquipmentForm`. View hosts react-hook-form internally and branches
// on the `equipment` prop (edit vs create), not on a hook-returned variant
// flag — single dialog render path, no top-level lift candidate.
export function EquipmentFormContainer(props: EquipmentFormProps) {
  const { submit, isPending } = useEquipmentForm({
    onSuccess: () => props.onOpenChange(false),
  });
  return <EquipmentFormView {...props} submit={submit} isPending={isPending} />;
}
