import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { FileText } from 'lucide-react';
import type { ReactNode } from 'react';

import { useTranslations } from '../../i18n/useTranslations.js';

type DocumentListProps = {
  isLoading: boolean;
  isEmpty: boolean;
  children: ReactNode;
};

export function DocumentList({ isLoading, isEmpty, children }: DocumentListProps) {
  const t = useTranslations('Documents');

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
          <div key={`skel-${i}`} className="flex items-start gap-4 rounded-lg border p-4">
            <Skeleton className="size-12 rounded-md" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 text-center">
        <FileText className="size-8 text-muted-foreground/50" />
        <h4 className="text-sm font-medium text-muted-foreground">{t('empty.title')}</h4>
        <p className="max-w-sm text-sm text-muted-foreground">{t('empty.description')}</p>
      </div>
    );
  }

  return <div className="space-y-3">{children}</div>;
}
