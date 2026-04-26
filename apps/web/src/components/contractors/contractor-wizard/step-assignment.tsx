'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import type { UseFormReturn } from 'react-hook-form';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

  const {
    setValue,
    watch,
    formState: { errors },
  } = form;

  const usersQuery = useQuery(trpc.user.list.queryOptions());
  const users = Array.isArray(usersQuery.data) ? usersQuery.data : [];

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

      {/* Team (optional, placeholder) */}
      <div className="space-y-2">
        <Label className="text-[13px]">{t('team')}</Label>
        <Select disabled>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t('team')} />
          </SelectTrigger>
          <SelectContent>{/* Teams not yet queryable */}</SelectContent>
        </Select>
      </div>

      {/* Project (optional, placeholder) */}
      <div className="space-y-2">
        <Label className="text-[13px]">{t('project')}</Label>
        <Select disabled>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t('project')} />
          </SelectTrigger>
          <SelectContent>{/* Projects not yet queryable */}</SelectContent>
        </Select>
      </div>

      {/* Cost center (optional, placeholder) */}
      <div className="space-y-2">
        <Label className="text-[13px]">{t('costCenter')}</Label>
        <Select disabled>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t('costCenter')} />
          </SelectTrigger>
          <SelectContent>{/* Cost centers not yet queryable */}</SelectContent>
        </Select>
      </div>
    </div>
  );
}
