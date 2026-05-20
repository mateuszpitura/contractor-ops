'use client';

// Wizard step 3: assignment dropdowns (owner / team / project / cost center).
//
// `TeamFormSheet`, `ProjectFormSheet`, `CostCenterFormSheet` are opened from
// inside the wizard `Dialog`. Both primitives use Base UI's `Portal`
// (`SheetPortal` / `DialogPortal`), so the sheet mounts at `document.body`
// rather than as a DOM descendant of the dialog. The Base UI focus-stack
// handles ordering — the most-recently-opened modal owns the focus trap,
// closing the sheet returns focus to the wizard. No `pointer-events` clash
// because both overlays z-index over a shared backdrop.

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@contractor-ops/ui/components/shadcn/select';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { CostCenterFormSheet } from '@/components/organization/cost-centers/cost-center-form-sheet';
import { ProjectFormSheet } from '@/components/organization/projects/project-form-sheet';
import { TeamFormSheet } from '@/components/organization/teams/team-form-sheet';
import { usePermissions } from '@/hooks/use-permissions';
import { trpc } from '@/trpc/init';

import type { WizardFormValues } from './wizard-dialog';

interface StepAssignmentProps {
  form: UseFormReturn<WizardFormValues>;
}

/**
 * Step 3: Assignment — owner, team, project, cost center.
 * Owner is required; team, project, and cost center are optional placeholders.
 */
export function StepAssignment({ form }: StepAssignmentProps) {
  const t = useTranslations('ContractorWizard.fields');
  const { can } = usePermissions();
  const queryClient = useQueryClient();

  const {
    setValue,
    watch,
    formState: { errors },
  } = form;

  const usersQuery = useQuery(trpc.user.list.queryOptions());
  const users = Array.isArray(usersQuery.data) ? usersQuery.data : [];

  const teamsQuery = useQuery(
    trpc.organizationDefinitions.team.list.queryOptions({ status: 'ACTIVE', limit: 200 }),
  );
  const projectsQuery = useQuery(
    trpc.organizationDefinitions.project.list.queryOptions({ status: 'ACTIVE', limit: 200 }),
  );
  const costCentersQuery = useQuery(
    trpc.organizationDefinitions.costCenter.list.queryOptions({ status: 'ACTIVE', limit: 200 }),
  );

  const [teamSheetOpen, setTeamSheetOpen] = useState(false);
  const [projectSheetOpen, setProjectSheetOpen] = useState(false);
  const [costCenterSheetOpen, setCostCenterSheetOpen] = useState(false);

  const teams = teamsQuery.data?.items ?? [];
  const projects = projectsQuery.data?.items ?? [];
  const costCenters = costCentersQuery.data?.items ?? [];

  return (
    <div className="space-y-4">
      {/* Owner (required) */}
      <div className="space-y-2">
        <Label className="text-[13px]">{t('owner')}</Label>
        {(() => {
          const ownerItems = (
            users as unknown as Array<{
              id?: string;
              userId?: string;
              role?: string;
              user?: { id: string; name: string | null; email: string; image?: string | null };
            }>
          ).map(member => {
            const userId = member.userId ?? member.user?.id ?? member.id ?? '';
            const label = member.user?.name ?? member.user?.email ?? userId;
            return { value: userId, label };
          });
          return (
            <Select
              value={watch('ownerUserId') ?? ''}
              // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
              onValueChange={value =>
                setValue('ownerUserId', value ?? '', {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
              items={ownerItems}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('owner')} />
              </SelectTrigger>
              <SelectContent>
                {ownerItems.map(item => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        })()}
        {!!errors.ownerUserId && (
          <p className="text-sm text-destructive">{errors.ownerUserId.message}</p>
        )}
      </div>

      {/* Team — populated from Organization > Teams; Add new… visible to admins. */}
      <div className="space-y-2">
        <Label className="text-[13px]">{t('team')}</Label>
        <Select
          value={watch('primaryTeamId') ?? ''}
          onValueChange={value => setValue('primaryTeamId', value ?? '', { shouldDirty: true })}
          items={teams.map(team => ({ value: team.id, label: team.name }))}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t('team')} />
          </SelectTrigger>
          <SelectContent>
            {teams.map(team => (
              <SelectItem key={team.id} value={team.id}>
                {team.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {can('team', ['create']) && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground h-7 px-2 text-xs"
            onClick={() => setTeamSheetOpen(true)}>
            <Plus className="mr-1 h-3 w-3" /> Add new…
          </Button>
        )}
      </div>

      {/* Project */}
      <div className="space-y-2">
        <Label className="text-[13px]">{t('project')}</Label>
        <Select
          value={watch('primaryProjectId') ?? ''}
          onValueChange={value => setValue('primaryProjectId', value ?? '', { shouldDirty: true })}
          items={projects.map(p => ({ value: p.id, label: p.name }))}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t('project')} />
          </SelectTrigger>
          <SelectContent>
            {projects.map(p => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {can('project', ['create']) && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground h-7 px-2 text-xs"
            onClick={() => setProjectSheetOpen(true)}>
            <Plus className="mr-1 h-3 w-3" /> Add new…
          </Button>
        )}
      </div>

      {/* Cost center */}
      <div className="space-y-2">
        <Label className="text-[13px]">{t('costCenter')}</Label>
        <Select
          value={watch('defaultCostCenterId') ?? ''}
          onValueChange={value =>
            setValue('defaultCostCenterId', value ?? '', { shouldDirty: true })
          }
          items={costCenters.map(cc => ({ value: cc.id, label: `${cc.name} (${cc.code})` }))}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t('costCenter')} />
          </SelectTrigger>
          <SelectContent>
            {costCenters.map(cc => (
              <SelectItem key={cc.id} value={cc.id}>
                {cc.name} ({cc.code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {can('costCenter', ['create']) && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground h-7 px-2 text-xs"
            onClick={() => setCostCenterSheetOpen(true)}>
            <Plus className="mr-1 h-3 w-3" /> Add new…
          </Button>
        )}
      </div>

      <TeamFormSheet
        open={teamSheetOpen}
        onOpenChange={setTeamSheetOpen}
        onCreated={team => {
          void queryClient.invalidateQueries({
            queryKey: trpc.organizationDefinitions.team.list.queryKey(),
          });
          setValue('primaryTeamId', team.id, { shouldDirty: true });
        }}
      />
      <ProjectFormSheet
        open={projectSheetOpen}
        onOpenChange={setProjectSheetOpen}
        onCreated={project => {
          void queryClient.invalidateQueries({
            queryKey: trpc.organizationDefinitions.project.list.queryKey(),
          });
          setValue('primaryProjectId', project.id, { shouldDirty: true });
        }}
      />
      <CostCenterFormSheet
        open={costCenterSheetOpen}
        onOpenChange={setCostCenterSheetOpen}
        onCreated={cc => {
          void queryClient.invalidateQueries({
            queryKey: trpc.organizationDefinitions.costCenter.list.queryKey(),
          });
          setValue('defaultCostCenterId', cc.id, { shouldDirty: true });
        }}
      />
    </div>
  );
}
