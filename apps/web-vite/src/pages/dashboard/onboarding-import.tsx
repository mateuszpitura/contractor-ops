/**
 * Onboarding import wizard — route shell with inlined page content.
 */

import {
  Stepper,
  StepperIndicator,
  StepperItem,
  StepperNav,
  StepperSeparator,
  StepperTitle,
} from '@contractor-ops/ui/components/reui/stepper';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Progress } from '@contractor-ops/ui/components/shadcn/progress';
import type { ImportedProject, MergedPerson } from '@contractor-ops/validators';
import { useCallback, useMemo, useState } from 'react';
import { FeatureGate } from '../../components/layout/feature-gate.js';
import { ConfirmImportStep } from '../../components/onboarding/confirm-import-step.js';
import type {
  PersonSelection,
  ProjectSelection,
  WizardStep,
} from '../../components/onboarding/import-wizard.js';
import { PeopleReviewStepContainer } from '../../components/onboarding/people-review-step.js';
import { ProjectImportStepContainer } from '../../components/onboarding/project-import-step.js';
import { SourceSelectionStepContainer } from '../../components/onboarding/source-selection-step.js';
import { useTranslations } from '../../i18n/useTranslations.js';

function WizardStepIndicator({
  currentStep,
  steps,
}: {
  currentStep: WizardStep;
  steps: Array<{ step: WizardStep; label: string }>;
}) {
  const tAria = useTranslations('Common.aria');

  return (
    <Stepper value={currentStep} aria-label={tAria('wizardProgress')} aria-readonly="true">
      <StepperNav className="gap-6">
        {steps.map(({ step, label }, index) => (
          <StepperItem key={step} step={step} className="items-center">
            <div
              className="flex items-center gap-1.5"
              aria-current={step === currentStep ? 'step' : undefined}>
              <StepperIndicator className="size-6 text-xs">{step}</StepperIndicator>
              <StepperTitle className="hidden text-sm sm:inline">{label}</StepperTitle>
            </div>
            {index < steps.length - 1 && (
              <StepperSeparator className="mx-2 hidden h-px w-8 sm:block" />
            )}
          </StepperItem>
        ))}
      </StepperNav>
    </Stepper>
  );
}

function checkUnresolvedConflicts(
  people: MergedPerson[],
  selections: Map<string, PersonSelection>,
): boolean {
  for (const person of people) {
    if (person.status !== 'conflict') continue;
    const sel = selections.get(person.email);
    if (!sel || sel.skip) continue;
    for (const conflict of person.conflicts ?? []) {
      if (!sel.resolvedConflicts[conflict.field]) return true;
    }
  }
  return false;
}

function computeCanContinue(
  currentStep: WizardStep,
  selectedSourceCount: number,
  hasUnresolved: boolean,
  jobId: string | null,
  peopleStepCanContinue: boolean,
  projectsStepCanContinue: boolean,
): boolean {
  switch (currentStep) {
    case 1:
      return selectedSourceCount > 0;
    case 2:
      return peopleStepCanContinue && !hasUnresolved;
    case 3:
      return projectsStepCanContinue;
    case 4:
      return !jobId;
    default:
      return false;
  }
}

