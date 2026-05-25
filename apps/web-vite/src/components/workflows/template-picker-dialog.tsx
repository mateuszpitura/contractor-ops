import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@contractor-ops/ui/components/shadcn/dialog';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { ScrollArea } from '@contractor-ops/ui/components/shadcn/scroll-area';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { LayoutTemplate, Search, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';

import { tDynLoose } from '../../i18n/typed-keys.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { enumKey } from '../../lib/enum-key.js';
import type { TemplateOption, useTemplatePicker } from './hooks/use-template-picker.js';

const templateTypeBadgeColors: Record<string, string> = {
  ONBOARDING: 'bg-primary/10 text-primary',
  OFFBOARDING: 'bg-amber-500/10 text-amber-800 dark:text-amber-400',
  DOCUMENT_COLLECTION: 'bg-muted text-muted-foreground',
  COMPLIANCE_REVIEW: 'bg-muted text-muted-foreground',
  CUSTOM: 'bg-muted text-muted-foreground',
};

export function TemplatePickerListSkeleton() {
  return (
    <div className="space-y-2 p-1">
      {Array.from({ length: 4 }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
        <div key={`skel-${i}`} className="flex items-center gap-3 rounded-lg border p-3">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

export function TemplatePickerListEmpty() {
  const tp = useTranslations('Workflows.templatePicker');
  return (
    <div className="py-8 text-center">
      <p className="text-sm font-medium">{tp('noTemplates')}</p>
      <p className="mt-1 text-sm text-muted-foreground">{tp('noTemplatesBody')}</p>
    </div>
  );
}

interface TemplatePickerListProps {
  templates: TemplateOption[];
  selectedId: string | null;
  setSelectedId: (id: string) => void;
}

export function TemplatePickerList({
  templates,
  selectedId,
  setSelectedId,
}: TemplatePickerListProps) {
  const t = useTranslations('Workflows');
  const tp = useTranslations('Workflows.templatePicker');

  return (
    <div className="space-y-1 p-1">
      {templates.map(template => (
        <button
          key={template.id}
          type="button"
          className={`w-full text-start rounded-lg border p-3 transition-colors hover:bg-accent/50 ${
            selectedId === template.id ? 'ring-2 ring-primary border-primary' : ''
          }`}
          // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
          onClick={() => setSelectedId(template.id)}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{template.name}</p>
              {!!template.description && (
                <p className="mt-0.5 text-[13px] text-muted-foreground line-clamp-2">
                  {template.description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="secondary" className={templateTypeBadgeColors[template.type] ?? ''}>
                {tDynLoose(t, 'templateType', enumKey(template.type))}
              </Badge>
            </div>
          </div>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {tp('taskCount', { count: template._count.tasks })}
          </p>
        </button>
      ))}
    </div>
  );
}

interface TemplatePickerDialogProps extends ReturnType<typeof useTemplatePicker> {
  open: boolean;
  listContent: ReactNode;
}

/**
 * Presentational dialog for selecting a workflow template and starting a run.
 * The container decides which list variant (skeleton / empty / list) to render
 * and passes it as `listContent`; this view is the single dialog shell render.
 */
export function TemplatePicker({
  open,
  search,
  setSearch,
  typeFilter,
  setTypeFilter,
  isBulk,
  contractorIds,
  suggestionEnabled,
  suggestedTemplate,
  startRunMutation,
  handleStart,
  handleOpenChange,
  canStart,
  listContent,
}: TemplatePickerDialogProps) {
  const t = useTranslations('Workflows');
  const tp = useTranslations('Workflows.templatePicker');

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutTemplate className="size-4" />
            {tp('title')}
          </DialogTitle>
          <DialogDescription>
            {isBulk && contractorIds ? tp('startForCount', { count: contractorIds.length }) : null}
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={tp('searchPlaceholder')}
            value={search}
            // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
            onChange={e => setSearch(e.target.value)}
            className="h-9 ps-9"
          />
        </div>

        {!!typeFilter && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{tDynLoose(t, 'templateType', enumKey(typeFilter))}</Badge>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground underline"
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onClick={() => setTypeFilter(null)}>
              {t('clearAll')}
            </button>
          </div>
        )}

        {suggestionEnabled && !!suggestedTemplate && (
          <div className="rounded-md border border-primary/30 bg-primary/5 p-2.5 flex items-start gap-2">
            <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium text-foreground">{tp('suggestedHeading')}</p>
              <p className="text-[12px] text-muted-foreground truncate">
                {tp('suggestedBody', { name: suggestedTemplate.name })}
              </p>
            </div>
          </div>
        )}

        <ScrollArea className="max-h-[320px]">{listContent}</ScrollArea>

        <DialogFooter>
          {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            {tp('close')}
          </Button>
          <Button
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
            onClick={() => void handleStart()}
            disabled={!canStart || startRunMutation.isPending}>
            {startRunMutation.isPending ? '...' : tp('start')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
