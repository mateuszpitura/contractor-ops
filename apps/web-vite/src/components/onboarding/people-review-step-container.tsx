import type { MergedPerson } from '@contractor-ops/validators';

import { useOnboardingPeople } from './hooks/use-onboarding-people.js';
import type { PersonSelection } from './import-wizard.js';
import { PeopleReviewSkeleton } from './onboarding-skeletons.js';
import {
  PeopleReviewEmpty,
  PeopleReviewError,
  PeopleReviewHeader,
  PeopleReviewStep,
} from './people-review-step.js';

type PeopleReviewStepContainerProps = {
  selectedSources: string[];
  mergedPeople: MergedPerson[];
  onMergedPeopleChange: (people: MergedPerson[]) => void;
  personSelections: Map<string, PersonSelection>;
  onPersonSelectionsChange: (selections: Map<string, PersonSelection>) => void;
};

export function PeopleReviewStepContainer(props: PeopleReviewStepContainerProps) {
  const section = useOnboardingPeople(props);

  if (section.isLoading) {
    return <PeopleReviewSkeleton />;
  }

  if (section.isError) {
    return (
      <div className="space-y-6">
        <PeopleReviewHeader />
        <PeopleReviewError onRefetch={section.handleRefetch} />
      </div>
    );
  }

  if (section.isEmpty) {
    return (
      <div className="space-y-6">
        <PeopleReviewHeader />
        <PeopleReviewEmpty />
      </div>
    );
  }

  return (
    <PeopleReviewStep
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
