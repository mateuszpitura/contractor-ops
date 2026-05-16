'use client';

import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConflictValue {
  source: string;
  value: string;
}

interface Conflict {
  field: string;
  values: ConflictValue[];
  resolved?: string;
}

interface ConflictResolutionPopoverProps {
  conflicts: Conflict[];
  resolvedConflicts: Record<string, string>;
  onResolve: (field: string, value: string) => void;
}

// ---------------------------------------------------------------------------
// ConflictResolutionPopover
// ---------------------------------------------------------------------------

export function ConflictResolutionPopover({
  conflicts,
  resolvedConflicts,
  onResolve,
}: ConflictResolutionPopoverProps) {
  const t = useTranslations('OnboardingImport.step2');
  const [customValues, setCustomValues] = useState<Record<string, string>>({});

  const unresolvedCount = conflicts.filter(c => !resolvedConflicts[c.field]).length;

  return (
    <Popover>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            render={
              <PopoverTrigger
                render={
                  <Badge variant="warning" className="cursor-pointer" aria-expanded={false} />
                }>
                {unresolvedCount > 0 && <AlertTriangle className="size-3" aria-hidden="true" />}
                {t('columnStatus')} ({unresolvedCount})
              </PopoverTrigger>
            }
          />
          <TooltipContent>{t('conflictTooltip')}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <PopoverContent className="w-80">
        <PopoverHeader>
          <PopoverTitle>{t('conflictTooltip')}</PopoverTitle>
        </PopoverHeader>

        <div className="space-y-4">
          {conflicts.map(conflict => {
            const resolved = resolvedConflicts[conflict.field];

            return (
              <div key={conflict.field} className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">{conflict.field}</p>

                <div className="space-y-1">
                  {conflict.values.map(cv => (
                    <label
                      key={`${conflict.field}-${cv.source}`}
                      className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted/50">
                      <input
                        type="radio"
                        name={`conflict-${conflict.field}`}
                        checked={resolved === cv.value}
                        // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
                        onChange={() => onResolve(conflict.field, cv.value)}
                        className="accent-primary"
                      />
                      <span className="flex-1">{cv.value}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {cv.source}
                      </Badge>
                    </label>
                  ))}

                  {/* Custom value option */}
                  <label className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted/50">
                    <input
                      type="radio"
                      name={`conflict-${conflict.field}`}
                      checked={!!resolved && !conflict.values.some(cv => cv.value === resolved)}
                      // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
                      onChange={() => {
                        const custom = customValues[conflict.field] ?? '';
                        if (custom) onResolve(conflict.field, custom);
                      }}
                      className="accent-primary"
                    />
                    <Input
                      placeholder={t('conflictCustom')}
                      value={customValues[conflict.field] ?? ''}
                      // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
                      onChange={e => {
                        setCustomValues(prev => ({
                          ...prev,
                          [conflict.field]: e.target.value,
                        }));
                      }}
                      // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                      onBlur={() => {
                        const custom = customValues[conflict.field];
                        if (custom) onResolve(conflict.field, custom);
                      }}
                      className="h-7 text-xs"
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>

        {unresolvedCount === 0 && <p className="mt-2 text-xs text-green-600">{t('resolvedAll')}</p>}
      </PopoverContent>
    </Popover>
  );
}
