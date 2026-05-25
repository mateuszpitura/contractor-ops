import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Card, CardContent, CardHeader } from '@contractor-ops/ui/components/shadcn/card';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import type { FetchProjectsOutput } from '@contractor-ops/validators';
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
import type { ReactNode } from 'react';
import { useState } from 'react';

import { useTranslations } from '../../i18n/useTranslations.js';
import { JiraBrandIcon, LinearBrandIcon } from '../integrations/brand-icons.js';
import type { ProjectSelection } from './import-wizard.js';
import { ProjectImportSkeleton } from './onboarding-skeletons.js';

const SOURCE_ICONS: Record<string, ReactNode> = {
  JIRA: <JiraBrandIcon className="size-4" />,
  LINEAR: <LinearBrandIcon className="size-4" />,
};

interface ProjectCardProps {
  project: FetchProjectsOutput[number];
  selection: ProjectSelection;
  onSelectionChange: (sel: ProjectSelection) => void;
}

function ProjectCard({ project, selection, onSelectionChange }: ProjectCardProps) {
  const t = useTranslations('OnboardingImport.step3');
  const tAria = useTranslations('Common.aria');
  const [expanded, setExpanded] = useState(false);

  const handleSkip = () => {
    onSelectionChange({ ...selection, skip: !selection.skip });
  };

  const handleNameChange = (name: string) => {
    onSelectionChange({ ...selection, name });
  };

  const handleAddStep = () => {
    const steps = [...selection.steps];
    steps.push({ name: '', sortOrder: steps.length });
    onSelectionChange({ ...selection, steps });
  };

  const handleRemoveStep = (index: number) => {
    const steps = selection.steps.filter((_, i) => i !== index);
    const reindexed = steps.map((s, i) => ({ ...s, sortOrder: i }));
    onSelectionChange({ ...selection, steps: reindexed });
  };

  const handleRenameStep = (index: number, name: string) => {
    const steps = [...selection.steps];
    steps[index] = { ...steps[index], name };
    onSelectionChange({ ...selection, steps });
  };

  const handleMoveStep = (index: number, direction: 'up' | 'down') => {
    const steps = [...selection.steps];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= steps.length) return;
    [steps[index], steps[targetIndex]] = [steps[targetIndex], steps[index]];
    const reindexed = steps.map((s, i) => ({ ...s, sortOrder: i }));
    onSelectionChange({ ...selection, steps: reindexed });
  };

  return (
    <Card className={selection.skip ? 'opacity-50' : ''}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {SOURCE_ICONS[project.sourceProvider]}
            <Input
              value={selection.name}
              // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
              onChange={e => handleNameChange(e.target.value)}
              className="h-7 max-w-xs border-none bg-transparent px-1 text-sm font-medium shadow-none focus-visible:ring-1"
              disabled={selection.skip}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onClick={() => setExpanded(!expanded)}
              disabled={selection.skip}>
              {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
              {t('editSteps')}
            </Button>
            {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
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
              // biome-ignore lint/suspicious/noArrayIndexKey: imported steps lack stable id before save
              <div key={`step-edit-${i}`} className="flex items-center gap-2">
                <GripVertical className="size-4 text-muted-foreground" aria-hidden="true" />
                <Input
                  value={step.name}
                  // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
                  onChange={e => handleRenameStep(i, e.target.value)}
                  placeholder={t('stepFallback', { number: i + 1 })}
                  className="h-7 flex-1 text-sm"
                />
                <Button
                  variant="ghost"
                  size="icon-xs"
                  // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                  onClick={() => handleMoveStep(i, 'up')}
                  disabled={i === 0}
                  aria-label={tAria('moveUp')}>
                  <ArrowUp className="size-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                  onClick={() => handleMoveStep(i, 'down')}
                  disabled={i === selection.steps.length - 1}
                  aria-label={tAria('moveDown')}>
                  <ArrowDown className="size-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                  onClick={() => handleRemoveStep(i)}
                  aria-label={tAria('removeStep')}>
                  <X className="size-3" />
                </Button>
              </div>
            ))}

            {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
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

export interface ProjectImportStepProps {
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
  onRefetch: () => void;
  projects: FetchProjectsOutput;
  getProjectKey: (project: FetchProjectsOutput[number]) => string;
  getSelectionFor: (project: FetchProjectsOutput[number]) => ProjectSelection;
  onSelectionChange: (key: string, selection: ProjectSelection) => void;
}

export function ProjectImportStep({
  isLoading,
  isError,
  isEmpty,
  onRefetch,
  projects,
  getProjectKey,
  getSelectionFor,
  onSelectionChange,
}: ProjectImportStepProps) {
  const t = useTranslations('OnboardingImport.step3');
  const tCommon = useTranslations('Common');
  const tErr = useTranslations('Contractors.error');

  if (isLoading) {
    return <ProjectImportSkeleton />;
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <p className="text-sm text-muted-foreground">{tCommon('networkError')}</p>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
          onClick={onRefetch}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          {tErr('retry')}
        </Button>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <FolderKanban className="size-12 text-muted-foreground" aria-hidden="true" />
        <h3 className="text-lg font-semibold">{t('emptyHeading')}</h3>
        <p className="max-w-md text-center text-sm text-muted-foreground">{t('emptyBody')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold leading-[1.2]">{t('heading')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="space-y-4">
        {projects.map(project => {
          const key = getProjectKey(project);
          return (
            <ProjectCard
              key={key}
              project={project}
              selection={getSelectionFor(project)}
              // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
              onSelectionChange={s => onSelectionChange(key, s)}
            />
          );
        })}
      </div>

      <p className="text-sm text-muted-foreground italic">{t('syncNote')}</p>
    </div>
  );
}
