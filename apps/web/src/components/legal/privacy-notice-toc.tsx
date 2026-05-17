'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface TocHeading {
  id: string;
  text: string;
}

/**
 * Phase 56 · Plan 07 — Client-side table of contents for privacy notices.
 *
 * Reads heading IDs hardcoded on `<main h2>` nodes and
 * builds a nav with anchor links. Scrollspy via `IntersectionObserver`
 * updates `aria-current="location"` on the active section — no scroll
 * handlers (GC-friendly, respects `prefers-reduced-motion`).
 */
export function PrivacyNoticeToc() {
  const t = useTranslations('Legal.privacy');
  const [headings, setHeadings] = useState<TocHeading[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const nodes = document.querySelectorAll<HTMLHeadingElement>('main h2');
    const collected: TocHeading[] = [];
    for (const node of nodes) {
      if (!node.id) continue;
      const text = node.textContent?.trim();
      if (!text) continue;
      collected.push({ id: node.id, text });
    }
    setHeadings(collected);

    if (collected.length === 0) return;

    const observer = new IntersectionObserver(
      entries => {
        const visible = entries
          .filter(entry => entry.isIntersecting)
          .sort(
            (a, b) => a.target.getBoundingClientRect().top - b.target.getBoundingClientRect().top,
          );
        if (visible[0]) {
          setActiveId(visible[0].target.id);
        }
      },
      {
        // Trigger when heading crosses the top 20 % viewport band — matches
        // typical reading eye-line (UI-SPEC §Interaction 9).
        rootMargin: '-10% 0px -70% 0px',
        threshold: [0, 1],
      },
    );

    for (const { id } of collected) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, []);

  if (headings.length === 0) {
    return null;
  }

  return (
    <nav aria-label={t('toc.label')} className="sticky top-24">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t('toc.heading')}
      </p>
      <ol className="space-y-1.5 text-sm">
        {headings.map(heading => {
          const isActive = heading.id === activeId;
          return (
            <li key={heading.id}>
              <a
                href={`#${heading.id}`}
                aria-current={isActive ? 'location' : undefined}
                className={cn(
                  'block rounded-md border-s-2 px-3 py-1.5 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                  isActive
                    ? 'border-primary font-medium text-foreground'
                    : 'border-transparent text-muted-foreground',
                )}>
                {heading.text}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
