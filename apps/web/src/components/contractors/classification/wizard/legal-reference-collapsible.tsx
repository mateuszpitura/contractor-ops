'use client';

// ---------------------------------------------------------------------------
// LegalReferenceCollapsible — per-question case-law / DRV citation disclosure
// ---------------------------------------------------------------------------
// See UI-SPEC §Interaction 5. Uses the shadcn Collapsible primitive (Radix-
// derived) which owns aria-expanded — no manual sync needed.

import { ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

export interface LegalReferenceCollapsibleProps {
  citation: string;
  kind: 'case-law' | 'drv';
}

export function LegalReferenceCollapsible({ citation, kind }: LegalReferenceCollapsibleProps) {
  const t = useTranslations('Classification.legalReference');
  const [open, setOpen] = useState(false);
  const contentId = useId();
  const triggerLabel = open ? t('hide') : t('show');

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger
        className={cn(
          'inline-flex items-center gap-1 rounded text-xs text-muted-foreground',
          'transition-colors hover:text-primary',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        )}
        aria-label={t('ariaLabel')}
        aria-controls={contentId}>
        <ChevronRight
          className={cn(
            'h-3 w-3 transition-transform motion-reduce:transition-none',
            open && 'rotate-90',
          )}
          aria-hidden="true"
        />
        <span>{triggerLabel}</span>
      </CollapsibleTrigger>
      <CollapsibleContent
        id={contentId}
        data-kind={kind}
        className="mt-2 rounded-md border border-primary/20 bg-primary/5 p-3 text-sm">
        {citation}
      </CollapsibleContent>
    </Collapsible>
  );
}
