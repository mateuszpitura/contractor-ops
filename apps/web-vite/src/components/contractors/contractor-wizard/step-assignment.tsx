/**
 * Wizard step 3 — assignment dropdowns.
 */

import { Combobox } from '@contractor-ops/ui/components/reui/combobox';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@contractor-ops/ui/components/shadcn/select';
import { useCallback } from 'react';
import type { UseFormReturn } from 'react-hook-form';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useContractorWizardAssignmentOptions } from '../hooks/use-contractor-wizard.js';
import type { useContractorWizardAssignmentOptions as UseContractorWizardAssignmentOptions } from '../hooks/use-contractor-wizard.js';
import type { WizardFormValues } from './wizard-dialog.js';

type StepAssignmentViewProps = {
  form: UseFormReturn<WizardFormValues>;
} & ReturnType<typeof UseContractorWizardAssignmentOptions>;

export function StepAssignmentView({
  form,
  ownerItems,
  teams,
  projects,
  costCenters,
}: StepAssignmentViewProps) {
  const t = useTranslations('ContractorWizard.fields');

  const {
    setValue,
    watch,
    formState: { errors },
  } = form;

  const handleOwnerChange = useCallback(
    (value: string | null) => {
      setValue('ownerUserId', value ?? '', { shouldDirty: true, shouldValidate: true });
    },
    [setValue],
  );
  const handleTeamChange = useCallback(
    (value: string | null) => {
      setValue('primaryTeamId', value ?? '', { shouldDirty: true });
    },
    [setValue],
  );
  const handleProjectChange = useCallback(
    (value: string | null) => {
      setValue('primaryProjectId', value ?? '', { shouldDirty: true });
    },
    [setValue],
  );
  const handleCostCenterChange = useCallback(
    (value: string | null) => {
      setValue('defaultCostCenterId', value ?? '', { shouldDirty: true });
    },
    [setValue],
  );

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-[13px]">{t('owner')}</Label>
        <Combobox
          options={ownerItems}
          value={watch('ownerUserId') ?? null}
          onValueChange={handleOwnerChange}
          placeholder={t('owner')}
        />
        {!!errors.ownerUserId && (
          <p className="text-sm text-destructive">{errors.ownerUserId.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-[13px]">{t('team')}</Label>
        <Select
          value={watch('primaryTeamId') ?? ''}
          onValueChange={handleTeamChange}
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
      </div>

      <div className="space-y-2">
        <Label className="text-[13px]">{t('project')}</Label>
        <Select
          value={watch('primaryProjectId') ?? ''}
          onValueChange={handleProjectChange}
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
      </div>

      <div className="space-y-2">
        <Label className="text-[13px]">{t('costCenter')}</Label>
        <Select
          value={watch('defaultCostCenterId') ?? ''}
          onValueChange={handleCostCenterChange}
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
      </div>
    </div>
  );
}

export function StepAssignment({ form }: { form: UseFormReturn<WizardFormValues> }) {
  const options = useContractorWizardAssignmentOptions();
  return <StepAssignmentView form={form} {...options} />;
}