export function OnboardingImportPageContent() {
  const t = useTranslations('OnboardingImport');

  const [step, setStep] = useState<WizardStep>(1);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [mergedPeople, setMergedPeople] = useState<MergedPerson[]>([]);
  const [personSelections, setPersonSelections] = useState<Map<string, PersonSelection>>(new Map());
  const [projects, setProjects] = useState<ImportedProject[]>([]);
  const [projectSelections, setProjectSelections] = useState<Map<string, ProjectSelection>>(
    new Map(),
  );
  const [jobId, setJobId] = useState<string | null>(null);
  const [peopleStepCanContinue, setPeopleStepCanContinue] = useState(false);
  const [projectsStepCanContinue, setProjectsStepCanContinue] = useState(false);

  const hasUnresolvedConflicts = useMemo(
    () => checkUnresolvedConflicts(mergedPeople, personSelections),
    [mergedPeople, personSelections],
  );

  const canContinue = useMemo(
    () =>
      computeCanContinue(
        step,
        selectedSources.length,
        hasUnresolvedConflicts,
        jobId,
        peopleStepCanContinue,
        projectsStepCanContinue,
      ),
    [
      step,
      selectedSources.length,
      hasUnresolvedConflicts,
      jobId,
      peopleStepCanContinue,
      projectsStepCanContinue,
    ],
  );

  const handlePeopleStepReadiness = useCallback(
    (readiness: { canContinue: boolean; isLoading: boolean }) => {
      setPeopleStepCanContinue(readiness.canContinue && !readiness.isLoading);
    },
    [],
  );

  const handleProjectsStepReadiness = useCallback(
    (readiness: { canContinue: boolean; isLoading: boolean }) => {
      setProjectsStepCanContinue(readiness.canContinue && !readiness.isLoading);
    },
    [],
  );

  const handleSourcesChange = useCallback((sources: string[]) => {
    setSelectedSources(sources);
    setMergedPeople([]);
    setPersonSelections(new Map());
    setProjects([]);
    setProjectSelections(new Map());
    setPeopleStepCanContinue(false);
    setProjectsStepCanContinue(false);
  }, []);

  const handleBack = useCallback(() => {
    setStep(s => Math.max(1, s - 1) as WizardStep);
  }, []);

  const handleContinue = useCallback(() => {
    if (step < 4) {
      setStep(s => Math.min(4, s + 1) as WizardStep);
    }
  }, [step]);

  const stepsConfig: Array<{ step: WizardStep; label: string }> = [
    { step: 1, label: t('nav.step1Label') },
    { step: 2, label: t('nav.step2Label') },
    { step: 3, label: t('nav.step3Label') },
    { step: 4, label: t('nav.step4Label') },
  ];

  const progressPercent = step * 25;

  return (
    <FeatureGate requiredTier="Pro" featureName="Onboarding import wizard">
      <div className="mx-auto w-full max-w-[960px] px-4 py-16 md:px-6 lg:px-0">
        <div className="flex flex-col gap-8">
          <div>
            <h1 className="font-display text-[28px] font-semibold leading-[1.15]">
              {t('pageTitle')}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">{t('pageSubtitle')}</p>
          </div>

          <div className="space-y-3">
            <WizardStepIndicator currentStep={step} steps={stepsConfig} />
            <Progress value={progressPercent} />
          </div>

          <div className="min-h-[400px]">
            {step === 1 && (
              <SourceSelectionStepContainer
                selectedSources={selectedSources}
                onSourcesChange={handleSourcesChange}
              />
            )}

            {step === 2 && (
              <PeopleReviewStepContainer
                selectedSources={selectedSources}
                mergedPeople={mergedPeople}
                onMergedPeopleChange={setMergedPeople}
                personSelections={personSelections}
                onPersonSelectionsChange={setPersonSelections}
                onStepReadinessChange={handlePeopleStepReadiness}
              />
            )}

            {step === 3 && (
              <ProjectImportStepContainer
                selectedSources={selectedSources}
                projects={projects}
                onProjectsChange={setProjects}
                projectSelections={projectSelections}
                onProjectSelectionsChange={setProjectSelections}
                onStepReadinessChange={handleProjectsStepReadiness}
              />
            )}

            {step === 4 && (
              <ConfirmImportStep
                mergedPeople={mergedPeople}
                personSelections={personSelections}
                projects={projects}
                projectSelections={projectSelections}
                jobId={jobId}
                onJobIdChange={setJobId}
              />
            )}
          </div>

          {!jobId && (
            <div className="sticky bottom-0 flex items-center justify-between border-t bg-background py-4">
              {step > 1 ? (
                <Button variant="ghost" onClick={handleBack}>
                  {t('nav.back')}
                </Button>
              ) : (
                <div />
              )}

              {step < 4 && (
                <Button onClick={handleContinue} disabled={!canContinue}>
                  {t('nav.continue')}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </FeatureGate>
  );
}

export default function OnboardingImportPage() {
  return <OnboardingImportPageContent />;
}
