'use client';

import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Card, CardContent } from '@contractor-ops/ui/components/shadcn/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@contractor-ops/ui/components/shadcn/select';
import type { DirectoryRole } from '@contractor-ops/validators';
import { useTranslations } from 'next-intl';
import { ROLE_LABELS, ROLE_OPTIONS } from './role-assignment-controls';

// ---------------------------------------------------------------------------
// GroupRoleMappingStep
// ---------------------------------------------------------------------------

interface GroupRoleMappingStepProps {
  groups: Array<{
    id: string;
    email: string;
    name: string;
    memberEmails: string[];
  }>;
  mappings: Map<string, DirectoryRole>;
  onMappingChange: (groupEmail: string, role: DirectoryRole) => void;
  defaultRole: DirectoryRole;
}

export function GroupRoleMappingStep({
  groups,
  mappings,
  onMappingChange,
  defaultRole,
}: GroupRoleMappingStepProps) {
  const t = useTranslations('GoogleWorkspace.import');

  if (groups.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">{t('groupMappingTitle')}</h3>
        <p className="text-sm text-muted-foreground">
          {t('groupMappingFound', { count: groups.length })}
        </p>
      </div>

      <div className="space-y-2">
        {groups.map(group => {
          const mappedRole = mappings.get(group.email);
          const displayRole = mappedRole ?? defaultRole;

          return (
            <Card key={group.id}>
              <CardContent className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{group.name}</span>
                  <Badge variant="secondary">{group.memberEmails.length}</Badge>
                </div>

                <div className="flex items-center gap-2">
                  <Select
                    value={mappedRole ?? ''}
                    // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
                    onValueChange={val => {
                      if (val) onMappingChange(group.email, val as DirectoryRole);
                    }}>
                    <SelectTrigger className="w-48">
                      <SelectValue>{ROLE_LABELS[displayRole]}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map(role => (
                        <SelectItem key={role} value={role}>
                          {ROLE_LABELS[role]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {!mappedRole && (
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {t('default')}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">{t('groupMappingHint')}</p>
    </div>
  );
}
