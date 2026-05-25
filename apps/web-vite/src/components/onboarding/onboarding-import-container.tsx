import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Progress } from '@contractor-ops/ui/components/shadcn/progress';
import type { FetchProjectsOutput, MergedPerson } from '@contractor-ops/validators';
import { Check } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

import { useTranslations } from '../../i18n/useTranslations.js';
import { FeatureGateContainer } from '../billing/feature-gate-container.js';
import { ConfirmImportStepContainer } from './confirm-import-step-container.js';
import type { PersonSelection, ProjectSelection, WizardStep } from './import-wizard.js';
import { PeopleReviewStepContainer } from './people-review-step-container.js';
import { ProjectImportStepContainer } from './project-import-step-container.js';
import { SourceSelectionStepContainer } from './source-selection-step-container.js';

function WizardStepIndicator({
  currentStep,
  steps,
}: {
  currentStep: WizardStep;
  steps: Array<{ step: WizardStep; label: string }>;
}) {
  const tAria = useTranslations('Common.aria');

  return (
    <nav className="flex items-center gap-6" aria-label={tAria('wizardProgress')}>
      {steps.map(({ step, label }, index) => {
        const isCurrent = step === currentStep;
        const isCompleted = step < currentStep;

        return (
          <div
            key={step}
            className="flex items-center gap-2"
            aria-current={isCurrent ? 'step' : undefined}>
            {index > 0 && (
              <div
                className={`hidden h-px w-8 sm:block ${isCompleted ? 'bg-primary' : 'bg-border'}`}
                aria-hidden="true"
              />
            )}
            <div className="flex items-center gap-1.5">
              {isCompleted ? (
                <div className="flex size-6 items-center justify-center rounded-full bg-primary">
                  <Check className="size-3.5 text-primary-foreground" aria-hidden="true" />
                </div>
              ) : (
                <div
                  className={`flex size-6 items-center justify-center rounded-full text-xs font-medium ${
                    isCurrent
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                  {step}
                </div>
              )}
              <span
                className={`hidden text-sm sm:inline ${
                  isCurrent
                    ? 'font-medium text-foreground'
                    : isCompleted
                      ? 'text-primary'
                      : 'text-muted-foreground'
                }`}>
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </nav>
  );
}

/** Whether any conflict person has unresolved field conflicts. */
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
): boolean {
  switch (currentStep) {
    case 1:
      return selectedSourceCount > 0;
    case 2:
      return !hasUnresolved;
    case 3:
      return true;
    case 4:
      return !jobId;
    default:
      return false;
  }
}

export function OnboardingImportContainer() {
  const t = useTranslations('OnboardingImport');

  const [step, setStep] = useState<WizardStep>(1);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [mergedPeople, setMergedPeople] = useState<MergedPerson[]>([]);
  const [personSelections, setPersonSelections] = useState<Map<string, PersonSelection>>(new Map());
  const [projects, setProjects] = useState<FetchProjectsOutput>([]);
  const [projectSelections, setProjectSelections] = useState<Map<string, ProjectSelection>>(
    new Map(),
  );
  const [jobId, setJobId] = useState<string | null>(null);

  const hasUnresolvedConflicts = useMemo(
    () => checkUnresolvedConflicts(mergedPeople, personSelections),
    [mergedPeople, personSelections],
  );

  const canContinue = useMemo(
    () => computeCanContinue(step, selectedSources.length, hasUnresolvedConflicts, jobId),
    [step, selectedSources.length, hasUnresolvedConflicts, jobId],
  );

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
    <FeatureGateContainer requiredTier="Pro" featureName="Onboarding import wizard">
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
                onSourcesChange={setSelectedSources}
              />
            )}

            {step === 2 && (
              <PeopleReviewStepContainer
                selectedSources={selectedSources}
                mergedPeople={mergedPeople}
                onMergedPeopleChange={setMergedPeople}
                personSelections={personSelections}
                onPersonSelectionsChange={setPersonSelections}
              />
            )}

            {step === 3 && (
              <ProjectImportStepContainer
                selectedSources={selectedSources}
                projects={projects}
                onProjectsChange={setProjects}
                projectSelections={projectSelections}
                onProjectSelectionsChange={setProjectSelections}
              />
            )}

            {step === 4 && (
              <ConfirmImportStepContainer
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
    </FeatureGateContainer>
  );
}
