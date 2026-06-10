import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@contractor-ops/ui/components/shadcn/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@contractor-ops/ui/components/shadcn/tooltip';
import { AlertTriangle } from 'lucide-react';
import type { ChangeEvent } from 'react';
import { useCallback, useState } from 'react';
import { useTranslations } from '../../i18n/useTranslations.js';

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

interface ConflictValueRowProps {
  field: string;
  value: string;
  source: string;
  resolved: string | undefined;
  onResolve: (field: string, value: string) => void;
}

function ConflictValueRow({ field, value, source, resolved, onResolve }: ConflictValueRowProps) {
  const handleChange = useCallback(() => onResolve(field, value), [field, value, onResolve]);
  return (
    <label className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted/50">
      <input
        type="radio"
        name={`conflict-${field}`}
        checked={resolved === value}
        onChange={handleChange}
        className="accent-primary"
      />
      <span className="flex-1">{value}</span>
      <Badge variant="secondary" className="text-[10px]">
        {source}
      </Badge>
    </label>
  );
}

interface CustomConflictRowProps {
  field: string;
  resolved: string | undefined;
  isCustom: boolean;
  customValue: string;
  placeholder: string;
  onCustomChange: (field: string, value: string) => void;
  onResolve: (field: string, value: string) => void;
}

function CustomConflictRow({
  field,
  isCustom,
  customValue,
  placeholder,
  onCustomChange,
  onResolve,
}: CustomConflictRowProps) {
  const handleRadioChange = useCallback(() => {
    if (customValue) onResolve(field, customValue);
  }, [field, customValue, onResolve]);

  const handleInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => onCustomChange(field, e.target.value),
    [field, onCustomChange],
  );

  const handleBlur = useCallback(() => {
    if (customValue) onResolve(field, customValue);
  }, [field, customValue, onResolve]);

  return (
    <label className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted/50">
      <input
        type="radio"
        name={`conflict-${field}`}
        checked={isCustom}
        onChange={handleRadioChange}
        className="accent-primary"
      />
      <Input
        placeholder={placeholder}
        value={customValue}
        onChange={handleInputChange}
        onBlur={handleBlur}
        className="h-7 text-xs"
      />
    </label>
  );
}

export function ConflictResolutionPopover({
  conflicts,
  resolvedConflicts,
  onResolve,
}: ConflictResolutionPopoverProps) {
  const t = useTranslations('OnboardingImport.step2');
  const [open, setOpen] = useState(false);
  const [customValues, setCustomValues] = useState<Record<string, string>>({});

  const unresolvedCount = conflicts.filter(c => !resolvedConflicts[c.field]).length;

  const handleCustomChange = useCallback((field: string, value: string) => {
    setCustomValues(prev => ({ ...prev, [field]: value }));
  }, []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            render={
              <PopoverTrigger
                render={
                  <Badge variant="warning" className="cursor-pointer" aria-expanded={open} />
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
            const isCustom = !!resolved && !conflict.values.some(cv => cv.value === resolved);

            return (
              <div key={conflict.field} className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">{conflict.field}</p>

                <div className="space-y-1">
                  {conflict.values.map(cv => (
                    <ConflictValueRow
                      key={`${conflict.field}-${cv.source}`}
                      field={conflict.field}
                      value={cv.value}
                      source={cv.source}
                      resolved={resolved}
                      onResolve={onResolve}
                    />
                  ))}

                  <CustomConflictRow
                    field={conflict.field}
                    resolved={resolved}
                    isCustom={isCustom}
                    customValue={customValues[conflict.field] ?? ''}
                    placeholder={t('conflictCustom')}
                    onCustomChange={handleCustomChange}
                    onResolve={onResolve}
                  />
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
