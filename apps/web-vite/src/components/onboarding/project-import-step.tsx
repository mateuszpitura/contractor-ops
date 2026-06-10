import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Card, CardContent, CardHeader } from '@contractor-ops/ui/components/shadcn/card';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import type { FetchPeopleSourceError, ImportedProject } from '@contractor-ops/validators';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  FolderKanban,
  GripVertical,
  Plus,
  RefreshCw,
  X,
} from 'lucide-react';
import type { ChangeEvent, ReactNode } from 'react';
import { useCallback, useState } from 'react';

import { useTranslations } from '../../i18n/useTranslations.js';
import { JiraBrandIcon, LinearBrandIcon } from '../integrations/brand-icons.js';
import { useOnboardingProjects } from './hooks/use-onboarding-projects.js';
import type { ProjectsStepReadiness } from './hooks/use-onboarding-projects.js';
import type { ProjectSelection } from './import-wizard.js';
import { ProjectImportSkeleton } from './onboarding-skeletons.js';
import { PeopleReviewPartialSourceErrors, PeopleReviewSourceErrors } from './people-review-step.js';

const SOURCE_ICONS: Record<string, ReactNode> = {
  JIRA: <JiraBrandIcon className="size-4" />,
  LINEAR: <LinearBrandIcon className="size-4" />,
};

interface ProjectCardProps {
  project: ImportedProject;
  selection: ProjectSelection;
  onSelectionChange: (sel: ProjectSelection) => void;
}

interface StepRowProps {
  step: { name: string; sortOrder: number };
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onRename: (index: number, name: string) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onRemove: (index: number) => void;
  fallbackLabel: string;
  moveUpLabel: string;
  moveDownLabel: string;
  removeLabel: string;
}

function StepRow({
  step,
  index,
  isFirst,
  isLast,
  onRename,
  onMoveUp,
  onMoveDown,
  onRemove,
  fallbackLabel,
  moveUpLabel,
  moveDownLabel,
  removeLabel,
}: StepRowProps) {
  const handleNameChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => onRename(index, e.target.value),
    [index, onRename],
  );
  const handleMoveUp = useCallback(() => onMoveUp(index), [index, onMoveUp]);
  const handleMoveDown = useCallback(() => onMoveDown(index), [index, onMoveDown]);
  const handleRemove = useCallback(() => onRemove(index), [index, onRemove]);

  return (
    <div className="flex items-center gap-2">
      <GripVertical className="size-4 text-muted-foreground" aria-hidden="true" />
      <Input
        value={step.name}
        onChange={handleNameChange}
        placeholder={fallbackLabel}
        className="h-7 flex-1 text-sm"
      />
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={handleMoveUp}
        disabled={isFirst}
        aria-label={moveUpLabel}>
        <ArrowUp className="size-3" />
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={handleMoveDown}
        disabled={isLast}
        aria-label={moveDownLabel}>
        <ArrowDown className="size-3" />
      </Button>
      <Button variant="ghost" size="icon-xs" onClick={handleRemove} aria-label={removeLabel}>
        <X className="size-3" />
      </Button>
    </div>
  );
}

