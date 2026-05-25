import { useClassificationWizardShell } from '../hooks/use-classification-wizard-shell.js';
import type { ClassificationWizardShellViewProps } from './classification-wizard-shell.js';
import {
  CLASSIFICATION_WIZARD_SUPPORTED_COUNTRIES,
  ClassificationWizardShellView,
  ClassificationWizardUnsupportedCountry,
} from './classification-wizard-shell.js';

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

  if (!CLASSIFICATION_WIZARD_SUPPORTED_COUNTRIES.has(props.countryCode)) {
    return <ClassificationWizardUnsupportedCountry countryCode={props.countryCode} />;
  }

  return <ClassificationWizardShellView {...props} {...shell} />;
}
