import { useEffect, useState } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';

export interface TocHeading {
  id: string;
  text: string;
}

export interface PrivacyNoticeTocState {
  headings: TocHeading[];
  activeId: string | null;
  label: string;
  heading: string;
}

/**
 * Collects `<main h2[id]>` nodes after mount and tracks the active section
 * via `IntersectionObserver`. Re-mount-only — privacy notices don't swap
 * content while open, so no MutationObserver wiring.
 */
export function usePrivacyNoticeToc(): PrivacyNoticeTocState {
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

  return {
    headings,
    activeId,
    label: t('toc.label'),
    heading: t('toc.heading'),
  };
}
