import type { MergedPerson } from '@contractor-ops/validators';

import { useOnboardingPeople } from './hooks/use-onboarding-people.js';
import type { PersonSelection } from './import-wizard.js';
import { PeopleReviewStep } from './people-review-step.js';

type PeopleReviewStepContainerProps = {
  selectedSources: string[];
  mergedPeople: MergedPerson[];
  onMergedPeopleChange: (people: MergedPerson[]) => void;
  personSelections: Map<string, PersonSelection>;
  onPersonSelectionsChange: (selections: Map<string, PersonSelection>) => void;
};

export function PeopleReviewStepContainer(props: PeopleReviewStepContainerProps) {
  const section = useOnboardingPeople(props);

  return (
    <PeopleReviewStep
      isLoading={section.isLoading}
      isError={section.isError}
      isEmpty={section.isEmpty}
      onRefetch={section.handleRefetch}
      filteredPeople={section.filteredPeople}
      counts={section.counts}
      activeFilter={section.activeFilter}
      setActiveFilter={section.setActiveFilter}
      personSelections={props.personSelections}
      checkedEmails={section.checkedEmails}
      allSelected={section.allSelected}
      someSelected={section.someSelected}
      onSelectAll={section.handleSelectAll}
      onRowCheck={section.handleRowCheck}
      onSkipRow={section.handleSkipRow}
      onRoleChange={section.handleRoleChange}
      onResolveConflict={section.handleResolveConflict}
      onBatchImport={section.handleBatchImport}
      onBatchSkip={section.handleBatchSkip}
      onBatchRole={section.handleBatchRole}
    />
  );
}
