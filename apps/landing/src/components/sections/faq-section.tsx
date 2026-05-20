'use client';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@contractor-ops/ui/components/shadcn/collapsible';
import { cn } from '@contractor-ops/ui/lib/utils';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

interface FaqItem {
  question: string;
  answer: string;
}

interface FaqSectionProps {
  label: string;
  headline: string;
  headlineHighlight: string;
  description: string;
  items: readonly FaqItem[];
}

export function FaqSection({
  label,
  headline,
  headlineHighlight,
  description,
  items,
}: FaqSectionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="relative py-24">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 md:grid-cols-[18rem,1fr] md:items-start">
        <header className="md:sticky md:top-28">
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.22em] text-primary">
            {label}
          </p>
          <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            {headline}{' '}
            <span className="bg-gradient-to-r from-primary via-primary/80 to-foreground bg-clip-text text-transparent">
              {headlineHighlight}
            </span>
          </h2>
          <p className="mt-3 text-sm text-muted-foreground md:text-base">{description}</p>
        </header>

        <ul className="space-y-2">
          {items.map((item, index) => {
            const open = openIndex === index;
            return (
              <li key={item.question}>
                <Collapsible
                  open={open}
                  onOpenChange={(next: boolean) => setOpenIndex(next ? index : null)}
                  className={cn(
                    'overflow-hidden rounded-xl border border-border/60 bg-card/40 backdrop-blur transition-colors',
                    open ? 'border-primary/40' : 'hover:border-border',
                  )}>
                  <CollapsibleTrigger
                    className={cn(
                      'flex w-full items-center justify-between gap-4 px-4 py-4 text-left text-base font-medium',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                    )}>
                    <span>{item.question}</span>
                    <ChevronDown
                      aria-hidden
                      className={cn(
                        'size-4 shrink-0 text-muted-foreground transition-transform duration-200',
                        open && 'rotate-180 text-primary',
                      )}
                    />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-4 pb-4 text-sm leading-relaxed text-muted-foreground">
                    {item.answer}
                  </CollapsibleContent>
                </Collapsible>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
