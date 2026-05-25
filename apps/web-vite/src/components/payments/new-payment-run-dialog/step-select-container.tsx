import { usePaymentRunStepSelect } from '../hooks/use-payment-run-step-select.js';
import { StepSelect } from './step-select.js';

interface StepSelectContainerProps {
  selectedInvoiceIds: string[];
  onSelectionChange: (ids: string[]) => void;
  groupByCurrency: boolean;
  onGroupByCurrencyChange: (value: boolean) => void;
  onCancel: () => void;
  onNext: () => void;
}

export function StepSelectContainer(props: StepSelectContainerProps) {
  const select = usePaymentRunStepSelect({
    selectedInvoiceIds: props.selectedInvoiceIds,
    onSelectionChange: props.onSelectionChange,
  });
  return <StepSelect {...props} select={select} />;
}
