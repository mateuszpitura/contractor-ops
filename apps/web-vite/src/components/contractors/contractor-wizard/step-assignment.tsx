/**
 * Wizard step 3 — assignment dropdowns. Step 11 codemod port from
 * apps/web with org inline-create sheets deferred (TemplatePicker batch).
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
import type { UseFormReturn } from 'react-hook-form';

import { useTranslations } from '../../../i18n/useTranslations.js';
import type { useContractorWizardAssignmentOptions } from '../hooks/use-contractor-wizard.js';
import type { WizardFormValues } from './wizard-dialog.js';

type StepAssignmentViewProps = {
  form: UseFormReturn<WizardFormValues>;
} & ReturnType<typeof useContractorWizardAssignmentOptions>;

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

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-[13px]">{t('owner')}</Label>
        <Combobox
          options={ownerItems}
          value={watch('ownerUserId') ?? null}
          onValueChange={value =>
            setValue('ownerUserId', value ?? '', {
              shouldDirty: true,
              shouldValidate: true,
            })
          }
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
      </div>

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
      </div>

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
      </div>
    </div>
  );
}
