import { useClassificationWizardShell } from '../hooks/use-classification-wizard-shell.js';
import type { ClassificationWizardShellViewProps } from './classification-wizard-shell.js';
import { ClassificationWizardShellView } from './classification-wizard-shell.js';

export function ClassificationWizardShellContainer(
  props: Pick<
    ClassificationWizardShellViewProps,
    | 'assessmentId'
    | 'contractorAssignmentId'
    | 'contractorId'
    | 'countryCode'
    | 'initialUpdatedAt'
    | 'initialAnswers'
  >,
) {
  const shell = useClassificationWizardShell(
    props.assessmentId,
    props.contractorId,
    props.contractorAssignmentId,
    props.initialUpdatedAt,
  );
  return <ClassificationWizardShellView {...props} {...shell} />;
}
