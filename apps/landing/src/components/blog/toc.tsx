'use client';

import { TracingBeam } from '@contractor-ops/ui/components/ace/tracing-beam';
import { cn } from '@contractor-ops/ui/lib/utils';
import { useEffect, useState } from 'react';

export interface TocHeading {
  id: string;
  text: string;
  level: 2 | 3;
}

interface TocProps {
  headings: readonly TocHeading[];
  className?: string;
}

export function Toc({ headings, className }: TocProps) {
  const [activeId, setActiveId] = useState<string | null>(headings[0]?.id ?? null);

  useEffect(() => {
    if (typeof window === 'undefined' || headings.length === 0) {
      return;
    }
    const elements = headings
      .map(h => document.getElementById(h.id))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) {
      return;
    }
    const observer = new IntersectionObserver(
      entries => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: '-30% 0px -55% 0px', threshold: [0, 1] },
    );
    for (const el of elements) {
      observer.observe(el);
    }
    return () => observer.disconnect();
  }, [headings]);

  if (headings.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Table of contents" className={cn('text-sm', className)}>
      <TracingBeam className="!max-w-none">
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          On this page
        </p>
        <ol className="space-y-1.5 ps-4">
          {headings.map(heading => {
            const active = activeId === heading.id;
            return (
              <li key={heading.id} className={heading.level === 3 ? 'ps-3' : ''}>
                <a
                  href={`#${heading.id}`}
                  className={cn(
                    'block text-muted-foreground transition-colors',
                    active && 'font-medium text-primary',
                    !active && 'hover:text-foreground',
                  )}>
                  {heading.text}
                </a>
              </li>
            );
          })}
        </ol>
      </TracingBeam>
    </nav>
  );
}