function ProjectCard({ project, selection, onSelectionChange }: ProjectCardProps) {
  const t = useTranslations('OnboardingImport.step3');
  const tAria = useTranslations('Common.aria');
  const [expanded, setExpanded] = useState(false);

  const handleSkip = useCallback(() => {
    onSelectionChange({ ...selection, skip: !selection.skip });
  }, [selection, onSelectionChange]);

  const handleNameChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      onSelectionChange({ ...selection, name: e.target.value });
    },
    [selection, onSelectionChange],
  );

  const handleAddStep = useCallback(() => {
    const steps = [...selection.steps];
    steps.push({ name: '', sortOrder: steps.length });
    onSelectionChange({ ...selection, steps });
  }, [selection, onSelectionChange]);

  const handleRemoveStep = useCallback(
    (index: number) => {
      const steps = selection.steps.filter((_, i) => i !== index);
      const reindexed = steps.map((s, i) => ({ ...s, sortOrder: i }));
      onSelectionChange({ ...selection, steps: reindexed });
    },
    [selection, onSelectionChange],
  );

  const handleRenameStep = useCallback(
    (index: number, name: string) => {
      const steps = [...selection.steps];
      steps[index] = { ...steps[index], name };
      onSelectionChange({ ...selection, steps });
    },
    [selection, onSelectionChange],
  );

  const handleMoveStep = useCallback(
    (index: number, direction: 'up' | 'down') => {
      const steps = [...selection.steps];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= steps.length) return;
      [steps[index], steps[targetIndex]] = [steps[targetIndex], steps[index]];
      const reindexed = steps.map((s, i) => ({ ...s, sortOrder: i }));
      onSelectionChange({ ...selection, steps: reindexed });
    },
    [selection, onSelectionChange],
  );

  const handleMoveUp = useCallback(
    (index: number) => handleMoveStep(index, 'up'),
    [handleMoveStep],
  );
  const handleMoveDown = useCallback(
    (index: number) => handleMoveStep(index, 'down'),
    [handleMoveStep],
  );
  const toggleExpanded = useCallback(() => setExpanded(prev => !prev), []);

  return (
    <Card className={selection.skip ? 'opacity-50' : ''}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {SOURCE_ICONS[project.sourceProvider]}
            <Input
              value={selection.name}
              onChange={handleNameChange}
              className="h-7 max-w-xs border-none bg-transparent px-1 text-sm font-medium shadow-none focus-visible:ring-1"
              disabled={selection.skip}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={toggleExpanded} disabled={selection.skip}>
              {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
              {t('editSteps')}
            </Button>
            <Button variant="link" size="sm" onClick={handleSkip} className="text-muted-foreground">
              {t('skipProject')}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {!expanded && (
          <div className="flex flex-wrap gap-1.5">
            {selection.steps.map((step, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: imported steps lack stable id before save
              <Badge key={`step-chip-${i}`} variant="secondary">
                {step.name || t('stepFallback', { number: i + 1 })}
              </Badge>
            ))}
          </div>
        )}

        {expanded && !selection.skip && (
          <div className="space-y-2">
            {selection.steps.map((step, i) => (
              <StepRow
                // biome-ignore lint/suspicious/noArrayIndexKey: imported steps lack stable id before save
                key={`step-edit-${i}`}
                step={step}
                index={i}
                isFirst={i === 0}
                isLast={i === selection.steps.length - 1}
                onRename={handleRenameStep}
                onMoveUp={handleMoveUp}
                onMoveDown={handleMoveDown}
                onRemove={handleRemoveStep}
                fallbackLabel={t('stepFallback', { number: i + 1 })}
                moveUpLabel={tAria('moveUp')}
                moveDownLabel={tAria('moveDown')}
                removeLabel={tAria('removeStep')}
              />
            ))}

            <Button variant="outline" size="sm" onClick={handleAddStep} className="mt-1">
              <Plus className="size-3" />
              {t('addStep')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface ProjectCardItemProps {
  projectKey: string;
  project: ImportedProject;
  selection: ProjectSelection;
  onSelectionChange: (key: string, selection: ProjectSelection) => void;
}

function ProjectCardItem({
  projectKey,
  project,
  selection,
  onSelectionChange,
}: ProjectCardItemProps) {
  const handleSelectionChange = useCallback(
    (s: ProjectSelection) => onSelectionChange(projectKey, s),
    [projectKey, onSelectionChange],
  );
  return (
    <ProjectCard
      project={project}
      selection={selection}
      onSelectionChange={handleSelectionChange}
    />
  );
}

export interface ProjectImportStepProps {
  projects: ImportedProject[];
  getProjectKey: (project: ImportedProject) => string;
  getSelectionFor: (project: ImportedProject) => ProjectSelection;
  onSelectionChange: (key: string, selection: ProjectSelection) => void;
  sourceErrors?: FetchPeopleSourceError[];
}

export function ProjectImportStep({
  projects,
  getProjectKey,
  getSelectionFor,
  onSelectionChange,
  sourceErrors,
}: ProjectImportStepProps) {
  const t = useTranslations('OnboardingImport.step3');

  return (
    <div className="space-y-6">
      <ProjectImportHeader />

      {sourceErrors && sourceErrors.length > 0 && (
        <PeopleReviewPartialSourceErrors
          sourceErrors={sourceErrors}
          copyNamespace="OnboardingImport.step3"
        />
      )}

      <div className="space-y-4">
        {projects.map(project => {
          const key = getProjectKey(project);
          return (
            <ProjectCardItem
              key={key}
              projectKey={key}
              project={project}
              selection={getSelectionFor(project)}
              onSelectionChange={onSelectionChange}
            />
          );
        })}
      </div>

      <p className="text-sm text-muted-foreground italic">{t('syncNote')}</p>
    </div>
  );
}

export function ProjectImportHeader() {
  const t = useTranslations('OnboardingImport.step3');
  return (
    <div>
      <h2 className="font-display text-xl font-semibold leading-[1.2]">{t('heading')}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
    </div>
  );
}

export interface ProjectImportErrorProps {
  onRefetch: () => void;
}

export function ProjectImportError({ onRefetch }: ProjectImportErrorProps) {
  const tCommon = useTranslations('Common');
  const tErr = useTranslations('Contractors.error');

  return (
    <div className="flex flex-col items-center gap-4 py-16">
      <p className="text-sm text-muted-foreground">{tCommon('networkError')}</p>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={onRefetch}>
        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        {tErr('retry')}
      </Button>
    </div>
  );
}

export function ProjectImportEmpty() {
  const t = useTranslations('OnboardingImport.step3');
  return (
    <div className="flex flex-col items-center gap-4 py-16">
      <FolderKanban className="size-12 text-muted-foreground" aria-hidden="true" />
      <h3 className="text-lg font-semibold">{t('emptyHeading')}</h3>
      <p className="max-w-md text-center text-sm text-muted-foreground">{t('emptyBody')}</p>
    </div>
  );
}

type ProjectImportStepContainerProps = {
  selectedSources: string[];
  projects: ImportedProject[];
  onProjectsChange: (projects: ImportedProject[]) => void;
  projectSelections: Map<string, ProjectSelection>;
  onProjectSelectionsChange: (selections: Map<string, ProjectSelection>) => void;
  onStepReadinessChange?: (readiness: ProjectsStepReadiness) => void;
};

export function ProjectImportStepContainer(props: ProjectImportStepContainerProps) {
  const section = useOnboardingProjects(props);

  if (section.isLoading) {
    return (
      <div className="space-y-6">
        <ProjectImportHeader />
        <ProjectImportSkeleton />
      </div>
    );
  }

  if (section.isError) {
    return (
      <div className="space-y-6">
        <ProjectImportHeader />
        <ProjectImportError onRefetch={section.handleRefetch} />
      </div>
    );
  }

  if (section.allSourcesFailed) {
    return (
      <div className="space-y-6">
        <ProjectImportHeader />
        <PeopleReviewSourceErrors
          sourceErrors={section.sourceErrors}
          onRefetch={section.handleRefetch}
        />
      </div>
    );
  }

  if (section.isEmpty) {
    return (
      <div className="space-y-6">
        <ProjectImportHeader />
        <ProjectImportEmpty />
      </div>
    );
  }

  return (
    <ProjectImportStep
      projects={section.projects}
      getProjectKey={section.getProjectKey}
      getSelectionFor={section.getSelectionFor}
      onSelectionChange={section.handleSelectionChange}
      sourceErrors={section.sourceErrors.length > 0 ? section.sourceErrors : undefined}
    />
  );
}
