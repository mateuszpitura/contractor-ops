'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/trpc/init';
import { enumKey } from '@/lib/enum-key';

// ---------------------------------------------------------------------------
// Template type badge styling
// ---------------------------------------------------------------------------

const templateTypeBadgeColors: Record<string, string> = {
  ONBOARDING: 'bg-primary/10 text-primary',
  OFFBOARDING: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  DOCUMENT_COLLECTION: 'bg-muted text-muted-foreground',
  COMPLIANCE_REVIEW: 'bg-muted text-muted-foreground',
  CUSTOM: 'bg-muted text-muted-foreground',
};

// ---------------------------------------------------------------------------
// Template row type
// ---------------------------------------------------------------------------

type TemplateOption = {
  id: string;
  name: string;
  type: string;
  description?: string | null;
  _count: {
    tasks: number;
  };
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface TemplatePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractorId?: string;
  contractId?: string;
  preFilterType?: string;
  /** When starting workflows for multiple contractors (bulk action) */
  contractorIds?: string[];
}

/**
 * Dialog for selecting a workflow template and starting a workflow run.
 * Searches active templates, shows type badge + task count, confirms start.
 */
export function TemplatePicker({
  open,
  onOpenChange,
  contractorId,
  contractId,
  preFilterType,
  contractorIds,
}: TemplatePickerProps) {
  const t = useTranslations('Workflows');
  const tp = useTranslations('Workflows.templatePicker');
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(preFilterType ?? null);

  // Fetch active templates
  const templatesQuery = useQuery({
    ...trpc.workflow.listTemplates.queryOptions({
      page: 1,
      pageSize: 50,
      status: ['ACTIVE'],
      search: search.length >= 2 ? search : undefined,
    }),
    enabled: open,
  });

  const templates = useMemo(() => {
    const result = templatesQuery.data as { items: TemplateOption[] } | undefined;
    let items = result?.items ?? [];

    // Apply type filter if set
    if (typeFilter) {
      items = items.filter(tmpl => tmpl.type === typeFilter);
    }

    return items;
  }, [templatesQuery.data, typeFilter]);

  const isLoading = templatesQuery.isLoading;

  // Start run mutation
  const startRunMutation = useMutation(trpc.workflow.startRun.mutationOptions());

  const isBulk = contractorIds && contractorIds.length > 0;
  const effectiveContractorId = contractorId ?? contractorIds?.[0];

  const handleStart = useCallback(async () => {
    if (!selectedId) return;

    try {
      let totalCalendarTasks = 0;

      if (isBulk && contractorIds) {
        // Bulk: create one run per contractor
        const results = await Promise.all(
          contractorIds.map(cId =>
            startRunMutation.mutateAsync({
              templateId: selectedId,
              contractorId: cId,
              contractId,
            }),
          ),
        );
        for (const r of results) {
          const result = r as { calendarTaskCount?: number };
          totalCalendarTasks += result.calendarTaskCount ?? 0;
        }
      } else if (effectiveContractorId) {
        const result = (await startRunMutation.mutateAsync({
          templateId: selectedId,
          contractorId: effectiveContractorId,
          contractId,
        })) as { calendarTaskCount?: number };
        totalCalendarTasks = result.calendarTaskCount ?? 0;
      }

      toast.success(t('toast.workflowStarted'));

      if (totalCalendarTasks > 0) {
        toast.info(`Calendar events are being created for ${totalCalendarTasks} task(s)`);
      }
      onOpenChange(false);
      setSelectedId(null);
      setSearch('');

      // Invalidate workflow queries
      void queryClient.invalidateQueries({
        queryKey: [['workflow']],
      });
    } catch {
      toast.error(t('errors.failedToStartWorkflow'));
    }
  }, [
    selectedId,
    isBulk,
    contractorIds,
    effectiveContractorId,
    contractId,
    startRunMutation,
    onOpenChange,
    queryClient,
    t,
  ]);

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        setSelectedId(null);
        setSearch('');
        setTypeFilter(preFilterType ?? null);
      }
      onOpenChange(isOpen);
    },
    [onOpenChange, preFilterType],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{tp('title')}</DialogTitle>
          <DialogDescription>
            {isBulk && contractorIds ? tp('startForCount', { count: contractorIds.length }) : null}
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
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

        {/* Type filter clear */}
        {!!typeFilter && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {t(`templateType.${enumKey(typeFilter)}` as Parameters<typeof t>[0])}
            </Badge>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground underline"
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onClick={() => setTypeFilter(null)}>
              {t('clearAll')}
            </button>
          </div>
        )}

        {/* Template list */}
        <ScrollArea className="max-h-[320px]">
          {isLoading ? (
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
          ) : templates.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm font-medium">{tp('noTemplates')}</p>
              <p className="mt-1 text-sm text-muted-foreground">{tp('noTemplatesBody')}</p>
            </div>
          ) : (
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
                      <Badge
                        variant="secondary"
                        className={templateTypeBadgeColors[template.type] ?? ''}>
                        {t(`templateType.${enumKey(template.type)}` as Parameters<typeof t>[0])}
                      </Badge>
                    </div>
                  </div>
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    {tp('taskCount', { count: template._count.tasks })}
                  </p>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        <DialogFooter>
          {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            {tp('close')}
          </Button>
          <Button
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
            onClick={() => void handleStart()}
            disabled={
              !selectedId || startRunMutation.isPending || !(effectiveContractorId || isBulk)
            }>
            {startRunMutation.isPending ? '...' : tp('start')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
