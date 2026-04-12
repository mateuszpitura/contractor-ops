"use client";

import type { FetchProjectsOutput } from "@contractor-ops/validators";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  FolderKanban,
  GripVertical,
  Plus,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/trpc/init";
import type { ProjectSelection } from "./import-wizard";

// ---------------------------------------------------------------------------
// Source icon helpers
// ---------------------------------------------------------------------------

import { JiraBrandIcon, LinearBrandIcon } from "@/components/integrations/brand-icons";

const SOURCE_ICONS: Record<string, React.ReactNode> = {
  JIRA: <JiraBrandIcon className="size-4" />,
  LINEAR: <LinearBrandIcon className="size-4" />,
};

// ---------------------------------------------------------------------------
// Project card with editable steps
// ---------------------------------------------------------------------------

interface ProjectCardProps {
  project: FetchProjectsOutput[number];
  selection: ProjectSelection;
  onSelectionChange: (sel: ProjectSelection) => void;
}

function ProjectCard({ project, selection, onSelectionChange }: ProjectCardProps) {
  const t = useTranslations("OnboardingImport.step3");
  const [expanded, setExpanded] = useState(false);

  const handleSkip = () => {
    onSelectionChange({ ...selection, skip: !selection.skip });
  };

  const handleNameChange = (name: string) => {
    onSelectionChange({ ...selection, name });
  };

  const handleAddStep = () => {
    const steps = [...selection.steps];
    steps.push({
      name: "",
      sortOrder: steps.length,
    });
    onSelectionChange({ ...selection, steps });
  };

  const handleRemoveStep = (index: number) => {
    const steps = selection.steps.filter((_, i) => i !== index);
    // Reindex sort orders
    const reindexed = steps.map((s, i) => ({ ...s, sortOrder: i }));
    onSelectionChange({ ...selection, steps: reindexed });
  };

  const handleRenameStep = (index: number, name: string) => {
    const steps = [...selection.steps];
    steps[index] = { ...steps[index], name };
    onSelectionChange({ ...selection, steps });
  };

  const handleMoveStep = (index: number, direction: "up" | "down") => {
    const steps = [...selection.steps];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= steps.length) return;
    [steps[index], steps[targetIndex]] = [steps[targetIndex], steps[index]];
    const reindexed = steps.map((s, i) => ({ ...s, sortOrder: i }));
    onSelectionChange({ ...selection, steps: reindexed });
  };

  return (
    <Card className={selection.skip ? "opacity-50" : ""}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {SOURCE_ICONS[project.sourceProvider]}
            <Input
              value={selection.name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="h-7 max-w-xs border-none bg-transparent px-1 text-sm font-medium shadow-none focus-visible:ring-1"
              disabled={selection.skip}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              disabled={selection.skip}
            >
              {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
              {t("editSteps")}
            </Button>
            <Button variant="link" size="sm" onClick={handleSkip} className="text-muted-foreground">
              {t("skipProject")}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Step chips (collapsed view) */}
        {!expanded && (
          <div className="flex flex-wrap gap-1.5">
            {selection.steps.map((step, i) => (
              <Badge key={`step-chip-${i}`} variant="secondary">
                {step.name || `Step ${i + 1}`}
              </Badge>
            ))}
          </div>
        )}

        {/* Editable step list (expanded view) */}
        {expanded && !selection.skip && (
          <div className="space-y-2">
            {selection.steps.map((step, i) => (
              <div key={`step-edit-${i}`} className="flex items-center gap-2">
                <GripVertical className="size-4 text-muted-foreground" aria-hidden="true" />
                <Input
                  value={step.name}
                  onChange={(e) => handleRenameStep(i, e.target.value)}
                  placeholder={`Step ${i + 1}`}
                  className="h-7 flex-1 text-sm"
                />
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => handleMoveStep(i, "up")}
                  disabled={i === 0}
                  aria-label="Move up"
                >
                  <ArrowUp className="size-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => handleMoveStep(i, "down")}
                  disabled={i === selection.steps.length - 1}
                  aria-label="Move down"
                >
                  <ArrowDown className="size-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => handleRemoveStep(i)}
                  aria-label="Remove step"
                >
                  <X className="size-3" />
                </Button>
              </div>
            ))}

            <Button variant="outline" size="sm" onClick={handleAddStep} className="mt-1">
              <Plus className="size-3" />
              {t("addStep")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// ProjectImportStep
// ---------------------------------------------------------------------------

interface ProjectImportStepProps {
  selectedSources: string[];
  projects: FetchProjectsOutput;
  onProjectsChange: (projects: FetchProjectsOutput) => void;
  projectSelections: Map<string, ProjectSelection>;
  onProjectSelectionsChange: (selections: Map<string, ProjectSelection>) => void;
}

export function ProjectImportStep({
  selectedSources,
  projects,
  onProjectsChange,
  projectSelections,
  onProjectSelectionsChange,
}: ProjectImportStepProps) {
  const t = useTranslations("OnboardingImport.step3");

  // Only fetch from PM tools
  const pmSources = selectedSources.filter((s) => s === "JIRA" || s === "LINEAR");

  const projectsQuery = useQuery({
    ...trpc.onboardingImport.fetchProjects.queryOptions({
      sources: pmSources as ["JIRA" | "LINEAR"],
    }),
    enabled: pmSources.length > 0,
  });

  // Initialize selections when data arrives
  useEffect(() => {
    if (projectsQuery.data && projects.length === 0) {
      const data = projectsQuery.data as FetchProjectsOutput;
      onProjectsChange(data);

      const newSelections = new Map<string, ProjectSelection>();
      for (const project of data) {
        const key = `${project.sourceProvider}-${project.externalId}`;
        newSelections.set(key, {
          skip: false,
          name: project.name,
          steps: project.statuses.map((s, i) => ({
            name: s.name,
            sortOrder: i,
          })),
        });
      }
      onProjectSelectionsChange(newSelections);
    }
  }, [projectsQuery.data, projects.length, onProjectsChange, onProjectSelectionsChange]);

  const handleSelectionChange = useCallback(
    (key: string, sel: ProjectSelection) => {
      const next = new Map(projectSelections);
      next.set(key, sel);
      onProjectSelectionsChange(next);
    },
    [projectSelections, onProjectSelectionsChange],
  );

  // Loading state
  if (projectsQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={`skel-${i}`} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  // Empty state
  if (projects.length === 0 && pmSources.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <FolderKanban className="size-12 text-muted-foreground" aria-hidden="true" />
        <h3 className="text-lg font-semibold">{t("emptyHeading")}</h3>
        <p className="max-w-md text-center text-sm text-muted-foreground">{t("emptyBody")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Heading */}
      <div>
        <h2 className="font-display text-xl font-semibold leading-[1.2]">{t("heading")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* Project cards */}
      <div className="space-y-4">
        {projects.map((project) => {
          const key = `${project.sourceProvider}-${project.externalId}`;
          const sel = projectSelections.get(key) ?? {
            skip: false,
            name: project.name,
            steps: project.statuses.map((s, i) => ({
              name: s.name,
              sortOrder: i,
            })),
          };

          return (
            <ProjectCard
              key={key}
              project={project}
              selection={sel}
              onSelectionChange={(s) => handleSelectionChange(key, s)}
            />
          );
        })}
      </div>

      {/* Sync note */}
      <p className="text-sm text-muted-foreground italic">{t("syncNote")}</p>
    </div>
  );
}
