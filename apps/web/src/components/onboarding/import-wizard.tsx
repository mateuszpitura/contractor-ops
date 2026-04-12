'use client';

import type { FetchProjectsOutput, MergedPerson } from '@contractor-ops/validators';
import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useMemo, useState } from 'react';
import { FeatureGate } from '@/components/billing/feature-gate';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ConfirmImportStep } from './confirm-import-step';
import { PeopleReviewStep } from './people-review-step';
import { ProjectImportStep } from './project-import-step';
import { SourceSelectionStep } from './source-selection-step';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type WizardStep = 1 | 2 | 3 | 4;

export interface PersonSelection {
  role: string;
  skip: boolean;
  resolvedConflicts: Record<string, string>;
}

export interface ProjectSelection {
  skip: boolean;
  name: string;
  steps: Array<{ name: string; sortOrder: number }>;
}

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

function WizardStepIndicator({
  currentStep,
  steps,
}: {
  currentStep: WizardStep;
  steps: Array<{ step: WizardStep; label: string }>;
}) {
  return (
    <nav className="flex items-center gap-6" aria-label="Wizard steps">
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

// ---------------------------------------------------------------------------
// ImportWizard
// ---------------------------------------------------------------------------

export function ImportWizard() {
  const t = useTranslations('OnboardingImport');

  // Step navigation
  const [step, setStep] = useState<WizardStep>(1);

  // Step 1: Selected sources
  const [selectedSources, setSelectedSources] = useState<string[]>([]);

  // Step 2: People data + selections
  const [mergedPeople, setMergedPeople] = useState<MergedPerson[]>([]);
  const [personSelections, setPersonSelections] = useState<Map<string, PersonSelection>>(new Map());

  // Step 3: Projects data + selections
  const [projects, setProjects] = useState<FetchProjectsOutput>([]);
  const [projectSelections, setProjectSelections] = useState<Map<string, ProjectSelection>>(
    new Map(),
  );

  // Step 4: Import job
  const [jobId, setJobId] = useState<string | null>(null);

  // Derived: check for unresolved conflicts
  const hasUnresolvedConflicts = useMemo(() => {
    for (const person of mergedPeople) {
      if (person.status !== 'conflict') continue;
      const sel = personSelections.get(person.email);
      if (!sel || sel.skip) continue;
      for (const conflict of person.conflicts ?? []) {
        const resolved = sel.resolvedConflicts[conflict.field];
        if (!resolved) return true;
      }
    }
    return false;
  }, [mergedPeople, personSelections]);

  // Derived: can continue
  const canContinue = useMemo(() => {
    switch (step) {
      case 1:
        return selectedSources.length > 0;
      case 2:
        return !hasUnresolvedConflicts;
      case 3:
        return true;
      case 4:
        return !jobId; // Cannot press Continue once import started
      default:
        return false;
    }
  }, [step, selectedSources.length, hasUnresolvedConflicts, jobId]);

  // Navigation handlers
  const handleBack = useCallback(() => {
    setStep(s => Math.max(1, s - 1) as WizardStep);
  }, []);

  const handleContinue = useCallback(() => {
    if (step < 4) {
      setStep(s => Math.min(4, s + 1) as WizardStep);
    }
  }, [step]);

  // Step config for indicator
  const stepsConfig: Array<{ step: WizardStep; label: string }> = [
    { step: 1, label: t('nav.step1Label') },
    { step: 2, label: t('nav.step2Label') },
    { step: 3, label: t('nav.step3Label') },
    { step: 4, label: t('nav.step4Label') },
  ];

  const progressPercent = step * 25;

  return (
    <FeatureGate requiredTier="Pro" featureName="Onboarding import wizard">
      <div className="flex flex-col gap-8">
        {/* Page title */}
        <div>
          <h1 className="font-display text-[28px] font-semibold leading-[1.15]">
            {t('pageTitle')}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{t('pageSubtitle')}</p>
        </div>

        {/* Step indicator + progress */}
        <div className="space-y-3">
          <WizardStepIndicator currentStep={step} steps={stepsConfig} />
          <Progress value={progressPercent} />
        </div>

        {/* Step content */}
        <div className="min-h-[400px]">
          {step === 1 && (
            <SourceSelectionStep
              selectedSources={selectedSources}
              onSourcesChange={setSelectedSources}
            />
          )}

          {step === 2 && (
            <PeopleReviewStep
              selectedSources={selectedSources}
              mergedPeople={mergedPeople}
              onMergedPeopleChange={setMergedPeople}
              personSelections={personSelections}
              onPersonSelectionsChange={setPersonSelections}
            />
          )}

          {step === 3 && (
            <ProjectImportStep
              selectedSources={selectedSources}
              projects={projects}
              onProjectsChange={setProjects}
              projectSelections={projectSelections}
              onProjectSelectionsChange={setProjectSelections}
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

        {/* Sticky footer navigation */}
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
    </FeatureGate>
  );
}
